// Twilio Content API template definitions for the RCS channel.
//
// Grounded against Twilio's docs (fetched 2026-08-06):
//   - twilio/card:     https://www.twilio.com/docs/content/twiliocard
//   - twilio/carousel: (Content API, same card shape nested under `cards`)
//   - twilio/quick-reply does NOT support RCS (WhatsApp/Messenger only) — confirmed via
//     https://www.twilio.com/docs/content/twilio-quick-reply — which is why "chip" turns
//     below are built as `twilio/card` (body + chip_list actions) rather than quick-reply.
//
// Confirmed limits used here: title <=200 chars, subtitle <=60, body <=1600 (RCS-only field),
// QUICK_REPLY title <=20, URL title <=25, up to 4 actions per rich card.
//
// NOT independently confirmed — verify in Twilio's console/testing tool before going live:
//   - Exact rendering of `chip_list: true` (assumed to render as a suggested chip below the
//     card rather than an in-card button; inferred from the field existing on the action
//     object, not from a worked example).
//
// One deliberate product decision baked in here: RCS chip titles are NOT populated from
// arbitrary per-turn text. Coop's quick replies are already a small fixed set (see
// ../../src/data/deals.js `quickReplies` and Chat.jsx's `FOLLOW_UPS`), so these two chip
// templates are fully static — no unconfirmed variable-substitution-in-action-title risk.

export const CARD_TEMPLATE = {
  friendly_name: 'coop_rcs_card',
  language: 'en',
  variables: {
    1: 'offer title',
    2: 'merchant meta subtitle',
    3: 'savings / expiry / code body',
    4: 'directions url',
  },
  types: {
    'twilio/card': {
      title: '{{1}}',
      subtitle: '{{2}}',
      body: '{{3}}',
      actions: [
        { type: 'QUICK_REPLY', title: 'save it', id: 'save_0' },
        { type: 'URL', title: 'directions', url: '{{4}}' },
      ],
    },
  },
}

export const CAROUSEL_TEMPLATE = {
  friendly_name: 'coop_rcs_carousel_2',
  language: 'en',
  variables: {
    1: 'card 1 title',
    2: 'card 1 subtitle',
    3: 'card 1 body',
    4: 'card 1 directions url',
    5: 'card 2 title',
    6: 'card 2 subtitle',
    7: 'card 2 body',
    8: 'card 2 directions url',
  },
  types: {
    'twilio/carousel': {
      cards: [
        {
          title: '{{1}}',
          subtitle: '{{2}}',
          body: '{{3}}',
          actions: [
            { type: 'QUICK_REPLY', title: 'save it', id: 'save_0' },
            { type: 'URL', title: 'directions', url: '{{4}}' },
          ],
        },
        {
          title: '{{5}}',
          subtitle: '{{6}}',
          body: '{{7}}',
          actions: [
            { type: 'QUICK_REPLY', title: 'save it', id: 'save_1' },
            { type: 'URL', title: 'directions', url: '{{8}}' },
          ],
        },
      ],
    },
  },
}

// Matches the *opening* quick replies in src/data/deals.js `quickReplies` (first 3 shown).
export const CHIPS_OPENING_TEMPLATE = {
  friendly_name: 'coop_rcs_chips_opening',
  language: 'en',
  variables: {},
  types: {
    'twilio/card': {
      body: 'Try asking:',
      actions: [
        { type: 'QUICK_REPLY', title: "What's good tonight?", id: 'qr_tonight', chip_list: true },
        { type: 'QUICK_REPLY', title: 'Anything expiring?', id: 'qr_expiring', chip_list: true },
        { type: 'QUICK_REPLY', title: 'Coffee deals only', id: 'qr_coffee', chip_list: true },
      ],
    },
  },
}

// Matches Chat.jsx's FOLLOW_UPS constant (post-answer follow-up chips).
export const CHIPS_FOLLOWUP_TEMPLATE = {
  friendly_name: 'coop_rcs_chips_followup',
  language: 'en',
  variables: {},
  types: {
    'twilio/card': {
      body: 'What next?',
      actions: [
        { type: 'QUICK_REPLY', title: 'Only chain deals', id: 'qr_chain', chip_list: true },
        { type: 'QUICK_REPLY', title: 'Only local spots', id: 'qr_local', chip_list: true },
        { type: 'QUICK_REPLY', title: 'Something cheaper', id: 'qr_cheaper', chip_list: true },
        { type: 'QUICK_REPLY', title: "What else is close?", id: 'qr_more', chip_list: true },
      ],
    },
  },
}

// The one place a per-turn variable feeds an action-adjacent field: unlike
// the chip templates above, this one *needs* dynamic text ("is this
// Chipotle?") since the merchant guess varies per screenshot — but the risk
// flagged at the top of this file was variable substitution inside an
// action *title*, not inside `body`. The two QUICK_REPLY titles here stay
// static ("yes"/"no"), same guarantee as every other chip in this file.
export const CONFIRM_MERCHANT_TEMPLATE = {
  friendly_name: 'coop_rcs_confirm_merchant',
  language: 'en',
  variables: {
    1: 'confirmation question body',
  },
  types: {
    'twilio/card': {
      body: '{{1}}',
      actions: [
        { type: 'QUICK_REPLY', title: 'yes', id: 'confirm_yes' },
        { type: 'QUICK_REPLY', title: 'no', id: 'confirm_no' },
      ],
    },
  },
}

export const ALL_TEMPLATES = {
  card: CARD_TEMPLATE,
  carousel: CAROUSEL_TEMPLATE,
  chipsOpening: CHIPS_OPENING_TEMPLATE,
  chipsFollowup: CHIPS_FOLLOWUP_TEMPLATE,
  confirmMerchant: CONFIRM_MERCHANT_TEMPLATE,
}
