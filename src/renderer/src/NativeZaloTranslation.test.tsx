import {expect,test,vi} from 'vitest'
import {JSDOM} from 'jsdom'
import {act,createElement} from 'react'
vi.mock('./AiResult',()=>({AiResult:({result}:{result:unknown})=>createElement('div',null,JSON.stringify(result))}))
import {NativeZaloTranslation} from './NativeZaloTranslation'

for(const stage of ['consent','inference'] as const)test(`native Zalo manual translation cancels at ${stage} without reading chat or publishing stale output`,async()=>{
 const dom=new JSDOM('<div id="root"></div>');vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 const {createRoot}=await import('react-dom/client')
 let allow:(value:boolean)=>void=()=>{},finish:(value:unknown)=>void=()=>{}
 const runAi=vi.fn(()=>new Promise(resolve=>{finish=resolve})),cancel=vi.fn(async()=>true),read=vi.fn()
 Object.assign(dom.window,{lingua:{allowCloud:stage==='consent'?()=>new Promise(resolve=>{allow=resolve}):async()=>true,runAi,cancelAi:cancel,readVisibleChat:read}})
 const container=dom.window.document.querySelector('#root')!,root=createRoot(container)
 try{
  await act(async()=>root.render(createElement(NativeZaloTranslation,{model:'chatgpt:test'})))
  const input=container.querySelector('textarea')!
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Hello');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})
  const button=container.querySelector('button')!
  expect(button.disabled).toBe(false)
  expect(runAi).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled()
  await act(async()=>button.click())
  if(stage==='inference')expect(runAi).toHaveBeenCalledTimes(1)
  await act(async()=>root.render(createElement(NativeZaloTranslation,{model:'local-other'})))
  await act(async()=>{allow(true);finish({translation:'STALE',explanation:''})})
  if(stage==='consent')expect(runAi).not.toHaveBeenCalled()
  expect(container.textContent).not.toContain('STALE');expect(cancel).toHaveBeenCalled();expect(read).not.toHaveBeenCalled()
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals()}
})
