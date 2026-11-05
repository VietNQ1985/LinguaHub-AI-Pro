import {test,expect,vi} from 'vitest'
import {JSDOM} from 'jsdom'
import {act,createElement} from 'react'
import {createRoot} from 'react-dom/client'
import {WorkTasks} from './WorkTasks'

for(const cancel of [false,true])test(cancel?'switching apps while consent is pending prevents task AI request':'task extraction requires an explicit click and does not auto-save',async()=>{
 const dom=new JSDOM('<div id="root"></div>');vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 let allow: (v:boolean)=>void=()=>{}
 const runAi=vi.fn(async()=>({actions:[{text:'Kiểm tra hóa đơn',evidence:'Please review invoice',deadline:null}]})),saveTask=vi.fn()
 const snapshot={conversationId:'chat-1',text:'Please review invoice',messages:[]}
 Object.assign(dom.window,{lingua:{listTasks:async()=>[],onShortcut:()=>()=>{},cancelAi:async()=>true,hasVisibleChatReadAuthorization:async()=>true,readVisibleChat:async()=>snapshot,allowCloud:()=>cancel?new Promise<boolean>(r=>{allow=r}):Promise.resolve(true),runAi,saveTask}})
 const root=createRoot(dom.window.document.querySelector('#root')!)
 try{
 await act(async()=>root.render(createElement(WorkTasks,{service:'teams',model:'chatgpt:test'})))
 expect(runAi).not.toHaveBeenCalled()
 const details=dom.window.document.querySelector('details')!
 await act(async()=>{details.open=true;details.dispatchEvent(new dom.window.Event('toggle'))})
 const button=Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent==='Lấy việc từ chat/email')!
 await act(async()=>button.click())
 if(cancel){await act(async()=>root.render(createElement(WorkTasks,{service:'outlook',model:'chatgpt:test'})));await act(async()=>allow(true));expect(runAi).not.toHaveBeenCalled()}
 else{expect(runAi).toHaveBeenCalledTimes(1);expect(dom.window.document.body.textContent).toContain('Kiểm tra hóa đơn');expect(saveTask).not.toHaveBeenCalled()}
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals()}
})
