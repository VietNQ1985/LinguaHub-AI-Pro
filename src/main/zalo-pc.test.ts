import { JSDOM } from 'jsdom'
import { expect, test } from 'vitest'
import { buildCallScript, buildOpenSearchResultScript } from './zalo-pc'

test('presses only Zalo PC header call buttons and reports when a group chat has none', () => {
  const dom = new JSDOM('<header id="header"><div data-translate-title="STR_VOICE_CALL"></div><div data-translate-title="STR_VIDEO_CALL"></div></header>', { runScripts: 'outside-only' })
  const clicked: string[] = []
  dom.window.document.querySelectorAll('[data-translate-title]').forEach(element => element.addEventListener('click', () => clicked.push(element.getAttribute('data-translate-title')!)))
  expect(dom.window.eval(buildCallScript('video'))).toBe(true)
  expect(clicked).toEqual(['STR_VIDEO_CALL'])
  const group = new JSDOM('<header id="header"><div data-translate-title="STR_SEARCH_MESSAGE_TITLE"></div></header>', { runScripts: 'outside-only' })
  expect(group.window.eval(buildCallScript('voice'))).toBe(false)
  dom.window.close(); group.window.close()
})

test('opens a Zalo PC search result only when exactly one name matches', () => {
  const row = (name: string) => `<div class="conv-item"><div class="conv-item-title__name"><span>${name}</span></div></div>`
  const make = (rows: string) => new JSDOM(`<div id="searchResultList">${rows}</div>`, { runScripts: 'outside-only', pretendToBeVisual: true })
  const one = make(row('Quốc Việt - Thọ Phát') + row('Quốc Việt'))
  let clicked = 0
  one.window.document.querySelectorAll('.conv-item').forEach(element => element.addEventListener('click', () => clicked++))
  expect(one.window.eval(buildOpenSearchResultScript('quốc  việt - thọ phát'))).toBe(1)
  expect(clicked).toBe(1)
  const twins = make(row('An') + row('An'))
  let twinClicks = 0
  twins.window.document.querySelectorAll('.conv-item').forEach(element => element.addEventListener('click', () => twinClicks++))
  expect(twins.window.eval(buildOpenSearchResultScript('An'))).toBe(2)
  expect(twinClicks).toBe(0)
  one.window.close(); twins.window.close()
})
