/**
 * Distinguish two visible chat bubbles even when their text is identical.
 * Keys are ephemeral and scoped to one OCR snapshot/conversation.
 * They must never be used as long-lived cross-scroll message identifiers.
 */
export function messageIdentityKeys(messages: ReadonlyArray<{ text: string }>): string[] {
  const occurrences = new Map<string, number>()
  return messages.map(message => {
    const normalized = message.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
    const occurrence = (occurrences.get(normalized) ?? 0) + 1
    occurrences.set(normalized, occurrence)
    return JSON.stringify([normalized, occurrence])
  })
}
