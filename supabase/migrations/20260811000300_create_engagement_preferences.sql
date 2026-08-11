create table engagement_preferences (
  account_id uuid primary key references accounts(id) on delete cascade,
  cadence_tier text not null default 'standard' check (cadence_tier in ('standard', 'reduced', 'minimal')),
  send_window text,
  snoozed_until timestamptz,
  excluded_categories text[] not null default '{}',
  excluded_merchants text[] not null default '{}',
  radius_override numeric,
  consecutive_non_engaged_sends integer not null default 0,
  last_engaged_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table engagement_preferences is 'One row per account, all-defaults until an account first triggers a soft opt-out (Story A10) or cadence decay (Story A11) — engagementSuppression.js (Story A2) reads this table on every send-eligibility check regardless of whether a row exists yet (missing row = defaults), so this table exists and is wired in before either A10 or A11 land, per the build plan''s dependency order. cadence_tier: standard = full frequency cap, reduced = one step down (A10 "too many" / A11 decay), minimal = lowest non-zero tier. send_window is free text today (no structured schema yet — e.g. "evenings") since nothing writes a real value to it in this build pass; reserved for a future per-user day/time optimization (P2, per the plan). snoozed_until implements A10''s "not now" 30-day auto-resume — checked, not manually cleared. radius_override is stored even though radius enforcement itself is currently a pass-through (see merchants table comment and engagementScoring.js) so the preference is ready the moment real geo lands. consecutive_non_engaged_sends backs A11''s cadence-decay threshold and is reset to 0 on any engaged reply, written by lib/cadenceDecay.js. last_engaged_at is the timestamp of the account''s most recent inbound message counted as engagement (any non-compliance inbound message — see routes/rcs.js''s single call site for lib/cadenceDecay.js#recordEngagedSend) — engagementScheduler.js''s 48-hour non-engagement sweep (lib/cadenceDecay.js#sweepNonEngagement) checks this against each unevaluated engagement_sends row''s sent_at to decide whether that send counts as engaged. Known limitation, documented in cadenceDecay.js: this is a single rolling timestamp, not a full per-event log, so if an account has multiple backlogged unevaluated sends the sweep evaluates them all against the same latest value rather than reconstructing exactly which send a given reply was "for" — acceptable given the sweep runs daily and P0''s cadence is only two sends/week, so a meaningful backlog should be rare.';

alter table engagement_preferences enable row level security;

-- Same convention as every other table here: service-role (backend) only.
