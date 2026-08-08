# Coop — Backlog

## Screenshot upload (replaces Plaid for account-less users)
Let users who don't want to connect a bank account upload screenshots of recent orders instead — Coop parses them into merchants + items, builds a preference profile, and surfaces deals from local merchants for similar or exact goods.

**User story:** As a user, I want to upload screenshots of recent purchases from merchants so Coop can personalize deals from local merchants near me.

**Acceptance criteria:**
- User can upload screenshots from their phone to Coop.
- Coop parses screenshots for merchant identification and individual items within the order.
- Coop builds a preference profile from parsed data.
- Coop surfaces offers from local merchants for similar or exact goods.

**Status:** This replaces the Plaid onboarding step (see "Plaid onboarding flow" below — now backlogged, not deleted). The waitlist flow (built 2026-08-07, live) is the interim front door; this is the feature that will eventually sit behind Donald's manual SMS trigger, giving waitlisted users something to do once they're texted.

**Prerequisites:** A vision-capable parsing step. Coop's backend has no LLM/vision dependency today (`backend/package.json` is just `cors`/`dotenv`/`express`/`twilio`) — the natural fit given the rest of this stack is the Anthropic SDK's multimodal input (Claude can take an image + a structured-extraction prompt and return JSON), matching how Calvin's backend already uses `lib/anthropic.js` for a similar job. Needs an `ANTHROPIC_API_KEY`.

**Scope (draft — needs a real planning pass before building, not sized yet):**

- **Upload UI**: a step in the (now-simplified) onboarding chain, or a standalone flow reachable from the RCS thread — needs a product decision on *when* this happens (during signup vs. after Donald's SMS trigger, per "Status" above).
- **Backend — `POST /api/screenshots/parse`**: accepts an image, sends to Claude with an extraction prompt, returns `{ merchant, items: [{ name, category, price? }] }`. No image storage requirement stated yet — decide whether screenshots are persisted (privacy/retention question, given these are receipts) or processed and discarded.
- **Preference profile**: doesn't exist as a concept in `src/data/deals.js` today — that schema is deal-shaped, not user-shaped. Needs its own model: something like `{ merchants: [{name, itemCategories: [...], lastSeen}], preferredCategories: [...] }`, built up incrementally as more screenshots come in.
- **"Similar or exact goods" matching**: also doesn't exist yet. Current `matchDeals()` matches on merchant/keyword against a fixed mock deal list — there's no item-level or category-level similarity matching anywhere in the codebase. This is probably the hardest open question: does "similar goods" mean category-matching (both are "coffee"), semantic matching (embeddings), or something cruder (keyword overlap) for v1?
- **Storage**: no database exists in Coop at all yet (mock data only). This feature is the first one that actually needs to persist something per-user (the profile) rather than just relay a mock catalog — will need to decide on Supabase (matching Calvin's convention) vs. something else.

**Open questions (explicitly not resolved — flag before scoping further):**
- Does this run during onboarding (before the person is "in") or after, as a way to make the waitlist SMS lead somewhere real?
- What happens for a merchant screenshot Coop can't confidently identify — silent skip, or ask the user to confirm?
- Retention: are uploaded screenshots kept, or processed-and-discarded? (They're effectively receipts — probably want to discard the image and keep only the extracted structured data, but that's a call to make explicitly, not default into.)

**Effort:** not sized — the matching-logic and profile-schema questions above need answers before this can be estimated honestly.

---

## Plaid onboarding flow (backlogged 2026-08-07)
The original self-serve onboarding — phone number → simulated location permission → simulated Plaid Link (bank search/login/linking/success) → handoff → straight into the live chat app with a proactive deal push — was built and briefly live at getcoop.cash. Superseded by the waitlist flow (name + phone → email to Donald → he manually triggers a welcome text) while screenshot upload (above) is designed as the real account-less onboarding path.

**Not deleted** — `src/pages/onboarding/PhoneStep.jsx`, `LocationStep.jsx`, `PlaidStep.jsx`, `HandoffStep.jsx` all still exist and work, just aren't wired into `OnboardingFlow.jsx`'s active chain anymore. Real Plaid Link integration (actual API credentials, actual bank connection) was never built regardless — the Plaid step was always simulated, per `backend/rcs/` and the whole project's "no real Plaid/Plaid Enrich/Square integrations yet" status.

**If ever resumed:** wire `PhoneStep`/`LocationStep`/`PlaidStep`/`HandoffStep` back into `OnboardingFlow.jsx` after `WaitlistStep`, or replace `PlaidStep` with a real Plaid Link SDK integration (needs `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV`, matching the shape of Calvin's plaid backlog item).
