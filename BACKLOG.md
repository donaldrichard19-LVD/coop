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

**Known gaps, closed 2026-08-11** (built as part of the Engagement Logic build pass — see below):
- **Stage 5 regex-first line-item extraction** — `lib/lineItemExtractor.js` pairs OCR bounding boxes with price tokens before falling back to the model call; falls through to the existing model path unchanged when regex recovers too few/inconsistent items.
- **Eval harness + cost/hit-rate instrumentation** — `scripts/evalScreenshotPipeline.js` + `eval/screenshots/*.json` (190 fixtures, synthetic — see note below), plus dictionary-hit-rate (by platform) and item-normalization cache-hit-rate tracking via `lib/pipelineMetrics.js`.
- **PII redaction gap** — the low-OCR-confidence image fallback now redacts before the image reaches Claude (`lib/redactImage.js`, using `sharp`). Coverage is honestly scoped to what's still detectable from the low-confidence OCR pass — documented in code, not overclaimed.
- **Ongoing proactive re-notification** — `maybePushProfileMatches` (`routes/rcs.js`) now runs on every upload past `MIN_UPLOADS_FOR_PROFILE`, not just the one that first crosses it, deduping against `surfaced_deals` so the same deal isn't re-pushed. Still upload-triggered only, not a periodic re-scan for new inventory appearing with no new upload — that's a larger, separate capability, deferred.

**Still open:**
- **RCS confirm-chip template not provisioned** — `RCS_TEMPLATE_CONFIRM_MERCHANT_SID` isn't set on Render. Needs `npm run provision:rcs` run with real Twilio credentials, then the resulting SID added to Render's env vars. Pure ops task, no code blocker — the confirm flow degrades gracefully (logs "would have sent") until then.
- **Eval fixtures are synthetic** (`eval/screenshots/*.json`, `eval/intentExtraction/*.json`) — representative placeholders, not real logged data. Swap in real screenshots/messages once there's production volume to draw from.
- P2/P3 items from the original build-guidance doc, not in scope for this pass: platform coverage expansion, direct-order/POS receipt formats, dark mode/photo-of-screen handling, multi-screenshot order stitching, non-English menu handling, cross-user dish cache warming, dictionary auto-expansion from corrections, smaller model tier once eval scores hold. Grocery/retail remains explicitly deferred.

---

## Engagement Logic — proactive outbound cadence + inbound SMS handling (built 2026-08-11)
Two-sends-per-week proactive deal texts, hard/soft opt-out compliance, and a deterministic-classifier-first inbound pipeline so the outbound side costs zero model tokens and the model only runs on user-initiated search/ambiguous-feedback replies.

**Status: P0 + P1 + P2 built**, following the build-guidance doc's routing rule (outbound = deterministic scheduler/suppression/scoring/templates; inbound = deterministic classifier first, model call only for search extraction or unclassifiable/ambiguous-negative feedback). Live in production as of 2026-08-11 — `node-cron` scheduler runs in-process inside `coop-backend`, all migrations applied, currently 0 approved accounts so nothing sends until Donald approves one.

**P0 built:** scheduler (`lib/engagementScheduler.js`, fixed 2x/week, Mon/Thu), suppression gate (`lib/engagementSuppression.js` — hard opt-out, quiet hours via real per-account timezone, soft-opt-out state, frequency cap, inventory floor, `MIN_UPLOADS_FOR_PROFILE` gate), slot policy (`lib/engagementSlotPolicy.js`), deterministic linear scoring (`lib/engagementScoring.js`), repetition guard (`lib/engagementRepetition.js`), 54-message template library (`rcs/engagementTemplates.js` + `rcs/engagementRender.js`, reuses already-provisioned RCS card templates — no new Twilio provisioning needed), send + logging (`lib/engagementSend.js`), hard opt-out/compliance (`lib/optOut.js` — STOP/START/HELP family, regex-first, runs before the account-approval gate, fails safe on DB error), consent record (`lib/consent.js`, written at Donald's approval step), inbound deterministic classifier (`lib/inboundClassifier.js`).

**P1 built:** soft opt-out preference ladder (`lib/softOptOut.js` — cadence/window/cuisine/merchant/radius/snooze levers, keyword-matched, ambiguous negative feedback routed to a dedicated model call defaulting toward suppression), cadence decay (`lib/cadenceDecay.js` — 4 consecutive non-engaged sends steps cadence down; "engaged" = any non-compliance inbound message; evaluated via a 48-hour sweep riding the scheduler's cron tick, not an event hook), opt-out attribution (`lib/optOutInstrumentation.js`), intent extraction (`lib/intentExtraction.js`, structured JSON filters only, in-the-moment constraints override profile, nulls widen rather than guess), on-demand retrieval + reply (`lib/onDemandRetrieval.js`, reuses A4's scoring, doesn't count against the frequency cap, echoes interpreted constraints back), eval harness (`scripts/evalIntentExtraction.js` + `eval/intentExtraction/*.json`, synthetic).

**P2 built:** pre-emptive off-ramp (`lib/offRamp.js` — fires once per non-engagement streak at 2 consecutive non-engaged sends, before decay's automatic step-down at 4; logged to its own `off_ramp_events` table, distinct from a decay event since one's an offer and the other's automatic), per-user day/time optimization (`lib/orderTimestamp.js` regex-first extraction of the receipt's actual order date/time + model fallback, feeding a day-of-week histogram in `preferenceProfile.js`, consumed by `lib/engagementDayOptimization.js` to pick real send days once there's enough signal, falling back to fixed Mon/Thu or Mon/Wed/Fri otherwise), earned third weekly send (`lib/thirdSendEligibility.js` — engaged with ≥1 of the last 3 scheduled sends, continuously re-evaluated, subordinate to cadence decay, tracked as a separate `earned_third_send` column so earning and decaying never collide), repetition-guard tuning (`engagementScoring.js`'s `RECENT_MERCHANT_PENALTY` soft-dampens same-merchant repeats on top of the existing hard exact-deal exclusion; `engagementRepetition.js`'s window scales down for 3x/week accounts), control group (`lib/controlGroup.js` — 10% of accounts via a deterministic hash of `account_id`, get fixed generic scoring instead of profile-weighted, excluded from the 3rd send and day/time personalization).

**Resolved decisions:**
- **Location/timezone gap**: `accounts` had no location data at all. Added `zip_code`/`timezone` columns, captured at Donald's manual approval step, timezone derived from a static zip-prefix lookup (`lib/zipTimezone.js`) — powers real quiet-hours suppression.
- **Geo-radius filtering**: `merchants` still has no coordinates (only free-text `distance_label`, a known single-global-value limitation predating this feature). `isWithinRadius()` in `engagementScoring.js` is a named, permissive pass-through — every candidate passes — not a silent stub, ready to swap in a real check once merchant geocoding exists.
- **Proactive template copy must not assert `{distance}`**: `distance_label` is a single value shared across every account, so several draft templates stating "0.4 mi away" as fact in an unprompted text were caught and fixed — `{distance}` was removed from every proactive-engagement template before ship (reactive deal-card display, which is pre-existing/unrelated behavior, was left untouched).
- **Cadence-decay engagement definition**: any non-compliance inbound message counts (including bare acknowledgments), resolving an inconsistency where A9's classifier already treated acknowledgments as a positive signal but an earlier draft of the decay module didn't.
- **Third-send engagement attribution**: reuses `cadenceDecay.js`'s single rolling `last_engaged_at` timestamp rather than building true per-send attribution — a send in the rolling window counts as engaged if `last_engaged_at` falls inside that send's own window. An approximation, not exact, but self-corrects every tick since the window keeps sliding forward.

**New known gap, found during P2 (not yet fixed):**
- **`order_timestamp` is stored/read as UTC but is actually the receipt's local printed wall-clock time.** `preferenceProfile.js`'s day-of-week histogram uses `getUTCDay()`, so an order near local midnight can bucket into the wrong day. Fixable using `accounts.timezone` (already captured for quiet-hours) — not yet wired in. Not a launch blocker: worst case is a slightly-off day pick for the personalization this same feature adds, not a broken send. Also worth knowing: none of the existing `eval/screenshots/*.json` fixtures contain a printed order date/time, so the regex-first extraction path in `lib/orderTimestamp.js` is untested against real receipt formats — it currently falls through to the model fallback 100% of the time on the fixtures that exist today.

**Still open / deferred to P3, per the build-guidance doc's own phasing:**
- Classifier coverage expansion from real logged inbound traffic, template library expansion, scoring weights tuned per segment.
- Real merchant geocoding to make geo-radius filtering non-permissive (see above — larger, separate project).
- Real eval data: both `eval/intentExtraction/*.json` (~151 messages) and `eval/screenshots/*.json` (190 cases) are synthetic, not real logged data. Swap in real data once there's production volume.

---

## Plaid onboarding flow (backlogged 2026-08-07)
The original self-serve onboarding — phone number → simulated location permission → simulated Plaid Link (bank search/login/linking/success) → handoff → straight into the live chat app with a proactive deal push — was built and briefly live at getcoop.cash. Superseded by the waitlist flow (name + phone → email to Donald → he manually triggers a welcome text) while screenshot upload (above) is designed as the real account-less onboarding path.

**Not deleted** — `src/pages/onboarding/PhoneStep.jsx`, `LocationStep.jsx`, `PlaidStep.jsx`, `HandoffStep.jsx` all still exist and work, just aren't wired into `OnboardingFlow.jsx`'s active chain anymore. Real Plaid Link integration (actual API credentials, actual bank connection) was never built regardless — the Plaid step was always simulated, per `backend/rcs/` and the whole project's "no real Plaid/Plaid Enrich/Square integrations yet" status.

**If ever resumed:** wire `PhoneStep`/`LocationStep`/`PlaidStep`/`HandoffStep` back into `OnboardingFlow.jsx` after `WaitlistStep`, or replace `PlaidStep` with a real Plaid Link SDK integration (needs `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV`, matching the shape of Calvin's plaid backlog item).
