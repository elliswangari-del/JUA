-- Run this in the Supabase SQL Editor for the JUA project.
-- Public visitors can insert validated reports only. They cannot read, update,
-- or delete submissions. Review access should be granted only to trusted admins.

create table if not exists public.scam_reports (
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
  created_at timestamptz not null default now()
);

alter table public.scam_reports enable row level security;

revoke all on table public.scam_reports from public, anon, authenticated;
grant usage on schema public to anon;
grant insert (report_type, description, additional_details)
  on table public.scam_reports to anon;

drop policy if exists "Public can submit validated scam reports" on public.scam_reports;
create policy "Public can submit validated scam reports"
  on public.scam_reports
  for insert
  to anon
  with check (
    report_type in (
      'mobile_money',
      'phishing',
      'fake_job',
      'online_shop',
      'investment_impersonation',
      'other'
    )
    and char_length(btrim(description)) between 20 and 1200
    and (additional_details is null or char_length(btrim(additional_details)) <= 600)
    and status = 'new'
  );
