import { expect,test } from 'vitest'
import { JSDOM } from 'jsdom'
import { meetingCaptionScript } from './meeting-captions'
test('reads caption-only rows, preserves correction identity, ignores chat and hidden captions',()=>{
 const dom=new JSDOM('<div data-tid="chat-pane-message">Private chat</div><div data-tid="closed-caption-container"><div data-tid="closed-caption-item"><span data-tid="closed-caption-speaker-name">John</span><span data-tid="closed-caption-text">We need inventory.</span></div></div>',{runScripts:'outside-only',pretendToBeVisual:true})
 dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return {width:100,height:20,top:1,bottom:21,left:1,right:101} as DOMRect}
 const read=()=>dom.window.eval(meetingCaptionScript()) as {session:string|null;segments:Array<{id:string;text:string;speaker:string}>}
 const first=read();expect(first.segments).toHaveLength(1);expect(first.segments[0].speaker).toBe('John');expect(JSON.stringify(first)).not.toContain('Private chat')
 dom.window.document.querySelector('[data-tid="closed-caption-text"]')!.textContent='We need inventory reconciliation.'
 const corrected=read();expect(corrected.segments[0].id).toBe(first.segments[0].id);expect(corrected.segments[0].text).toContain('reconciliation')
 ;(dom.window.document.querySelector('[data-tid="closed-caption-container"]') as HTMLElement).style.display='none'
 expect(read().segments).toEqual([]);dom.window.close()
})
