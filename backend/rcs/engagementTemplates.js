// Story A6 — proactive-engagement message copy, plain data (not Twilio Content API
// templates — per the build plan's guardrail #4, no new template provisioning is needed;
// these are slot-filled in application code and handed to the *existing* sendRcsTurn path,
// which already renders deal cards via the already-provisioned card/carousel templates).
//
// Organized by slot archetype (see engagementSlotPolicy.js) with several tonal variants
// each, so engagementRender.js can rotate phrasing instead of sending the same wording
// every time. Typed slots, filled by engagementRender.js#fillSlots:
//   {merchant}  deal.merchant.name
//   {offer}     deal.offer
//   {category}  deal.category
//   {expiry}    deal.endsLabel
//
// Deliberately no {distance} slot: merchants.distance_label is a single value shared
// across every account (no per-user distance computation anywhere in lib/deals.js — same
// pre-existing gap the merchants table's own comment and engagementScoring.js's radius
// pass-through already flag), so stating it as fact in an UNPROMPTED proactive text would
// be a specific, likely-wrong claim sent to every recipient regardless of where they
// actually are. That risk is materially worse here than in the pre-existing reactive
// deal-card rendering (rcs/render.js's subtitle line, left untouched) — a card shown in
// response to something the user just asked for is lower-stakes than an assertion volunteered
// on a fixed 2x/week cadence. If real per-account distance ever lands, reintroducing a
// {distance} slot here is a template-copy change only, not an architecture change.
//
// Voice matches the rest of routes/rcs.js's copy: lowercase, casual, short.

function t(id, text) {
  return { id, text }
}

const VALUE_TEMPLATES = [
  t('value_01', 'lunch run to {merchant}? {offer} — {expiry}.'),
  t('value_02', 'your usual at {merchant} just got a discount: {offer}, {expiry}.'),
  t('value_03', 'quick one — {merchant} has {offer} going right now. {expiry}.'),
  t('value_04', "{merchant} again? no judgment, especially with {offer} on the table. {expiry}."),
  t('value_05', 'fuel for the week: {offer} at {merchant}, {expiry}.'),
  t('value_06', "you've been to {merchant} enough that this felt right — {offer}, {expiry}."),
  t('value_07', '{offer} at {merchant} — {expiry}.'),
  t('value_08', 'small win before the week gets busy: {offer} at {merchant}. {expiry}.'),
  t('value_09', '{merchant} regulars only: {offer}. {expiry}.'),
  t('value_10', 'worth the detour — {offer} at {merchant}, {expiry}.'),
  t('value_11', 'your {category} spot has {offer} live. {expiry}.'),
  t('value_12', 'cheap win: {merchant}, {offer}. {expiry}.'),
  t('value_13', 'you know the drill — {merchant}, {offer}, {expiry}.'),
  t('value_14', '{merchant} said yes to {offer}. {expiry}.'),
  t('value_15', 'keeping it simple: {offer} at {merchant}. {expiry}.'),
  t('value_16', '{merchant} has {offer} for you right now. {expiry}.'),
  t('value_17', 'before the week gets away from you: {offer} at {merchant}. {expiry}.'),
  t('value_18', 'your go-to {category} order, cheaper today — {merchant}, {offer}. {expiry}.'),
]

const DISCOVERY_TEMPLATES = [
  t('discovery_01', "haven't seen you at {merchant} yet — {offer} might be a good reason to start. {expiry}."),
  t('discovery_02', 'something new: {merchant} ({category}) has {offer}. {expiry}.'),
  t('discovery_03', 'midweek detour idea — {merchant}, {offer}. {expiry}.'),
  t('discovery_04', 'not your usual spot, but {merchant} is worth a look: {offer}. {expiry}.'),
  t('discovery_05', '{merchant} popped up near you with {offer}. {expiry}.'),
  t('discovery_06', 'trying something different this week? {merchant} has {offer}. {expiry}.'),
  t('discovery_07', "a {category} spot you haven't hit yet — {merchant}, {offer}. {expiry}."),
  t('discovery_08', 'new to you: {merchant}, {offer}. {expiry}.'),
  t('discovery_09', 'worth branching out — {merchant} is offering {offer}. {expiry}.'),
  t('discovery_10', '{merchant} caught our eye for you: {offer}. {expiry}.'),
  t('discovery_11', 'switch it up: {merchant} ({category}), {offer}. {expiry}.'),
  t('discovery_12', 'new-to-you find — {merchant}, {offer}, {expiry}.'),
  t('discovery_13', 'a change of pace: {offer} at {merchant}. {expiry}.'),
  t('discovery_14', '{merchant} is new on our radar for you — {offer}. {expiry}.'),
  t('discovery_15', 'midweek curveball: {merchant} has {offer}. {expiry}.'),
  t('discovery_16', 'you order {category} a lot — have you tried {merchant}? {offer}, {expiry}.'),
  t('discovery_17', 'somewhere different tonight — {merchant}, {offer}. {expiry}.'),
  t('discovery_18', '{merchant}, a new find: {offer}. {expiry}.'),
]

const WEEKEND_TEMPLATES = [
  t('weekend_01', 'weekend plans? {merchant} has {offer}. {expiry}.'),
  t('weekend_02', 'treat yourself — {offer} at {merchant} this weekend. {expiry}.'),
  t('weekend_03', 'friday-night-worthy: {merchant}, {offer}. {expiry}.'),
  t('weekend_04', 'bring someone — {merchant} has {offer}, {expiry}.'),
  t('weekend_05', 'worth the splurge: {offer} at {merchant}. {expiry}.'),
  t('weekend_06', '{merchant} is a good weekend call — {offer}. {expiry}.'),
  t('weekend_07', 'date night idea: {merchant}, {offer}. {expiry}.'),
  t('weekend_08', 'go big this weekend — {offer} at {merchant}. {expiry}.'),
  t('weekend_09', 'great for a weekend group — {merchant}, {offer}. {expiry}.'),
  t('weekend_10', 'saturday plans sorted: {merchant} has {offer}. {expiry}.'),
  t('weekend_11', 'worth getting dressed up for — {merchant}, {offer}. {expiry}.'),
  t('weekend_12', '{merchant} for the weekend crew: {offer}. {expiry}.'),
  t('weekend_13', 'make a night of it — {offer} at {merchant}. {expiry}.'),
  t('weekend_14', '{category} night? {merchant} has {offer}. {expiry}.'),
  t('weekend_15', "the weekend deal you've been waiting for: {merchant}, {offer}. {expiry}."),
  t('weekend_16', 'worth the trip — {merchant}, {offer}. {expiry}.'),
  t('weekend_17', 'go all out — {offer} at {merchant} this weekend. {expiry}.'),
  t('weekend_18', '{merchant} says come through this weekend: {offer}. {expiry}.'),
]

export const ENGAGEMENT_TEMPLATES = {
  value: VALUE_TEMPLATES,
  discovery: DISCOVERY_TEMPLATES,
  weekend: WEEKEND_TEMPLATES,
}

export const ALL_ENGAGEMENT_TEMPLATES = [...VALUE_TEMPLATES, ...DISCOVERY_TEMPLATES, ...WEEKEND_TEMPLATES]
