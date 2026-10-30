const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const reportHtml = read("report.html");
const migration = read("supabase/migrations/20261027091746_secure_account_foundation.sql");

test("page stylesheet and scripts resolve to existing root assets", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^\"]*)?)"/g)]
    .map((match) => match[1])
    .filter((asset) => !/^https?:\/\//i.test(asset));
  assert.ok(assets.length > 0);
  for (const asset of assets) assert.ok(existsSync(path.join(root, asset.split("?")[0])), `${asset} should exist`);
});

test("Supabase config loads before Auth and report scripts", () => {
  const configIndex = reportHtml.indexOf('src="supabase-config.js"');
  const authIndex = reportHtml.indexOf('src="auth.js"');
  const reportIndex = reportHtml.indexOf('src="report.js"');
  assert.ok(configIndex >= 0 && configIndex < authIndex && authIndex < reportIndex, "configuration must load before its consumers");
});

test("form and account script element IDs are unique and present", () => {
  const ids = [...reportHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");
  const idSet = new Set(ids);
  for (const script of ["report.js", "auth.js"]) {
    const source = read(script);
    for (const [, id] of source.matchAll(/getElementById\("([^"]+)"\)/g)) {
      assert.ok(idSet.has(id), `${script} references missing #${id}`);
    }
  }
});

test("report workflow warns about secrets and only confirms after database success", () => {
  assert.match(reportHtml, /Do not submit passwords, PINs, verification codes, account numbers/);
  const source = read("report.js");
  assert.match(source, /client\.from\("scam_reports"\)\.insert\(payload\)/);
  assert.match(source, /Supabase confirmed that your report was saved/);
  assert.ok(source.indexOf("if (result.error)") < source.indexOf("Supabase confirmed that your report was saved"));
  assert.match(source, /if \(sending\) return/);
});

test("migration enables private-by-default report access and records moderator decisions", () => {
  assert.match(migration, /alter table public\.scam_reports enable row level security/i);
  assert.match(migration, /revoke all on table public\.scam_reports from public, anon, authenticated/i);
  assert.match(migration, /for select to authenticated using \([\s\S]*reporter_id = \(select auth\.uid\(\)\)[\s\S]*role_name = 'moderator'/i);
  assert.match(migration, /for insert to anon with check \([\s\S]*reporter_id is null and status = 'new'/i);
  assert.match(migration, /create table if not exists public\.report_reviews/i);
  assert.match(migration, /create trigger scam_reports_record_status_change/i);
  assert.match(migration, /add column if not exists organization_id uuid references public\.organizations/i);
  assert.match(migration, /membership\.role in \('analyst', 'organization_admin'\)[\s\S]*membership\.status = 'active'/i);
  assert.doesNotMatch(migration, /grant\s+select\s+on\s+table\s+public\.scam_reports\s+to\s+anon/i);
});

test("reviewed JUA setup is additive, collision-safe, and applies RLS to its tables", () => {
  const setup = read("supabase/setup_jua.sql");
  assert.match(setup, /begin;[\s\S]*commit;/i);
  assert.match(setup, /to_regclass\(format\('public\.%I', object_name\)\)/i);
  assert.match(setup, /schema jua_private already exists/i);
  assert.doesNotMatch(setup, /\bdrop\s+(?:table|schema|function|trigger|policy)\b/i);
  assert.doesNotMatch(setup, /\bcreate\s+or\s+replace\b/i);
  assert.doesNotMatch(setup, /\b(?:grant|revoke)\b[^;]*\bon\s+schema\b/i);
  for (const table of ["profiles", "user_roles", "organizations", "organization_memberships", "scam_reports", "report_reviews"]) {
    assert.match(setup, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(setup, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(setup, /on public\.scam_reports for insert to anon[\s\S]*reporter_id is null[\s\S]*status = 'new'/i);
  assert.match(setup, /on public\.scam_reports for select to authenticated[\s\S]*reporter_id = \(select auth\.uid\(\)\)[\s\S]*role_name = 'moderator'[\s\S]*membership\.organization_id = scam_reports\.organization_id/i);
  assert.match(setup, /on public\.scam_reports for update to authenticated[\s\S]*role_name = 'moderator'/i);
  assert.match(setup, /jua_on_auth_user_created_profile/i);
  assert.match(setup, /on public\.report_reviews for select to authenticated[\s\S]*role_name = 'moderator'/i);
});

test("local browser config has the expected public shape and is ignored by Git", () => {
  const configSource = read("supabase-config.js");
  const urlMatch = configSource.match(/\burl\s*:\s*"([^"]*)"/);
  const keyMatch = configSource.match(/\bpublishableKey\s*:\s*"([^"]*)"/);
  assert.ok(/window\.JUA_SUPABASE_CONFIG\s*=\s*\{/.test(configSource), "config must define JUA_SUPABASE_CONFIG");
  assert.ok(urlMatch && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(urlMatch[1].trim().replace(/\/$/, "")), "config must contain a valid Supabase project URL");
  assert.ok(keyMatch && keyMatch[1].trim().startsWith("sb_publishable_"), "config must use a Supabase publishable key");
  assert.ok(keyMatch && !/(?:service_role|sb_secret_)/i.test(keyMatch[1]), "browser config must not contain a service or secret key");

  const gitignore = read(".gitignore").split(/\r?\n/);
  assert.ok(gitignore.includes("/supabase-config.js"), "local Supabase config must remain outside Git changes");

  const auth = read("auth.js");
  assert.ok(/config\.url\.trim\(\)/.test(auth) && /config\.publishableKey\.trim\(\)/.test(auth), "Auth must trim local config values before use");
  assert.ok(/module\.createClient\(url, key/.test(auth), "Auth must create the shared client from configured values");
  const report = read("report.js");
  assert.ok(/window\.JUA_SUPABASE_READY/.test(report) && /client\.from\("scam_reports"\)\.insert\(payload\)/.test(report), "report submission must use the configured shared client");

  const readme = read("README.md");
  assert.ok(!/checked-in file contains empty placeholders|blank public Supabase project/i.test(readme), "README must not describe the local config as empty");
  assert.ok(/live database schema, RLS policies, and Auth settings have not been verified/i.test(readme), "README must distinguish local config from live database status");
});
