export const FALLBACK_TRANSLATION_SCAN_MS = 1800
export const IDLESS_MESSAGE_CONFIRMATION_MS = 160
export const MAX_TRANSLATION_BATCH_MESSAGES = 8

export function newestFirst<T>(items: ReadonlyArray<T>, limit: number) {
  return [...items].reverse().slice(0, limit)
}

export function translationCacheScope(conversationId: string, messageId?: string) {
  return JSON.stringify([conversationId, messageId || 'content'])
}
