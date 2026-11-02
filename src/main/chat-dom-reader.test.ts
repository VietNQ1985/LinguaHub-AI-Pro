import { JSDOM } from 'jsdom'
import { expect, test } from 'vitest'
import { buildVisibleChatReadScript } from './chat-dom-reader'

function runPageScript(html: string, service: 'whatsapp' | 'teams') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true })
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const height = this.getAttribute('data-hidden') === 'true' ? 0 : 30
    const top = Number(this.getAttribute('data-top') || 10)
    return { x: 0, y: top, top, left: 0, right: 800, bottom: top + height, width: 800, height, toJSON() { return this } }
  }
  return { dom, result: dom.window.eval(buildVisibleChatReadScript(service)) as { conversationHint: string; messages: Array<{ text: string; side: string }> } }
}

test('reads only visible WhatsApp message bubble text and not chat list or hidden content', () => {
  const { dom, result } = runPageScript(`
    <aside>Sidebar text</aside>
    <main id="main">
      <header><span>Chat header</span></header>
      <div data-testid="conversation-panel-messages">
        <div data-pre-plain-text="[10:00] Alice:"><span class="selectable-text">Please send the updated file.</span></div>
        <div data-pre-plain-text="[10:01] Bob:" data-hidden="true"><span class="selectable-text">Hidden conversation text</span></div>
      </div>
    </main>`, 'whatsapp')

  expect(result.conversationHint).toContain('Chat header')
  expect(result.messages).toEqual([{ text: 'Please send the updated file.', side: 'center' }])
  dom.window.close()
})

test('returns a stable WhatsApp bubble id when the page supplies one',()=>{
  const {dom,result}=runPageScript('<main id="main"><div data-testid="conversation-panel-messages"><div data-pre-plain-text="[10:00] Alice:" data-id="wamid-abc"><span class="selectable-text">A stable message.</span></div></div></main>','whatsapp')
  expect(result.messages).toEqual([{text:'A stable message.',side:'center',id:'wamid-abc'}])
  dom.window.close()
})

test('reads a new WhatsApp bubble using another supported selector when older bubbles match the first selector',()=>{
  const {dom,result}=runPageScript(`
    <main id="main">
      <header><span>Chat header</span></header>
      <div data-testid="conversation-panel-messages">
        <div data-pre-plain-text="[10:00] Alice:"><span class="selectable-text">Earlier visible message.</span></div>
        <div data-testid="msg-container" class="message-in" data-id="wamid-new"><span class="selectable-text">New message in another markup shape.</span></div>
      </div>
    </main>`, 'whatsapp')

  expect(result.messages).toEqual([
    {text:'Earlier visible message.',side:'center'},
    {text:'New message in another markup shape.',side:'left',id:'wamid-new'},
  ])
  dom.window.close()
})

test('keeps the conversation identity stable when only the contact presence changes',()=>{
  const first=runPageScript('<main id="main"><header><span>Vinh Luong</span><span>online recently</span></header><div data-testid="conversation-panel-messages"></div></main>','whatsapp')
  const second=runPageScript('<main id="main"><header><span>Vinh Luong</span><span>last seen today at 18:10</span></header><div data-testid="conversation-panel-messages"></div></main>','whatsapp')
  expect(first.result.conversationHint).toBe('Vinh Luong')
  expect(second.result.conversationHint).toBe(first.result.conversationHint)
  first.dom.window.close()
  second.dom.window.close()
})

test('reads Teams message body nodes from the visible chat pane', () => {
  const { dom, result } = runPageScript(`
    <div data-tid="chat-pane-messageList">
      <div data-tid="chat-pane-message"><span class="sender">Alice</span><div data-tid="messageBodyContent">The meeting is moved to Friday.</div></div>
      <div data-tid="chat-pane-message" data-hidden="true"><div data-tid="messageBodyContent">Not visible</div></div>
    </div>
    <div data-tid="chat-list">Other chat preview</div>`, 'teams')

  expect(result.messages).toEqual([{ text: 'The meeting is moved to Friday.', side: 'center' }])
  expect(JSON.stringify(result)).not.toContain('Other chat preview')
  dom.window.close()
})

test('reads visible Teams v2 message-pane bubbles and excludes sender metadata', () => {
  const { dom, result } = runPageScript(`
    <header data-tid="chat-pane-header">Project chat</header>
    <div data-tid="message-pane-list-viewport">
      <div data-tid="chat-pane-item">
        <div data-tid="chat-pane-message">
          <span data-tid="message-author-name">Alex</span>
          <span dir="auto">Could you review the latest draft?</span>
        </div>
      </div>
      <div data-tid="chat-pane-item">
        <div data-tid="chat-pane-message" data-hidden="true">
          <span data-tid="message-author-name">Taylor</span>
          <span dir="auto">Hidden message text</span>
        </div>
      </div>
    </div>
    <div data-tid="chat-list">Other conversation preview</div>`, 'teams')

  expect(result.messages).toEqual([{ text: 'Could you review the latest draft?', side: 'center' }])
  expect(JSON.stringify(result)).not.toContain('Other conversation preview')
  expect(JSON.stringify(result)).not.toContain('Alex')
  dom.window.close()
})

test('limits page-side read script to supported chat services', () => {
  expect(buildVisibleChatReadScript('teams')).toContain('teams')
  expect(buildVisibleChatReadScript('whatsapp')).toContain('whatsapp')
})
