create table merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  category text,
  distance_label text not null,
  first_visit_at date not null,
  visit_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table merchants is 'Places Coop has learned a user orders from. distance_label/visit_count are single global values for now since Coop has no per-user identity yet (only anonymous waitlist phone numbers) — revisit once the screenshot-upload feature and some notion of "user" exist.';

create table deals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  offer text not null,
  savings_amount numeric(10, 2) not null,
  original_price numeric(10, 2),
  code text,
  status text not null check (status in ('active', 'expiring', 'endingToday', 'used', 'expired')),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column deals.ends_at is 'Expiry timestamp for active/expiring/endingToday/expired deals; doubles as the redemption timestamp when status = used (matches the mock data''s overloaded endsLabel).';

create index deals_merchant_id_idx on deals (merchant_id);

alter table merchants enable row level security;
alter table deals enable row level security;

-- No public policies yet, same convention as waitlist_signups: only the
-- backend (service role) touches these until there's a real API endpoint
-- serving deals to the frontend, at which point the backend stays the only
-- reader too (frontend never queries Supabase directly).
