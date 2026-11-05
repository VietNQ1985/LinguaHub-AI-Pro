// Intentionally static, read-only, no arbitrary input from UI.
// Runs in the remote WebView2 page using eval_with_callback. Do not modify DOM.
const visible = (element) => {
  if (!(element instanceof Element)) return false;
  const rect = element.getBoundingClientRect();
  const st = getComputedStyle(element);
  return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0'
    && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
};
const rootSelectors = {
  whatsapp: ['#main [data-testid="conversation-panel-messages"]', '#main'],
  teams: ['[data-tid="message-pane-list-viewport"]', '[data-tid="message-pane-body"]', '[role="log"]'],
  zalo: ['#messageViewScroll'],
  outlook: ['[data-app-section="MailReadCompose"]', '[role="main"]'],
};
const bubbleSelectors = {
  whatsapp: '[data-pre-plain-text], [data-id].message-in, [data-id].message-out, [data-testid*="msg-container"]',
  teams: '[data-tid="chat-pane-message"], [data-tid="message"], [data-message-id], [role="listitem"]',
  zalo: '.chat-item',
  outlook: '[aria-label="Message body" i], [data-testid="message-body"], [role="document"]',
};
const root = rootSelectors[SERVICE]?.map(s => document.querySelector(s)).find(Boolean);
if (!root) return { conversationHint: '', messages: [] };
let bubbles = [...root.querySelectorAll(bubbleSelectors[SERVICE])].filter(visible).slice(-60);
bubbles = bubbles.filter(a => !bubbles.some(b => b !== a && b.contains(a)));
const messages = [];
const seen = new Set();
for (const el of bubbles) {
  const selectors = SERVICE === 'whatsapp' ? '.selectable-text, [dir="auto"]'
    : SERVICE === 'teams' ? '[data-tid="messageBodyContent"], [data-tid="message-body"], [dir="auto"]'
    : SERVICE === 'zalo' ? '[data-component="message-text-content"]' : '[role="document"], p';
  const nodes = [...el.querySelectorAll(selectors)].filter(visible);
  const deepest = nodes.filter(a => !nodes.some(b => b !== a && b.contains(a)));
  const raw = (deepest.length ? deepest : [el]).map(n => n.innerText || n.textContent || '').join('\n');
  const text = raw.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, 4000);
  if (text.length < 2) continue;
  const rect = el.getBoundingClientRect();
  const key = Math.round(rect.top / 8) + ':' + text;
  if (seen.has(key)) continue;
  seen.add(key);
  const c = typeof el.className === 'string' ? el.className : '';
  let side = SERVICE === 'zalo'
    ? (el.classList.contains('me') ? 'right' : 'left')
    : /message-out|message-self|own-message/.test(c) ? 'right'
    : /message-in|message-other/.test(c) ? 'left' : 'center';
  if (side === 'center' && SERVICE === 'whatsapp') side = rect.left > innerWidth / 2 ? 'right' : 'left';
  const id = [el.getAttribute('data-id'), el.getAttribute('data-message-id'), el.id]
    .find(v => typeof v === 'string' && v.length > 0 && v.length <= 200);
  messages.push({ text, side, ...(id ? { id } : {}) });
}
const headerSelectors = {
  whatsapp: ['#main header'],
  teams: ['[data-tid="chat-pane-header"]', 'main header'],
  zalo: ['header#header .header-title'],
  outlook: ['[role="heading"]', 'h1'],
};
const header = headerSelectors[SERVICE].map(s => document.querySelector(s)).find(Boolean);
const hint = (header?.getAttribute('data-conversation-id') || header?.getAttribute('data-chat-id')
 || header?.getAttribute('aria-label') || header?.innerText || header?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
return { conversationHint: hint, messages };
