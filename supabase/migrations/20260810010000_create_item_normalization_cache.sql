create table item_normalization_cache (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null unique,
  canonical_name text,
  category text,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table item_normalization_cache is 'Stage 6 of the screenshot pipeline: raw item strings -> canonical product + category, cached by exact (lowercased/trimmed) raw text. Cache-first: repeat occurrences of a raw string resolve at zero tokens. First occurrence pays for one batched model call (small model tier) covering every unseen item in that screenshot together. Nulls are written back deliberately, per explicit design guidance, so an unresolvable string is only ever attempted (and paid for) once, not repeatedly.';

alter table item_normalization_cache enable row level security;

-- Same convention as every other table here: service-role (backend) only.
