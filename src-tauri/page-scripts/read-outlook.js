(function readOutlookMail() {
  const empty = { conversationHint: '', messages: [] }
  if (!['outlook.office.com', 'outlook.office365.com', 'outlook.live.com'].includes(location.hostname)) return empty
  const visible = (element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 &&
      rect.left < innerWidth && rect.right > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }
  const selectors = [
    '[data-testid="message-body"]',
    '[data-testid="messageBody"]',
    '[aria-label="Message body"]',
    '[aria-label="Nội dung thư"]',
    '[data-app-section="MailReadCompose"] [role="document"]',
    '[class*="ReadingPane"] [role="document"]',
    '[role="main"] [role="document"]',
    '[class*="ReadingPane"] .allowTextSelection',
  ]
  let body
  for (const selector of selectors) {
    const candidates = [...document.querySelectorAll(selector)].filter(element =>
      visible(element) && !element.closest('[contenteditable="true"], [role="textbox"], [aria-hidden="true"]'))
    // The reader can include multiple mails in a conversation: use only the last visible one.
    const candidate = candidates.filter(element => (element).innerText?.trim().length >= 2).at(-1)
    if (candidate) { body = candidate; break }
  }
  if (!body) return empty
  const copy = body.cloneNode(true)
  copy.querySelectorAll('script,style,button,input,textarea,select,[contenteditable="true"],[aria-hidden="true"],[role="toolbar"],[role="navigation"]').forEach(node => node.remove())
  const text = (copy.innerText || copy.textContent || '').replace(/\r/g, '')
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n').slice(0, 4000)
  if (text.length < 2) return empty
  const pane = body.closest('[class*="ReadingPane"],[data-app-section="MailReadCompose"],[role="main"]') || body.parentElement || body
  const heading = [...pane.querySelectorAll('[role="heading"],h1,h2,[data-testid="message-subject"]')]
    .filter(visible).map(node => (node.textContent || '').trim()).find(Boolean) || ''
  const subject = heading.slice(0, 140)
  // Content contributes to identity, so changing the opened mail resets the translation.
  // No sender address or private content is emitted in logs/telemetry.
  const hint = (subject + ':' + text.slice(0, 120)).slice(0, 200)
  return { conversationHint: hint, messages: [{ text: subject ? ('Subject: ' + subject + '\n' + text).slice(0, 4000) : text, side: 'center' }] }
})()
