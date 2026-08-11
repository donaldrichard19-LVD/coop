create table surfaced_deals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  deal_id uuid not null,
  surfaced_at timestamptz not null default now()
);

comment on table surfaced_deals is 'Story B5 — records every deal id ever pushed to an account via the screenshot-upload profile-match path (routes/rcs.js maybePushProfileMatches and its ongoing-re-notification extension), so repeat uploads past MIN_UPLOADS_FOR_PROFILE do not re-surface a deal the account has already been shown. deal_id is a plain uuid, not a foreign key to deals — same reasoning as engagement_sends.deal_id (this is a log of what was shown, not a referential-integrity-critical table, and a deal row can be deleted/expire without invalidating the history of what was once sent). Deliberately separate from engagement_sends (Story A7) even though both log "a deal was shown to an account" — this table is scoped to the screenshot-upload push path specifically, which has its own trigger condition (every upload past the threshold) and its own re-notification dedupe rule, distinct from the scheduled-cadence engagement pipeline.';

create index surfaced_deals_account_id_idx on surfaced_deals (account_id);
create unique index surfaced_deals_account_deal_idx on surfaced_deals (account_id, deal_id);

alter table surfaced_deals enable row level security;

-- Same convention as every other table here: service-role (backend) only.
