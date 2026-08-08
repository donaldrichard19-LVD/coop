# Coop

Coop is an AI-powered coupon and deals finder that lives entirely inside messaging apps. It watches the merchants a user already frequents — coffee shops, lunch spots, the pizza place they always order from — and proactively pushes deals for them, right in a normal text thread. No new app to open.

**Core loop:** connect a financial account (Plaid) → normalize transactions to merchants (Plaid Enrich) → filter to merchants with ≥1 visit in the trailing 6 months → check each against two deal-sourcing tracks → push matches proactively.

**Two-track deal sourcing:**
- **Track A** (built first) — chains/franchises with public loyalty/promo APIs, no merchant action needed.
- **Track B** — independent local merchants, opt-in via Square Loyalty, hand-picked in v1.

## Structure

```
src/            React 19 + Tailwind chat UI (web reference client)
backend/        Express (ESM) — RCS/Twilio channel: rcs/render.js, rcs/templates.js, routes/rcs.js
public/brand/   Logo and mark assets — see Brand below
```

The web app (`src/`) is a chat-first surface: a single conversation thread with inline deal cards, plus a Saved Deals view. It's the reference implementation of the matching logic (`src/data/deals.js`) that every messaging channel renders from.

The backend currently implements one channel — **RCS** (Android Messages), via Twilio's Content API — chosen first because there's already a Twilio relationship to reuse. WhatsApp and Apple Messages for Business are planned next, against the same shared `AssistantTurn` shape (`{ text, deals, overflowCount, quickReplies }`).

### Running it

```
npm install && npm run dev        # web app, localhost:5173
cd backend && npm install && npm test   # RCS renderer unit tests, no credentials needed
```

Sending a real RCS message additionally needs a Twilio account with RCS + Content API access and `backend/scripts/provisionTemplates.js` run once to create the message templates — see `backend/.env.example`.

## Brand

Coop's mark — codename **"Say Scan"** — is a chat bubble whose contents are a barcode: a message that's *also* a receipt. It's built to survive rendering as a 32–40px avatar next to the name "Coop" in a thread, which is where it lives almost all the time.

### Files

All assets are in [`public/brand/`](./public/brand):

| File | What it is |
|---|---|
| `coop-mark.svg` | The mark alone — green bubble, cream bars (default colorway) |
| `coop-mark-reversed.svg` | Cream bubble, ink bars — for green or photographic backgrounds |
| `coop-lockup-horizontal.svg` | Primary lockup: mark + "coop" wordmark, side by side |
| `coop-lockup-stacked.svg` | Mark above wordmark, reversed colorway, for square/vertical placements |
| `coop-lockup-small.svg` | ~36px-tall version for nav bars and footers |
| `coop-icon-ios.svg` | App-icon treatment — ink squircle, last bar in green, no bubble/tail |
| `coop-icon-android.svg` | Adaptive icon — full green circle, cream bars |
| `coop-icon-whatsapp.svg` | Full cream circle with a hairline border, ink bars |
| `coop-mark-{1024,512,192,180,96,48,32,20}.png` | Transparent-background PNG exports of the mark, one per common icon/favicon size |
| `coop-mark-animated.svg` | Hero/splash variant with the scan-line sweep — see Motion below |

`public/favicon.svg` is the mark at the 32px simplification tier (see below) — matches the size it actually renders at in a browser tab.

### Construction

The mark is two unioned shapes, both solid fills, no stroke:

- **Bubble** — rounded rectangle, aspect ratio 176:152, corner radius 27% of width on all four corners.
- **Tail** — a square 21.6% of the bubble's width, positioned 16% in from the left with its top flush against the bubble's bottom edge, bottom-left corner radius 73% of its own size, sheared `skewX(-14deg)`.

Inside the bubble: six vertical bars, centered as a set, fully rounded ends, one of them (the fourth) at 45% opacity so the rhythm doesn't read as a perfectly even grid — that's what keeps it looking like a barcode instead of an equalizer.

**The bar count is not a fixed asset scaled down.** It follows a mandatory simplification ladder — 6 bars at 176/96px, 4 at 52/32px, 3 at 20px — because a scaled-down 6-bar barcode turns to visual mud at avatar sizes. Every PNG export above was generated at its actual target size using the correct tier, not resized from one master file.

### Color

| Token | Hex | Use |
|---|---|---|
| `ink` | `#111112` | Dark surfaces, wordmark on light |
| `cream` | `#F5F2EA` | Light surfaces, bars on colored marks |
| `accent` (savings green) | `#0E7C57` | **Primary mark fill** |
| `pop` (ember) | `#C2410C` | Reserved — not used in the default mark |

One accent per surface: green mark on ink or cream; cream mark on green or ink. Never green-on-green.

The product UI's own interaction tint (`Tint.primary` in `src/index.css` / `tailwind.config.js`, and the RCS prototype's `--accent`) uses this same savings-green value — originally Ember, reconciled to match the brand mark. `Tint.cta` (button fill) stays adaptive black/white regardless, per the "Regulars" design system spec.

### Wordmark

Lowercase `coop`, **Archivo Expanded**, weight 900, `letter-spacing: -0.05em`. This is the design handoff's own stand-in choice, explicitly flagged as unconfirmed before production — treat it as a placeholder, not a locked decision. It's embedded as a live, editable `<text>` element (base64 webfont) in the lockup SVGs rather than outlined to vector paths, specifically so it stays easy to swap.

### Motion

`coop-mark-animated.svg` — **hero/splash use only, never on a chat avatar or anywhere small.** A single scan-line sweep, self-contained (CSS `@keyframes` inside the SVG's own `<style>`, no JS):

- A 3px-tall bar, full bubble width, `rgba(245,242,234,.9)`, glowing (`drop-shadow(0 0 18px …)` — the SVG equivalent of the spec's `box-shadow`), clipped to the bubble's own rounded silhouette so it never draws over the tail or outside the rounded corners.
- One 3.2s loop, `cubic-bezier(.5,0,.3,1)`, infinite: opacity 0→1 by 10%, travels down 48.68% of the bubble's height by 48%, fades back to 0 by 60%, holds invisible until it loops — the position reset happens during that invisible hold, so there's no visible snap.
- `@media (prefers-reduced-motion: reduce)` hides the scan-line entirely, leaving the plain static mark — no separate reduced-motion asset needed.

### Rules

- Clear space on all sides = one bar-width at that size.
- The tail always sits bottom-left. Never mirror, rotate, or detach it.
- Never change the bar rhythm or make the bars evenly spaced.
- Never outline the mark — it's always a solid fill.
- Never place the wordmark inside the bubble.

### Not yet built

- The three alternate logo routes from the original exploration (Smirk Code, Double-O Scan, Tear Here) — kept in the original handoff if direction ever changes.

## Backlog

See [BACKLOG.md](./BACKLOG.md).
