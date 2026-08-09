create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  created_at timestamptz not null default now()
);

comment on table waitlist_signups is 'Coop landing-page waitlist submissions (name + phone). Mirrors Calvin''s signups table pattern: upsert on conflict so a resubmit does not duplicate.';

alter table waitlist_signups enable row level security;

-- No public policies: this table is only ever touched by the backend via
-- the service role key, never by the frontend directly (same convention
-- as Calvin's Supabase tables).
