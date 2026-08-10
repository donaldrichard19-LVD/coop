create table merchant_dictionary (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  match_strings text[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table merchant_dictionary is 'Stage 4 (merchant identification) + stage 7 (category mapping) of the screenshot pipeline: deterministic lookup against OCR text, tried before any model call. A hit resolves merchant + category at zero tokens. Distinct from the merchants table (deal-bearing merchants Coop has active offers for) — a merchant can be recognized here without having a deal yet, which is exactly the gap screenshot upload is meant to surface. Seeded with Coop''s existing 7 deal merchants plus well-known national restaurant/coffee chains, deliberately NOT grocery/retail (Target, Walmart, etc.) since whether grocery is in scope at all is still an open product question — see BACKLOG.md.';

alter table merchant_dictionary enable row level security;

-- Same convention as every other table here: service-role (backend) only.

insert into merchant_dictionary (name, category, match_strings) values
  ('Blue Bottle Coffee', 'coffee', array['blue bottle']),
  ('Chipotle', 'fast casual', array['chipotle']),
  ('Panera Bread', 'fast casual', array['panera']),
  ('Tony''s Pizza Napoletana', 'restaurant', array['tony''s pizza', 'tonys pizza']),
  ('Pete''s Coffee', 'coffee', array['pete''s coffee', 'petes coffee']),
  ('Lucky Dumpling House', 'restaurant', array['lucky dumpling']),
  ('Ritual Coffee Roasters', 'coffee', array['ritual coffee']),
  ('Starbucks', 'coffee', array['starbucks']),
  ('McDonald''s', 'fast casual', array['mcdonald''s', 'mcdonalds']),
  ('Subway', 'fast casual', array['subway']),
  ('Domino''s Pizza', 'pizza', array['domino''s', 'dominos']),
  ('Taco Bell', 'mexican', array['taco bell']),
  ('Dunkin''', 'coffee', array['dunkin']),
  ('Wendy''s', 'fast casual', array['wendy''s', 'wendys']),
  ('Panda Express', 'fast casual', array['panda express']);
