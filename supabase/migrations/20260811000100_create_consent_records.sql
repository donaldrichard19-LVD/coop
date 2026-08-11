create table consent_records (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  granted_at timestamptz not null default now(),
  context text not null,
  revoked_at timestamptz
);

comment on table consent_records is 'Consent audit trail for proactive engagement sends (Story A0/A8). One row is written by lib/consent.js whenever lib/accounts.js''s approval flow sets accounts.status to ''approved'' — that manual approval moment IS the consent event today (there is no separate opt-in flow). revoked_at is nullable and set if consent is later withdrawn by some future admin action; a hard STOP (see opt_out_records) is tracked separately since it is a distinct, user-initiated compliance event with its own keyword/message trail, not a revocation of this record.';
comment on column consent_records.context is 'Free-text source of the consent event, e.g. "waitlist_approval" — kept as text rather than an enum since this is a single-writer audit log today, not yet branching into multiple consent-collection surfaces.';

create index consent_records_account_id_idx on consent_records (account_id);

alter table consent_records enable row level security;

-- Same convention as every other table here: service-role (backend) only.
