-- Additive JUA account and review foundation.
-- Apply through the Supabase CLI after linking the JUA project, or review and
-- run this file in that project's SQL Editor. Existing anonymous reports remain.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_jua_profile on auth.users;
create trigger on_auth_user_created_jua_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

insert into public.profiles (id, display_name)
select id, nullif(left(btrim(coalesce(raw_user_meta_data ->> 'display_name', '')), 80), '')
from auth.users
on conflict (id) do nothing;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select (id, display_name, created_at, updated_at), update (display_name)
  on table public.profiles to authenticated;
drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null check (role_name in ('moderator', 'analyst', 'platform_admin')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_name)
);
create index if not exists user_roles_role_name_idx on public.user_roles (role_name, user_id);
alter table public.user_roles enable row level security;
revoke all on table public.user_roles from public, anon, authenticated;
grant select (user_id, role_name, assigned_at) on public.user_roles to authenticated;
drop policy if exists "Users can read their own roles" on public.user_roles;
create policy "Users can read their own roles" on public.user_roles
  for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('member', 'analyst', 'organization_admin')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id, status, organization_id);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
revoke all on table public.organizations, public.organization_memberships from public, anon, authenticated;
grant select (id, name, slug, created_at) on public.organizations to authenticated;
grant select (organization_id, user_id, role, status, created_at)
  on public.organization_memberships to authenticated;
drop policy if exists "Members can read their organization" on public.organizations;
create policy "Members can read their organization" on public.organizations
  for select to authenticated using (
    exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = organizations.id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );
drop policy if exists "Users can read their own memberships" on public.organization_memberships;
create policy "Users can read their own memberships" on public.organization_memberships
  for select to authenticated using ((select auth.uid()) = user_id);

-- Preserve the existing report table and anonymous submissions, adding account
-- ownership only for authenticated submissions made after this migration.
create table if not exists public.scam_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in (
    'mobile_money', 'phishing', 'fake_job', 'online_shop',
    'investment_impersonation', 'other'
  )),
  description text not null check (char_length(btrim(description)) between 20 and 1200),
  additional_details text check (
    additional_details is null or char_length(btrim(additional_details)) <= 600
  ),
  status text not null default 'new' check (status in ('new', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.scam_reports
  add column if not exists reporter_id uuid references auth.users(id) on delete set null;
alter table public.scam_reports
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;
create index if not exists scam_reports_reporter_created_idx
  on public.scam_reports (reporter_id, created_at desc);
create index if not exists scam_reports_organization_status_created_idx
  on public.scam_reports (organization_id, status, created_at)
  where organization_id is not null;
create index if not exists scam_reports_status_created_idx
  on public.scam_reports (status, created_at)
  where status in ('new', 'reviewing');

alter table public.scam_reports enable row level security;
revoke all on table public.scam_reports from public, anon, authenticated;
grant insert (report_type, description, additional_details) on public.scam_reports to anon;
grant select (id, report_type, description, additional_details, status, created_at, reporter_id, organization_id),
  insert (report_type, description, additional_details, reporter_id), update (status)
  on public.scam_reports to authenticated;
drop policy if exists "Public can submit validated scam reports" on public.scam_reports;
drop policy if exists "Authenticated users can submit their own reports" on public.scam_reports;
drop policy if exists "Users can read own reports and moderators can review all" on public.scam_reports;
drop policy if exists "Users can read own or assigned organization reports" on public.scam_reports;
drop policy if exists "Moderators can update report status" on public.scam_reports;
create policy "Public can submit validated scam reports" on public.scam_reports
  for insert to anon with check (
    reporter_id is null and status = 'new'
    and report_type in ('mobile_money', 'phishing', 'fake_job', 'online_shop', 'investment_impersonation', 'other')
    and char_length(btrim(description)) between 20 and 1200
    and (additional_details is null or char_length(btrim(additional_details)) <= 600)
  );
create policy "Authenticated users can submit their own reports" on public.scam_reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid()) and status = 'new'
    and report_type in ('mobile_money', 'phishing', 'fake_job', 'online_shop', 'investment_impersonation', 'other')
    and char_length(btrim(description)) between 20 and 1200
    and (additional_details is null or char_length(btrim(additional_details)) <= 600)
  );
create policy "Users can read own or assigned organization reports" on public.scam_reports
  for select to authenticated using (
    reporter_id = (select auth.uid())
    or exists (
      select 1 from public.user_roles as role
      where role.user_id = (select auth.uid()) and role.role_name = 'moderator'
    )
    or exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = scam_reports.organization_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('analyst', 'organization_admin')
        and membership.status = 'active'
    )
  );
create policy "Moderators can update report status" on public.scam_reports
  for update to authenticated
  using (exists (
    select 1 from public.user_roles as role
    where role.user_id = (select auth.uid()) and role.role_name = 'moderator'
  ))
  with check (exists (
    select 1 from public.user_roles as role
    where role.user_id = (select auth.uid()) and role.role_name = 'moderator'
  ));

create table if not exists public.report_reviews (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.scam_reports(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  previous_status text not null check (previous_status in ('new', 'reviewing')),
  new_status text not null check (new_status in ('reviewing', 'closed')),
  note text check (note is null or char_length(btrim(note)) <= 1000),
  created_at timestamptz not null default now(),
  check (previous_status <> new_status)
);
create index if not exists report_reviews_report_created_idx on public.report_reviews (report_id, created_at desc);
alter table public.report_reviews enable row level security;
revoke all on table public.report_reviews from public, anon, authenticated;
grant select (id, report_id, reviewer_id, previous_status, new_status, note, created_at)
  on public.report_reviews to authenticated;
drop policy if exists "Moderators can read report review history" on public.report_reviews;
create policy "Moderators can read report review history" on public.report_reviews
  for select to authenticated using (exists (
    select 1 from public.user_roles as role
    where role.user_id = (select auth.uid()) and role.role_name = 'moderator'
  ));

create or replace function private.record_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if (select auth.uid()) is null
      or not exists (
        select 1 from public.user_roles as role
        where role.user_id = (select auth.uid()) and role.role_name = 'moderator'
      ) then
      raise exception 'Only an authenticated moderator may change report status';
    end if;
    if not (
      (old.status = 'new' and new.status = 'reviewing')
      or (old.status = 'reviewing' and new.status = 'closed')
    ) then
      raise exception 'Unsupported report status transition';
    end if;
    insert into public.report_reviews (report_id, reviewer_id, previous_status, new_status)
    values (new.id, (select auth.uid()), old.status, new.status);
  end if;
  return new;
end;
$$;
revoke all on function private.record_report_status_change() from public, anon, authenticated;
drop trigger if exists scam_reports_record_status_change on public.scam_reports;
create trigger scam_reports_record_status_change
  before update of status on public.scam_reports
  for each row execute function private.record_report_status_change();
