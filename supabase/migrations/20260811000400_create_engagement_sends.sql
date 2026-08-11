create table engagement_sends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  sent_at timestamptz not null default now(),
  slot text not null,
  archetype text,
  deal_id uuid,
  template_id text,
  status text not null check (status in ('sent', 'suppressed', 'would_have_sent')),
  suppression_reason text,
  non_engagement_evaluated boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table engagement_sends is 'Story A1/A7 — one row per scheduled-engagement attempt, sent or not. status=sent is a real (or credential-less no-op "would have sent") outbound message via the existing sendRcsTurn path; status=suppressed means engagementSuppression.js (A2) blocked the attempt before rendering anything, with suppression_reason recorded (e.g. "quiet_hours", "hard_opt_out", "frequency_cap", "insufficient_inventory", "profile_not_ready"); status=would_have_sent is reserved for a future dry-run/shadow mode, not produced by this build pass. This table backs: A1''s idempotency check (has this account already got a sent/suppressed row for today''s slot, so a crash-retry does not double-send), A5''s repetition guard (recent deal_ids per account), A2''s frequency cap, A6/A11''s last-used-template lookup, and A12''s opt-out attribution joins. deal_id/template_id are plain uuid/text, not foreign keys — deals and rendered templates are not guaranteed to still exist by the time this row is queried historically, and this is a log, not a referential-integrity-critical table. archetype is the slot-policy archetype actually used (e.g. "value", "discovery", "weekend"), nullable for suppressed rows where no archetype was ever selected. non_engagement_evaluated is Story A11''s sweep-idempotency flag: lib/cadenceDecay.js#sweepNonEngagement only ever considers status=''sent'' rows where this is still false, flips it to true exactly once per row after deciding engaged/non-engaged (via engagement_preferences.last_engaged_at), so a later sweep tick never re-evaluates (and never double-decrements/increments consecutive_non_engaged_sends for) the same send.';

create index engagement_sends_account_id_idx on engagement_sends (account_id);
create index engagement_sends_account_sent_at_idx on engagement_sends (account_id, sent_at desc);

alter table engagement_sends enable row level security;

-- Same convention as every other table here: service-role (backend) only.
