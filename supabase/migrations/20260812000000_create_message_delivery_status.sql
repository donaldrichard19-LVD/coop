create table message_delivery_status (
  message_sid text primary key,
  to_phone text,
  status text not null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table message_delivery_status is 'One row per Twilio message SID, upserted every time Twilio calls the RCS status-callback webhook (routes/rcs.js POST /status) as a message progresses through queued/sent/delivered or fails (undelivered/failed, with error_code/error_message set). Distinct from engagement_sends.status, which only records "we successfully handed this to the Twilio API" at send time (a synchronous outcome) — this table is the actual downstream carrier-confirmed delivery signal, which the engagement design doc explicitly calls out as an easy-to-miss blind spot ("silent failure mode — you will look fine internally while nothing arrives"). Not scoped to engagement sends specifically: every outbound Twilio message in this app (screenshot-upload replies, confirm-merchant prompts, on-demand replies, etc.) can land a row here once the status-callback URL is configured on the Twilio side, since the webhook has no way to know which code path originated a given message_sid without a join. See engagement_sends.message_sids for the one join path currently wired up.';

alter table message_delivery_status enable row level security;

-- Same convention as every other table here: service-role (backend) only.
