create table off_ramp_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  sent_at timestamptz not null default now(),
  consecutive_non_engaged_sends integer not null
);

comment on table off_ramp_events is 'Story P2-1 — logs each pre-emptive off-ramp OFFER (fewer texts / different food / stop entirely, via lib/offRamp.js#maybeFireOffRamp), fired once per non-engagement streak when consecutive_non_engaged_sends crosses OFF_RAMP_THRESHOLD (2) and engagement_preferences.off_ramp_sent_at is not already stamped for the current streak. Deliberately a separate table from any cadence-decay event log rather than a shared "engagement event" table or a status value on engagement_preferences/engagement_sends: an off-ramp is an OFFER extended to the account (the account may or may not act on it), which is a materially different thing from lib/cadenceDecay.js''s automatic, no-confirmation-needed cadence-tier step-down at CADENCE_DECAY_THRESHOLD (4) — conflating the two into one log would make a later "off-ramp conversion rate" query (did the account act on the offer, e.g. via opt_out_records or a softOptOut ladder rung, in the window after sent_at) ambiguous about which kind of event it was looking at. consecutive_non_engaged_sends is captured at fire time for that query''s denominator (how deep into the streak was the account when offered).';

create index off_ramp_events_account_id_idx on off_ramp_events (account_id);

alter table off_ramp_events enable row level security;

-- Same convention as every other table here: service-role (backend) only.
