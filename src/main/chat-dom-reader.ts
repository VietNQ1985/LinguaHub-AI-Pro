export type ChatService = 'whatsapp' | 'teams'
export type ChatDomMessage = { text: string; side: 'left' | 'right' | 'center'; id?: string }
export type ChatDomSnapshot = { conversationHint: string; messages: ChatDomMessage[] }

/** Builds a fixed, read-only script for the embedded service page. It never accepts page code from the renderer. */
export function buildVisibleChatReadScript(service: ChatService) {
  return `(${readVisibleChatPage.toString()})(${JSON.stringify(service)})`
}

function readVisibleChatPage(service: ChatService): ChatDomSnapshot {
  const visibleWithin = (element: Element, clip?: DOMRect) => {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.opacity !== '0'
      && rect.width > 0
      && rect.height > 0
      && rect.bottom > (clip?.top ?? 0)
      && rect.top < (clip?.bottom ?? window.innerHeight)
      && rect.right > (clip?.left ?? 0)
      && rect.left < (clip?.right ?? window.innerWidth)
  }

  const first = (selectors: string[], root: ParentNode = document) => {
    for (const selector of selectors) {
      const found = root.querySelector(selector)
      if (found) return found
    }
    return null
  }

  const root = service === 'whatsapp'
    ? first(['#main [data-testid="conversation-panel-messages"]', '#main [aria-label*="message list" i]', '#main'])
    : first(['[data-tid="message-pane-list-viewport"]', '[data-tid="message-pane-body"]', '[data-tid="chat-pane-messageList"]', '[data-tid="chat-pane-message-list"]', '[role="log"]', '[data-tid="chat-pane"]'])

  if (!root) return { conversationHint: '', messages: [] }
  const clip = root instanceof Element ? root.getBoundingClientRect() : undefined
  const bubbleSelectors = service === 'whatsapp'
    ? ['[data-pre-plain-text]', '[data-id].message-in, [data-id].message-out', '[data-testid*="msg-container"]']
    : ['[data-tid="chat-pane-message"]', '[data-tid="message"]', '[data-message-id]', '[role="listitem"]']
  let bubbles = Array.from(root.querySelectorAll(bubbleSelectors.join(',')))
    .filter(element => visibleWithin(element, clip))

  // Keep outer message bubbles only; nested Teams content containers can match the same selectors.
  bubbles = bubbles.filter(element => !bubbles.some(other => other !== element && other.contains(element)))
  const contentSelectors = service === 'whatsapp'
    ? ['.selectable-text', '[dir="auto"]']
    : ['[data-tid="messageBodyContent"]', '[data-tid="message-body"]', '[data-tid*="messageBody"]', '.message-body-content', '[dir="auto"]']
  const messages: ChatDomMessage[] = []
  const seen = new Set<string>()
  for (const bubble of bubbles.slice(-60)) {
    let content: Element[] = []
    for (const selector of contentSelectors) {
      content = Array.from(bubble.querySelectorAll(selector)).filter(element => visibleWithin(element, clip))
      if (content.length) break
    }
    // Use deepest text-bearing nodes to avoid repeating parent and child text.
    content = content.filter(element => !content.some(other => other !== element && other.contains(element)))
    const text = (content.length ? content : [bubble])
      .map(element => (element as HTMLElement).innerText || element.textContent || '')
      .join('\n')
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000)
    if (text.length < 2) continue
    const rect = bubble.getBoundingClientRect()
    const key = `${Math.round(rect.left / 8)}:${Math.round(rect.top / 8)}:${text}`
    if (seen.has(key)) continue
    seen.add(key)
    const className = typeof bubble.className === 'string' ? bubble.className : ''
    const side = /message-out|message-self|own-message/i.test(className) ? 'right' : /message-in|message-other/i.test(className) ? 'left' : 'center'
    const stableId = [bubble.getAttribute('data-id'), bubble.getAttribute('data-message-id'), bubble.id]
      .map(value => value?.trim() || '')
      .find(value => value.length >= 1 && value.length <= 200)
    messages.push({ text, side, ...(stableId ? { id: stableId } : {}) })
  }

  const header = service === 'whatsapp'
    ? first(['#main header', '#main [data-testid="conversation-info-header"]'])
    : first(['[data-tid="chat-pane-header"]', 'main header', '[role="main"] header'])
  const headerElement = header as HTMLElement | null
  const stableConversationId = ['data-conversation-id', 'data-chat-id', 'data-thread-id', 'data-id']
    .map(name => header?.getAttribute(name)?.trim() || '')
    .find(value => value.length >= 1 && value.length <= 200)
  const stableConversationLabel = [header?.getAttribute('aria-label'), header?.getAttribute('title')]
    .map(value => value?.trim() || '')
    .find(value => value.length >= 1 && value.length <= 200)
  const browserHeaderLine = headerElement?.innerText?.split('\n').map(line => line.trim()).find(Boolean)
  const primaryHeaderLine = (browserHeaderLine || header?.firstElementChild?.textContent || header?.textContent || '')
    .replace(/\s+/g, ' ').trim().slice(0, 200)
  const conversationHint = stableConversationId ? `id:${stableConversationId}` : stableConversationLabel ? `label:${stableConversationLabel}` : primaryHeaderLine

  return { conversationHint, messages }
}
