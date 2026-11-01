export const FALLBACK_TRANSLATION_SCAN_MS = 1800
export const IDLESS_MESSAGE_CONFIRMATION_MS = 160
export const PRIORITY_TRANSLATION_BATCH_MESSAGES = 1
export const MAX_TRANSLATION_BATCH_MESSAGES = 4

export function newestFirst<T>(items: ReadonlyArray<T>, limit: number) {
  return [...items].reverse().slice(0, limit)
}

export function nextTranslationBatch<T>(items: ReadonlyArray<T>, priorityKey: string | null, keyOf: (item: T) => string, prioritizeNewest = false) {
  const pending = newestFirst(items, MAX_TRANSLATION_BATCH_MESSAGES)
  if (!pending.length) return null
  const priority = priorityKey === null ? undefined : pending.find(item => keyOf(item) === priorityKey)
  const first = priority || (prioritizeNewest ? pending[0] : undefined)
  if (first) return { lane: 'priority' as const, messages: [first].slice(0, PRIORITY_TRANSLATION_BATCH_MESSAGES) }
  return { lane: 'backlog' as const, messages: pending }
}

export function translationCacheScope(conversationId: string, messageId?: string) {
  return JSON.stringify([conversationId, messageId || 'content'])
}
