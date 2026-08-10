# Coop — Backlog

## Screenshot upload (replaces Plaid for account-less users)
Let users who don't want to connect a bank account upload screenshots of recent orders instead — Coop parses them into merchants + items, builds a preference profile, and surfaces deals from local merchants for similar or exact goods.

**User story:** As a user, I want to upload screenshots of recent purchases from merchants so Coop can personalize deals from local merchants near me.

**Acceptance criteria:**
- User can upload screenshots from their phone to Coop. ✅ (MMS/RCS media on the existing inbound webhook, `routes/rcs.js`)
- Coop parses screenshots for merchant identification and individual items within the order. ✅
- Coop builds a preference profile from parsed data. ✅
- Coop surfaces offers from local merchants for similar or exact goods. ✅ (pushed once a profile crosses the minimum-upload threshold — see below)

**Status: built, following the cost-routing pipeline design in project memory** (deterministic stages first, model calls only where a judgment call is unavoidable, cache/dictionary write-back everywhere). Reachable today via text: an approved account (`accounts` table, Donald's manual approval gate — see the phone-identity section below) MMS's a screenshot to the RCS number.

**Resolved decisions** (previously open questions, now answered and built):
- **Timing**: after approval, over text — not during onboarding. The waitlist flow is still the front door; screenshot upload is what an approved number can do once they're in.
- **Retention**: processed and discarded. The image is downloaded into memory, OCR'd, and never written to disk or Supabase — only the extracted structured data lands in `screenshot_uploads`.
- **Low-confidence merchant handling**: one-tap RCS confirm chip ("is this ⟨merchant⟩? yes/no"), sent whenever the merchant came from a model guess rather than the deterministic dictionary. A "yes" writes the merchant into `merchant_dictionary`, so the same merchant resolves at zero tokens on every future screenshot — the dictionary grows from real confirmed answers instead of needing to be hand-seeded forever.
- **Minimum viable profile**: 3 screenshots. The proactive "here's what we found" deal push fires once, on the upload that crosses this threshold — not on every upload after.
- **Deal inventory scope**: restaurant/coffee/fast-casual only, matching Coop's existing deal supply — grocery/retail (Target, Walmart, etc.) is explicitly out of scope. `merchant_dictionary` is seeded accordingly (15 restaurant/coffee chains + Coop's 7 existing deal merchants).
- **"Similar or exact goods" matching**: EXACT = a deal at a merchant the profile has an actual screenshot from; SIMILAR = a deal whose merchant category overlaps one of the profile's top (recency-weighted) categories. Exact always outranks similar. (`backend/lib/profileDealMatch.js`)

**Pipeline stages built** (`backend/lib/`): ingest+approval gate (`accounts.js`) → OCR (`ocr.js`, Tesseract, local, zero tokens) → PII redaction (`redact.js`, regex, text-path only) → merchant dictionary + category (`merchantDictionary.js`, zero tokens on a hit) → item normalization cache (`itemNormalization.js`, batched model call on a cache miss only) → preference profile (`preferenceProfile.js`, pure aggregation, no model) → profile-scored deal retrieval (`profileDealMatch.js`, deterministic scoring, no model). Two model calls total, both gated behind a deterministic-first check, matching the pipeline's routing rule.

**Known gaps, not yet built:**
- **Stage 5 (regex line-item extraction)** — items are still extracted via a model call (`screenshotParser.js`'s text/image paths), not a bounding-box-paired regex extractor. This is a cost optimization, not an AC blocker; worth building once real volume makes the token cost worth trimming further.
- **Eval harness + cost/hit-rate instrumentation** — no fixed labeled screenshot set, no dictionary-hit-rate or cache-hit-rate tracking yet. Needed before tuning models/thresholds with confidence.
- **PII redaction gap** — only covers the OCR-text path; the low-OCR-confidence image fallback sends the raw image (with whatever PII is on it) directly to Claude. Flagged in `redact.js`, not fixed.
- **Ongoing proactive re-notification** — the current push is a one-time "you're in" moment at 3 uploads, not a recurring analysis job (unlike Calvin's cron). Revisit if/when Coop wants to keep surfacing new matches as more screenshots come in or new deals appear.

---

## Plaid onboarding flow (backlogged 2026-08-07)
The original self-serve onboarding — phone number → simulated location permission → simulated Plaid Link (bank search/login/linking/success) → handoff → straight into the live chat app with a proactive deal push — was built and briefly live at getcoop.cash. Superseded by the waitlist flow (name + phone → email to Donald → he manually triggers a welcome text) while screenshot upload (above) is designed as the real account-less onboarding path.

**Not deleted** — `src/pages/onboarding/PhoneStep.jsx`, `LocationStep.jsx`, `PlaidStep.jsx`, `HandoffStep.jsx` all still exist and work, just aren't wired into `OnboardingFlow.jsx`'s active chain anymore. Real Plaid Link integration (actual API credentials, actual bank connection) was never built regardless — the Plaid step was always simulated, per `backend/rcs/` and the whole project's "no real Plaid/Plaid Enrich/Square integrations yet" status.

**If ever resumed:** wire `PhoneStep`/`LocationStep`/`PlaidStep`/`HandoffStep` back into `OnboardingFlow.jsx` after `WaitlistStep`, or replace `PlaidStep` with a real Plaid Link SDK integration (needs `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV`, matching the shape of Calvin's plaid backlog item).
