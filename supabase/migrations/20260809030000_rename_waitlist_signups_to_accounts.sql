alter table waitlist_signups rename to accounts;

alter table accounts
  add column status text not null default 'pending' check (status in ('pending', 'approved'));

-- Backfill: everyone already on the manually-curated waitlist is treated as
-- implicitly vetted, so this approval gate doesn't retroactively lock out
-- real users Donald already welcomed by hand before this feature existed.
-- Only applies to this one-time historical backfill — all new accounts
-- created after this point default to 'pending' via the column default.
update accounts set status = 'approved';

comment on table accounts is 'Coop user accounts, keyed on phone number. No password — a phone number IS the account. Originally waitlist_signups; evolved in place once accounts became a real concept other per-user data (future preference profiles, saved deals) can reference. status gates access: pending = signed up or texted in but not yet vetted by Donald, approved = full RCS deals experience unlocked.';
