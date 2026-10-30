# Jua — Cyber Scam Awareness Assistant

Jua is a beginner-friendly website for learning to spot online scams, review suspicious messages, practise safer choices, and find practical next steps. It is a static HTML, CSS, and JavaScript site with no build step or local database server requirement.

## Run locally

Serve the repository root with any static web server and open its local URL. For example, from this folder run `python3 -m http.server 8000`, then visit `http://localhost:8000`. Opening `index.html` directly is sufficient for most page features, but a local server is needed for browser requests to Supabase and the public DNS resolver.

## Features

- Dashboard and responsive navigation, including an assistant view and browser back/forward handling.
- Local, rule-based message checker. It does not inspect URLs, verify senders, or use AI.
- Five-question awareness quiz with feedback and a completion count stored only in the current browser.
- Scam-awareness library with text search and topic filtering.
- Practical response guidance and links to Kenyan agencies and providers.
- OSINT centre with public DNS-over-HTTPS lookups and clearly marked handoffs to external services. The user chooses whether to share information with those services.
- Existing Jotform AI assistant embed. Its contents are hosted by Jotform and are outside this site's control.
- Scam report submission to Supabase PostgreSQL when the project configuration and SQL setup are complete.

## Supabase setup

The browser integration reads Jua's project URL and publishable key from a local `supabase-config.js` file. That file is excluded from Git. The app uses Supabase Auth and the Supabase JavaScript client from a pinned CDN release, so there is no build step or local database server. The project URL and publishable key are public browser configuration values; never put a database password, `service_role` key, or secret key in the site.

1. Create or select the Supabase project for Jua. Copy its **Project URL** and **Publishable key** from the project's Connect dialog or API Keys settings.
2. Put those two public values in the local root `supabase-config.js` file. Keep the file ignored and do not paste the values into documentation, test output, screenshots, or logs.
3. In the Jua project's dashboard, open **SQL Editor → New query**, paste the contents of [`supabase/migrations/20261027091746_secure_account_foundation.sql`](supabase/migrations/20261027091746_secure_account_foundation.sql), review it, and run it once. This SQL Editor method is the simplest setup; it does not register the run in Supabase CLI migration history. The versioned file remains in this repository for review and future changes. Do not apply it to another project.
4. In Supabase Auth settings, enable email signups and keep email confirmation enabled. Add the local development URL (for example `http://localhost:8000/**`) and the hosted Jua URL to the Auth redirect URL allowlist. The form sends account confirmation and recovery links back to `#account`.
5. Confirm the `public` schema/table is available through the project's Data API settings. The migration grants only the needed table/column actions and uses RLS; newer projects may require an explicit API exposure setting for new tables.
6. Serve the site over HTTPS when deployed. Use a trusted Supabase administrator account to assign `moderator`, `analyst`, or `platform_admin` rows in `user_roles`; public signup cannot assign roles. The student-facing interface does not provide a role-management screen.

To assign a moderator during setup, use the SQL Editor as a trusted project administrator and replace the email with the moderator's verified account email:

```sql
insert into public.user_roles (user_id, role_name)
select id, 'moderator'
from auth.users
where lower(email) = lower('moderator@example.com')
on conflict (user_id, role_name) do nothing;
```

Use the same pattern with `analyst` or `platform_admin` only for trusted accounts. Role assignment is intentionally a trusted-operator action, never a public signup option.

This static frontend reads configuration from `supabase-config.js`, not from `.env` files, so a build tool and `.env.example` are not needed. There is no server-side component in this increment. The local client code is prepared for Supabase Auth, profiles, reports, and role-scoped views. The live database schema, RLS policies, and Auth settings have not been verified, so remote availability must not be inferred from the local configuration file.

Anonymous public inserts are validated for allowed report type and text lengths, and PostgreSQL supplies status and timestamps. RLS and grants prevent public reads and edits, but they do not provide dependable rate limiting, CAPTCHA, spam detection, or moderation. A determined visitor can submit many valid-looking reports. Before public production use, put submissions behind a server-side function with rate limiting and abuse controls; keep any secret key only in protected server environment settings. The UI disables repeat clicks while a request is in progress and reports success only after Supabase confirms the insert.

Reports should contain only general incident descriptions. The site warns users not to submit passwords, PINs, verification codes, account numbers, or unnecessary personal information. Do not publish raw submissions. Set up and document a human review and retention process before inviting public use.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Main page, dashboard sections, assistant view, and report form |
| `style.css` | Gold-and-obsidian design, responsive layouts, focus styles, and reduced-motion rules |
| `main.js` | Assistant routing, browser history, mobile navigation, and reveals |
| `checker.js` | Local rule-based message checker |
| `quiz.js` | Quiz questions, scoring, explanations, and local completion count |
| `library.js` | Library search and category filter |
| `osint.js` | DNS lookup and external-provider handoffs |
| `report.js` | Report validation and Supabase submission |
| `supabase-config.js` | Local-only public Supabase project URL and publishable-key configuration; ignored by Git |
| `supabase/migrations/20261027091746_secure_account_foundation.sql` | Additive profiles, roles, organization, report, RLS, and review-history schema |
| `supabase/scam_reports.sql` | Earlier standalone report-only SQL setup; the account migration supersedes it for a fresh setup |

## Privacy and limitations

- The message checker processes text in the page and does not save or transmit it. Remove personal details before checking.
- Quiz progress is stored only in the current browser; it is not an account or cross-device history.
- When the remote schema and policies are installed, report submissions go to the configured Supabase project. The remote schema and RLS policies have not been verified. The intended policies let anonymous visitors submit but not read existing reports; public submissions remain vulnerable to spam without server-side abuse controls.
- DNS lookup sends the requested domain to Cloudflare DNS over HTTPS. VirusTotal, Google Safe Browsing, urlscan.io, Have I Been Pwned, ICANN Lookup, and Certificate Transparency are provider handoffs or external lookups, not verdicts produced by Jua. Review each provider's privacy and visibility rules before sharing information.
- The Jotform assistant is hosted by Jotform. Do not submit passwords, PINs, one-time codes, or sensitive personal information in its chat.
- Jua is educational and cannot guarantee that a message, site, account, or transaction is safe.

## Check before publishing

With a configured Supabase project, verify navigation, the mobile menu, checker, quiz completion/restart, library filters, report success and error states, DNS lookup after reading its sharing notice, and the Jotform embed. Inspect the browser console and test desktop and phone widths. No live Supabase submission can be confirmed until a Jua project URL/key are supplied and the SQL is applied.
