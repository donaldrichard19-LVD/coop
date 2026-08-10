create table screenshot_uploads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  merchant_name text,
  category text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

comment on table screenshot_uploads is 'One row per screenshot a user texts in — the raw material the preference profile is built from. The image itself is never stored (processed via Claude vision and discarded); only the extracted structured data lands here. merchant_name is nullable since Claude can''t always confidently identify the specific business; category is required (falls back to a general type like "mexican"/"coffee"/"dessert" when the merchant itself is unclear), per explicit product decision. "Preference profile" is deliberately not a separate materialized table — it''s a query over this log (group by category/merchant), avoiding a second structure that could drift out of sync.';

create index screenshot_uploads_account_id_idx on screenshot_uploads (account_id);

alter table screenshot_uploads enable row level security;

-- Same convention as every other table here: service-role (backend) only.
