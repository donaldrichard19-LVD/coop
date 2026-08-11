alter table accounts
  add column zip_code text,
  add column timezone text;

comment on column accounts.zip_code is 'US 5-digit zip, captured manually by Donald at approval time (see lib/accounts.js approveAccount) — there is no self-serve location-collection UI. Nullable: older approved accounts and any account approved without a zip supplied will have this null, and engagement suppression treats a null zip/timezone as "quiet hours unknown" (fails safe, per engagementSuppression.js).';
comment on column accounts.timezone is 'IANA timezone string, derived deterministically from zip_code''s 3-digit prefix via lib/zipTimezone.js at approval time — not user-supplied directly, not looked up from a live geocoding API. Coarse (zip-prefix granularity) but sufficient for quiet-hours enforcement.';
