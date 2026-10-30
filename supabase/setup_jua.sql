-- JUA's reviewed, one-time database setup for a clean JUA namespace.
-- Run in the Supabase SQL Editor only after confirming the names checked below
-- are unused. This script intentionally fails rather than adopting or changing
-- any existing same-named objects. It does not drop objects or alter schema-wide
-- grants/default privileges. It adds one specifically named trigger to auth.users.
--
-- Public scam-report inserts are intentionally enabled for the current guest
-- report form. RLS validates the row, but direct browser submissions do not have
-- reliable rate limiting; use a CAPTCHA and server-side rate limiting (for
-- example, an Edge Function) before relying on this for a high-traffic service.

begin;

do $$
declare
  object_name text;
  target_tables constant text[] := array[
    'profiles',
    'user_roles',
    'organizations',
    'organization_memberships',
    'scam_reports',
    'report_reviews'
  ];
begin
  if to_regclass('auth.users') is null then
    raise exception 'JUA setup requires Supabase Auth table auth.users';
  end if;

  if exists (
    select 1 from pg_namespace where nspname = 'jua_private'
  ) then
    raise exception 'Schema jua_private already exists; inspect it before running JUA setup';
  end if;

  foreach object_name in array target_tables loop
    if to_regclass(format('public.%I', object_name)) is not null then
      raise exception 'Table or relation public.% already exists; inspect it before running JUA setup', object_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'jua_on_auth_user_created_profile'
      and not tgisinternal
  ) then
    raise exception 'Trigger jua_on_auth_user_created_profile already exists on auth.users; inspect it before running JUA setup';
  end if;
end;
$$;

-- Keep trigger functions outside the exposed public schema.
create schema jua_private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null check (role_name in ('moderator', 'analyst', 'platform_admin')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_name)
);
create index user_roles_role_name_idx on public.user_roles (role_name, user_id);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (
    slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('member', 'analyst', 'organization_admin')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_memberships_user_idx
  on public.organization_memberships (user_id, status, organization_id);

create table public.scam_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in (
    'mobile_money',
    'phishing',
    'fake_job',
    'online_shop',
    'investment_impersonation',
    'other'
  )),
  description text not null check (
    char_length(btrim(description)) between 20 and 1200
  ),
  additional_details text check (
    additional_details is null or char_length(btrim(additional_details)) <= 600
  ),
  status text not null default 'new' check (status in ('new', 'reviewing', 'closed')),
  created_at timestamptz not null default now(),
  reporter_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null
);
create index scam_reports_reporter_created_idx
  on public.scam_reports (reporter_id, created_at desc);
create index scam_reports_organization_status_created_idx
  on public.scam_reports (organization_id, status, created_at)
  where organization_id is not null;
create index scam_reports_status_created_idx
  on public.scam_reports (status, created_at)
  where status in ('new', 'reviewing');

create table public.report_reviews (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.scam_reports(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  previous_status text not null check (previous_status in ('new', 'reviewing')),
  new_status text not null check (new_status in ('reviewing', 'closed')),
  note text check (note is null or char_length(btrim(note)) <= 1000),
  created_at timestamptz not null default now(),
  check (previous_status <> new_status)
);
create index report_reviews_report_created_idx
  on public.report_reviews (report_id, created_at desc);

-- Profiles are created for new Auth users and backfilled for existing users.
-- Both operations write only to the new JUA profiles table.
create function jua_private.create_profile_for_auth_user()
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

create trigger jua_on_auth_user_created_profile
  after insert on auth.users
  for each row execute function jua_private.create_profile_for_auth_user();

insert into public.profiles (id, display_name)
select id, nullif(left(btrim(coalesce(raw_user_meta_data ->> 'display_name', '')), 80), '')
from auth.users
on conflict (id) do nothing;

create function jua_private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jua_profiles_set_updated_at
  before update on public.profiles
  for each row execute function jua_private.set_profile_updated_at();

create function jua_private.record_report_status_change()
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
        where role.user_id = (select auth.uid())
          and role.role_name = 'moderator'
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

create trigger jua_scam_reports_record_status_change
  before update of status on public.scam_reports
  for each row execute function jua_private.record_report_status_change();

-- Enable RLS on every new JUA table and remove any project default grants from
-- these newly-created tables only. This deliberately does not touch defaults,
-- schema grants, or any other table.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.scam_reports enable row level security;
alter table public.report_reviews enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.user_roles from public, anon, authenticated;
revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.organization_memberships from public, anon, authenticated;
revoke all on table public.scam_reports from public, anon, authenticated;
revoke all on table public.report_reviews from public, anon, authenticated;

-- No client role can directly invoke these internal trigger functions.
revoke all on function jua_private.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function jua_private.set_profile_updated_at() from public, anon, authenticated;
revoke all on function jua_private.record_report_status_change() from public, anon, authenticated;

-- Profiles: users may read their own profile and change only the display name.
grant select (id, display_name, created_at, updated_at), update (display_name)
  on table public.profiles to authenticated;
create policy jua_profiles_read_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy jua_profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Role assignments are provisioned by a trusted project administrator only.
grant select (user_id, role_name, assigned_at) on table public.user_roles to authenticated;
create policy jua_user_roles_read_own
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

-- Organization and membership records are read-only to clients. Organization
-- members can see their organization; each user can see their own membership.
grant select (id, name, slug, created_at) on table public.organizations to authenticated;
grant select (organization_id, user_id, role, status, created_at)
  on table public.organization_memberships to authenticated;
create policy jua_organizations_read_active_members
  on public.organizations for select to authenticated
  using (exists (
    select 1 from public.organization_memberships as membership
    where membership.organization_id = organizations.id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  ));
create policy jua_memberships_read_own
  on public.organization_memberships for select to authenticated
  using ((select auth.uid()) = user_id);

-- Anonymous visitors can submit validated, unowned reports, but cannot read
-- report rows. Signed-in users may create and read their own reports. Moderators
-- may review all reports; active org analysts/admins see reports assigned to
-- their organization. Only moderators can change status.
grant insert (report_type, description, additional_details)
  on table public.scam_reports to anon;
grant select (id, report_type, description, additional_details, status, created_at, reporter_id, organization_id),
  insert (report_type, description, additional_details, reporter_id),
  update (status)
  on table public.scam_reports to authenticated;

create policy jua_reports_anon_submit
  on public.scam_reports for insert to anon
  with check (
    reporter_id is null
    and status = 'new'
    and report_type in ('mobile_money', 'phishing', 'fake_job', 'online_shop', 'investment_impersonation', 'other')
    and char_length(btrim(description)) between 20 and 1200
    and (additional_details is null or char_length(btrim(additional_details)) <= 600)
  );
create policy jua_reports_authenticated_submit_own
  on public.scam_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'new'
    and report_type in ('mobile_money', 'phishing', 'fake_job', 'online_shop', 'investment_impersonation', 'other')
    and char_length(btrim(description)) between 20 and 1200
    and (additional_details is null or char_length(btrim(additional_details)) <= 600)
  );
create policy jua_reports_read_own_moderator_or_assigned_org
  on public.scam_reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or exists (
      select 1 from public.user_roles as role
      where role.user_id = (select auth.uid())
        and role.role_name = 'moderator'
    )
    or exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = scam_reports.organization_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('analyst', 'organization_admin')
        and membership.status = 'active'
    )
  );
create policy jua_reports_moderator_update_status
  on public.scam_reports for update to authenticated
  using (exists (
    select 1 from public.user_roles as role
    where role.user_id = (select auth.uid())
      and role.role_name = 'moderator'
  ))
  with check (exists (
    select 1 from public.user_roles as role
    where role.user_id = (select auth.uid())
      and role.role_name = 'moderator'
  ));

-- Review history is visible to moderators only. Inserts are trigger-only.
grant select (id, report_id, reviewer_id, previous_status, new_status, note, created_at)
  on table public.report_reviews to authenticated;
create policy jua_report_reviews_moderator_read
  on public.report_reviews for select to authenticated
  using (exists (
    select 1 from public.user_roles as role
    where role.user_id = (select auth.uid())
      and role.role_name = 'moderator'
  ));

commit;
