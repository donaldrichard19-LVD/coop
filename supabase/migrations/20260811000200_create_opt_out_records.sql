create table opt_out_records (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  type text not null check (type in ('hard', 'soft')),
  keyword_matched text,
  message_body text,
  last_send_id uuid,
  created_at timestamptz not null default now(),
  resumed_at timestamptz
);

comment on table opt_out_records is 'Story A8 (hard) / A10 (soft) — every compliance-relevant opt-out event, keyword-based STOP/START handling and the softer "too many"/"wrong food"/"too far"/"not now" ladder alike. type=hard means lib/optOut.js''s STOP-family classifier matched (absolute, checked before every send and before any model call); type=soft means lib/softOptOut.js matched a lower-severity signal that only adjusts engagement_preferences rather than fully blocking sends. keyword_matched/message_body are nullable because a soft opt-out inferred by lib/intentExtraction.js (ambiguous negative feedback, Story A10) may not have a clean keyword to point to. last_send_id is a plain uuid (not a foreign key), same reasoning as engagement_sends.deal_id — this migration runs before engagement_sends exists, and a join-only pointer to a log row does not need referential integrity; it links back to whichever engagement_sends row (if any) was in flight/most-recent when the opt-out landed, for attribution (Story A12) and for the "suppress any pending/queued send immediately" requirement in A8. resumed_at is set when a hard opt-out is lifted via START — soft opt-outs resume via engagement_preferences.snoozed_until expiring instead, not via this column.';

create index opt_out_records_account_id_idx on opt_out_records (account_id);
create index opt_out_records_account_type_idx on opt_out_records (account_id, type);

alter table opt_out_records enable row level security;

-- Same convention as every other table here: service-role (backend) only.
