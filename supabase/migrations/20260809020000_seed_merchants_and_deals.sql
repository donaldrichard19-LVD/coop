-- Seeded from the current mock data (src/data/deals.js) so the real schema
-- starts out matching what the app already renders. Categories are inferred
-- (not explicit in the mock) to roughly match categoryBreakdown's three
-- buckets: coffee shops, restaurants, fast casual.

with m as (
  insert into merchants (name, initials, category, distance_label, first_visit_at, visit_count) values
    ('Blue Bottle Coffee', 'BB', 'coffee', '0.3 mi', '2026-03-01', 24),
    ('Chipotle', 'CH', 'fast casual', '0.6 mi', '2026-01-01', 18),
    ('Panera Bread', 'PB', 'fast casual', '0.8 mi', '2026-04-01', 9),
    ('Tony''s Pizza Napoletana', 'TP', 'restaurant', '1.1 mi', '2026-05-01', 6),
    ('Pete''s Coffee', 'PC', 'coffee', '0.4 mi', '2026-06-01', 4),
    ('Lucky Dumpling House', 'LD', 'restaurant', '1.4 mi', '2026-06-01', 3),
    ('Ritual Coffee Roasters', 'RC', 'coffee', '0.5 mi', '2026-02-01', 7)
  returning id, name
)
insert into deals (merchant_id, offer, savings_amount, original_price, code, status, ends_at)
select m.id, d.offer, d.savings_amount, d.original_price, d.code, d.status, d.ends_at
from (values
    ('Blue Bottle Coffee', 'Free drip coffee with any pastry purchase', 4.20, null::numeric, null, 'expiring', '2026-08-16 23:59:00+00'::timestamptz),
    ('Chipotle', '$0 delivery fee on orders over $15', 3.99, null, 'CHIP-ZERO-15', 'endingToday', '2026-08-09 22:00:00-07:00'),
    ('Panera Bread', 'Free pastry with any Sip Club drink', 3.50, null, null, 'active', '2026-08-31 23:59:00+00'),
    ('Tony''s Pizza Napoletana', '15% off your next visit', 6.75, 45.00, 'TONYS-REGULAR-15', 'expiring', '2026-08-14 23:59:00+00'),
    ('Pete''s Coffee', '20% off any cold brew', 1.10, 5.50, null, 'used', '2026-08-02 12:00:00+00'),
    ('Lucky Dumpling House', '$5 off orders over $25', 5.00, null, 'LUCKY5', 'active', '2026-09-10 23:59:00+00'),
    ('Ritual Coffee Roasters', 'Buy one, get one drip coffee', 3.75, null, null, 'expired', '2026-07-28 23:59:00+00')
  ) as d(merchant_name, offer, savings_amount, original_price, code, status, ends_at)
join m on m.name = d.merchant_name;
