import { afterEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeechPlayback } from './SpeechPlayback'
afterEach(()=>vi.unstubAllGlobals())
test('playback selects installed English voice, stops before repeating, reports errors and cleans up',async()=>{
 const dom=new JSDOM('<div id="root"></div>')
 vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 let current:any
 class Utterance { constructor(public text:string){} }
 vi.stubGlobal('SpeechSynthesisUtterance',Utterance)
 const synth={getVoices:vi.fn(()=>[{lang:'en-US',name:'US'}]),addEventListener:vi.fn(),removeEventListener:vi.fn(),cancel:vi.fn(),speak:vi.fn(value=>{current=value;value.onstart()})}
 Object.assign(dom.window,{speechSynthesis:synth})
 const container=dom.window.document.querySelector('#root')!;const root=createRoot(container)
 try{
 await act(async()=>root.render(createElement(SpeechPlayback,{text:'Hello'})))
 const buttons=container.querySelectorAll('button')
 await act(async()=>buttons[0].click())
 expect(current.rate).toBe(.85);expect(current.voice.lang).toBe('en-US');expect(container.textContent).toContain('Đang đọc')
 const first=current
 await act(async()=>buttons[0].click())
 expect(first.onend).toBe(null);expect(synth.cancel).toHaveBeenCalled()
 await act(async()=>current.onerror())
 expect(container.textContent).toContain('Không phát được')
 await act(async()=>buttons[0].click())
 await act(async()=>buttons[1].click())
 expect(container.textContent).toContain('Đã dừng')
 }finally{await act(async()=>root.unmount());expect(synth.removeEventListener).toHaveBeenCalled();dom.window.close()}
})
test('no installed English voice disables playback honestly',async()=>{
 const dom=new JSDOM('<div id="root"></div>');vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 Object.assign(dom.window,{speechSynthesis:{getVoices:()=>[],addEventListener:vi.fn(),removeEventListener:vi.fn(),cancel:vi.fn()}})
 const container=dom.window.document.querySelector('#root')!;const root=createRoot(container)
 try{await act(async()=>root.render(createElement(SpeechPlayback,{text:'Hello'})));expect(container.querySelector('button')?.disabled).toBe(true);expect(container.textContent).toContain('Chưa tìm thấy giọng tiếng Anh')}finally{await act(async()=>root.unmount());dom.window.close()}
})
