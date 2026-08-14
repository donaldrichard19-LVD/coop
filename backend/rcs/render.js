import { ALL_TEMPLATES } from './templates.js'

const MAPS_BASE = 'https://www.google.com/maps/search/?api=1&query='

function directionsUrl(merchantName) {
  return MAPS_BASE + encodeURIComponent(merchantName)
}

function subtitle(deal) {
  // RCS subtitle cap is 60 chars — trim the meta line if a merchant name runs long.
  const raw = `${deal.merchant.visitCount} visits since ${deal.merchant.firstVisit} · ${deal.merchant.distance}`
  return raw.length <= 60 ? raw : raw.slice(0, 57) + '…'
}

function cardBody(deal) {
  const lines = [`Save ~$${deal.savingsAmount.toFixed(2)}`]
  if (deal.originalPrice != null) lines.push(`(was $${deal.originalPrice.toFixed(2)})`)
  lines.push(deal.endsLabel)
  if (deal.code) lines.push(`Code: ${deal.code}`)
  return lines.join(' · ')
}

function cardVariables(deal, offset) {
  return {
    [offset + 1]: deal.offer,
    [offset + 2]: subtitle(deal),
    [offset + 3]: cardBody(deal),
    [offset + 4]: directionsUrl(deal.merchant.name),
  }
}

/**
 * Pure — no network calls, no Twilio SDK. Given an AssistantTurn (same shape the web
 * Chat page builds from matchDeals()), returns an ordered array of message specs ready
 * to hand to lib/twilioClient.js's sendRcsTurn(). Kept separate from the actual send so
 * it's fully unit-testable without credentials — see render.test.js.
 *
 * Mirrors the web thread's visual order: prose -> card(s) -> quick replies.
 */
export function renderTurnAsRCS(turn, { templateSids, isFirstTurn = false } = {}) {
  const messages = []

  if (turn.text) {
    const overflowNote =
      turn.overflowCount > 0
        ? ` (+${turn.overflowCount} more, just ask)`
        : ''
    messages.push({ kind: 'text', body: turn.text + overflowNote })
  }

  const deals = turn.deals ?? []
  if (deals.length === 1) {
    messages.push({
      kind: 'template',
      template: 'card',
      contentSid: templateSids?.card,
      contentVariables: cardVariables(deals[0], 0),
    })
  } else if (deals.length === 2) {
    messages.push({
      kind: 'template',
      template: 'carousel',
      contentSid: templateSids?.carousel,
      contentVariables: {
        ...cardVariables(deals[0], 0),
        ...cardVariables(deals[1], 4),
      },
    })
  } else if (deals.length > 2) {
    throw new Error('renderTurnAsRCS: turn.deals must have at most 2 entries (Coop hard rule)')
  }

  if (turn.quickReplies?.length) {
    messages.push({
      kind: 'template',
      template: isFirstTurn ? 'chipsOpening' : 'chipsFollowup',
      contentSid: isFirstTurn ? templateSids?.chipsOpening : templateSids?.chipsFollowup,
      contentVariables: {},
    })
  }

  return messages
}

export const templateDefinitions = ALL_TEMPLATES
