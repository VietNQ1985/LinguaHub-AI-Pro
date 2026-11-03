import { expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
vi.mock('./LiveTranslation',()=>({LiveTranslation:()=>null}))
vi.mock('./ChatGPTAccount',()=>({ChatGPTAccount:()=>null}))
vi.mock('./AdvancedSettings',()=>({AdvancedSettings:()=>null}))
vi.mock('./AiResult',()=>({AiResult:({result}:{result:unknown})=>createElement('div',null,JSON.stringify(result))}))
import { AiPanel } from './AiPanel'
test('switching chat cancels pending suggestions and rejects late output',async()=>{
 const dom=new JSDOM('<div id="root"></div>');vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 let chat='a';let finish:(value:unknown)=>void=()=>{}
 const cancelAi=vi.fn(async()=>true)
 Object.assign(dom.window,{lingua:{getPreferences:async()=>({model:'local',theme:'light'}),getReasoningEffort:async()=>'max',getTranslationReasoningEffort:async()=>'low',getFastMode:async()=>false,hasVisibleChatReadAuthorization:async()=>true,readVisibleChat:async()=>({conversationId:chat,messages:[{side:'left',text:'Hello'}]}),runAi:vi.fn(()=>new Promise(resolve=>{finish=resolve})),cancelAi}})
 const container=dom.window.document.querySelector('#root')!;const root=createRoot(container)
 try{
 await act(async()=>root.render(createElement(AiPanel)))
 await act(async()=>{(container.querySelector('details') as HTMLDetailsElement).open=true;await new Promise(resolve=>setTimeout(resolve,10))})
 const button=[...container.querySelectorAll('button')].find(item=>item.textContent==='Đọc chat & gợi ý trả lời')!
 await act(async()=>button.click())
 expect(container.textContent).toContain('Đang đọc chat')
 await act(async()=>{chat='b';await new Promise(resolve=>setTimeout(resolve,400))})
 expect(cancelAi).toHaveBeenCalledTimes(1)
 await act(async()=>finish({replies:'STALE_PRIVATE_REPLY'}))
 expect(container.textContent).not.toContain('STALE_PRIVATE_REPLY')
 expect(button.disabled).toBe(false)
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals()}
})
