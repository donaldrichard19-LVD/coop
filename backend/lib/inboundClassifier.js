import { classifyCompliance } from './optOut.js'

// Story A9 — deterministic inbound-message classifier, pure and unit-testable without
// credentials (see inboundClassifier.test.js). Order, per the plan: compliance (A8) first,
// then acknowledgment/reaction patterns, then specific-offer replies, then meta-question
// canned responses, then a fall-through bucket ("search request or unclassifiable") that
// A14's on-demand retrieval handles — this module only needs to draw that boundary, not
// implement the model call itself.
//
// The compliance check here is a defensive safety net, not the primary path — in practice
// routes/rcs.js already runs lib/optOut.js's handleComplianceMessage before this classifier
// is ever reached, and that's the actual point where a STOP/START/HELP gets handled. This
// module never repeats that handling, only the classification.

const ACK_RE =
  /^(ok(ay)?|k|thanks?|thank you|thx|ty|cool|nice|great|awesome|sounds good|got it|sweet|perfect|lol+|haha+|yes|yep|yeah|no|nope|nah|👍|🙏|❤️)[.!?]*$/i

// "Specific-offer reply": a freeform reply to the most recently sent turn's deal card(s),
// resolved via the same phone -> last-sent-deals lookup session.js already maintains for
// button taps (lib/session.js#getLastTurnDeals) — this is the "existing session.js/
// last-sent-deal pattern" the plan calls for reusing, just matched against freeform text
// instead of a button's fixed ButtonPayload id.
const OFFER_REPLY_RE =
  /\b(save (it|that|this|the (first|second|1st|2nd) one)|i(?:'|’)?ll take (it|that|the (first|second|1st|2nd) one)|the (first|second|1st|2nd) one( please)?|that one please|i want (it|that))\b/i
const ORDINAL_SECOND_RE = /\b(second|2nd)\b/i

const META_QUESTION_RE =
  /\b(how does (this|coop) work|what is coop|who are you|is (this|coop) free|how do i (unsubscribe|opt out)|is this (real|legit)|are you (a )?(bot|human)|what do you do|how do you know (this|my orders?))\b/i

/**
 * body: raw inbound message text. hasPendingTurn: whether session.js has a recorded last
 * turn for this phone (i.e. getLastTurnDeals(phone) would return something) — offer replies
 * only classify as such when there's actually something to resolve against, otherwise "the
 * first one" with no prior context falls through to search/unclassifiable instead of
 * silently matching nothing.
 *
 * Returns one of:
 *   { type: 'compliance' }
 *   { type: 'acknowledgment' }
 *   { type: 'offer_reply', ordinal: 0 | 1 }
 *   { type: 'meta_question', question }
 *   { type: 'search_or_unclassifiable' }
 */
export function classifyInbound(body, { hasPendingTurn = false } = {}) {
  const text = String(body || '').trim()
  if (!text) return { type: 'search_or_unclassifiable' }

  if (classifyCompliance(text)) return { type: 'compliance' }

  if (ACK_RE.test(text)) return { type: 'acknowledgment' }

  if (hasPendingTurn && OFFER_REPLY_RE.test(text)) {
    const ordinal = ORDINAL_SECOND_RE.test(text) ? 1 : 0
    return { type: 'offer_reply', ordinal }
  }

  if (META_QUESTION_RE.test(text)) return { type: 'meta_question', question: text }

  return { type: 'search_or_unclassifiable' }
}

const META_ANSWERS = [
  { match: /how does (this|coop) work/i, answer: "we watch the spots you already order from and text you deals for them, no app, just texts." },
  { match: /what is coop/i, answer: 'coop finds deals at places you already order from and texts them to you.' },
  { match: /who are you/i, answer: "i'm coop, i find deals at your regular spots and text them over." },
  { match: /is (this|coop) free/i, answer: 'yep, free to use. standard msg & data rates may apply.' },
  { match: /is this (real|legit)/i, answer: 'real deal, literally. we partner with local spots and chains to get you real offers.' },
  { match: /are you (a )?(bot|human)/i, answer: "mostly automated, with a human keeping an eye on things." },
  { match: /what do you do/i, answer: 'we text you deals at places you already order from.' },
  { match: /how do you know (this|my orders?)/i, answer: "you told us, via screenshots you've sent in, nothing pulled without you sharing it." },
]

/** Deterministic canned reply for a classified meta_question — no model call. */
export function cannedMetaAnswer(question) {
  const hit = META_ANSWERS.find((m) => m.match.test(question))
  return hit ? hit.answer : 'good question, we find deals at spots you already order from and text them over.'
}
