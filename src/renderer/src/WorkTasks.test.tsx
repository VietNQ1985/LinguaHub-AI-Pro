import {test,expect,vi} from 'vitest'
import {JSDOM} from 'jsdom'
import {act,createElement} from 'react'
import {createRoot} from 'react-dom/client'
import {WorkTasks,taskMatches} from './WorkTasks'

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
 const button=Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.includes('Tìm việc trong chat/email'))!
 await act(async()=>button.click())
 if(cancel){await act(async()=>root.render(createElement(WorkTasks,{service:'outlook',model:'chatgpt:test'})));await act(async()=>allow(true));expect(runAi).not.toHaveBeenCalled()}
 else{expect(runAi).toHaveBeenCalledTimes(1);expect(dom.window.document.body.textContent).toContain('Kiểm tra hóa đơn');expect(saveTask).not.toHaveBeenCalled()}
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals()}
})

test('smart lists distinguish completed overdue and important tasks',()=>{
 const now=Date.now();const task={title:'Review invoice',description:'',status:'todo' as const,remindAt:null,dueAt:now-1000,important:true}
 expect(taskMatches(task,'overdue',now)).toBe(true)
 expect(taskMatches(task,'important',now)).toBe(true)
 expect(taskMatches({...task,status:'done'},'overdue',now)).toBe(false)
 expect(taskMatches({...task,status:'done'},'done',now)).toBe(true)
})

test('captured task source does not read hidden workspaces and saves only a selected suggestion',async()=>{
 const dom=new JSDOM('<div id="root"></div>');vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 const read=vi.fn(),save=vi.fn(async v=>({...v,id:'saved'}))
 Object.assign(dom.window,{lingua:{listTasks:async()=>[],readVisibleChat:read,allowCloud:async()=>true,cancelAi:async()=>true,saveTask:save,runAi:async()=>({actions:[{text:'Review invoice',evidence:'Review invoice',deadline:null}]})}})
 const root=createRoot(dom.window.document.querySelector('#root')!)
 try{
  await act(async()=>root.render(createElement(WorkTasks,{service:'outlook',model:'chatgpt:test',sourceSnapshot:{conversationId:'mail-1',text:'Review invoice',messages:[],service:'outlook',capturedAt:Date.now()}})))
  const find=(name:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.includes(name))!
  await act(async()=>find('Tìm việc trong chat/email').click())
  expect(read).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled()
  await act(async()=>find('＋ Thêm').click())
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0][0].source.evidence).toBe('Review invoice')
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals()}
})

test('batch add all proposals saves multiple task items',async()=>{
 const dom=new JSDOM('<div id="root"></div>');vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 const save=vi.fn(async v=>({...v,id:'saved-'+Math.random()}))
 Object.assign(dom.window,{lingua:{listTasks:async()=>[],allowCloud:async()=>true,cancelAi:async()=>true,saveTask:save,runAi:async()=>({actions:[{text:'Việc 1',evidence:'Việc 1',deadline:null},{text:'Việc 2',evidence:'Việc 2',deadline:null}]})}})
 const root=createRoot(dom.window.document.querySelector('#root')!)
 try{
  await act(async()=>root.render(createElement(WorkTasks,{service:'teams',model:'chatgpt:test',sourceSnapshot:{conversationId:'c-1',text:'Việc 1 và Việc 2',messages:[],service:'teams',capturedAt:Date.now()}})))
  const find=(name:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.includes(name))!
  await act(async()=>find('Tìm việc trong chat/email').click())
  const addAll=find('Thêm tất cả')
  expect(addAll).toBeTruthy()
  await act(async()=>addAll.click())
  expect(save).toHaveBeenCalledTimes(2)
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals()}
})

test('standup report button generates markdown and copies to clipboard',async()=>{
 const dom=new JSDOM('<div id="root"></div>');vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 const writeClipboardText=vi.fn(async()=>true)
 const sampleTasks=[
  {id:'1',title:'Hoàn thành slide báo cáo',status:'done' as const,remindAt:null},
  {id:'2',title:'Họp dự án với khách hàng',status:'doing' as const,remindAt:null,dueAt:Date.now()+100000},
  {id:'3',title:'Gửi email cho đối tác',status:'todo' as const,remindAt:null}
 ]
 Object.assign(dom.window,{lingua:{listTasks:async()=>sampleTasks,writeClipboardText,cancelAi:async()=>true}})
 const root=createRoot(dom.window.document.querySelector('#root')!)
 try{
  await act(async()=>root.render(createElement(WorkTasks,{service:'whatsapp',model:'local'})))
  const exportBtn=Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.includes('Sao chép báo cáo'))!
  expect(exportBtn).toBeTruthy()
  await act(async()=>exportBtn.click())
  expect(writeClipboardText).toHaveBeenCalledTimes(1)
  const copiedText=(writeClipboardText.mock.calls as string[][])[0][0]
  expect(copiedText).toContain('BÁO CÁO CÔNG VIỆC')
  expect(copiedText).toContain('ĐÃ HOÀN THÀNH')
  expect(copiedText).toContain('Hoàn thành slide báo cáo')
  expect(copiedText).toContain('ĐANG THỰC HIỆN')
  expect(copiedText).toContain('Họp dự án với khách hàng')
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals()}
})

test('view toggle switches to kanban board view with columns and cards', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.window.document)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const sampleTasks = [
    { id: '1', title: 'Task 1 Chưa làm', status: 'todo' as const, remindAt: null },
    { id: '2', title: 'Task 2 Đang làm', status: 'doing' as const, remindAt: null },
    { id: '3', title: 'Task 3 Đã xong', status: 'done' as const, remindAt: null }
  ]
  const saveTask = vi.fn(async v => v)
  Object.assign(dom.window, {
    lingua: {
      listTasks: async () => sampleTasks,
      saveTask,
      cancelAi: async () => true
    }
  })
  const root = createRoot(dom.window.document.querySelector('#root')!)
  try {
    await act(async () => root.render(createElement(WorkTasks, { service: 'whatsapp', model: 'local' })))
    const kanbanBtn = dom.window.document.querySelector('button[title="Xem bảng Kanban"]') as HTMLButtonElement
    expect(kanbanBtn).toBeTruthy()
    await act(async () => kanbanBtn.click())

    const kanbanBoard = dom.window.document.querySelector('.task-kanban')
    expect(kanbanBoard).toBeTruthy()
    expect(dom.window.document.body.textContent).toContain('Chưa làm')
    expect(dom.window.document.body.textContent).toContain('Đang làm')
    expect(dom.window.document.body.textContent).toContain('Đã xong')

    const startBtn = Array.from(dom.window.document.querySelectorAll('button')).find(b => b.textContent?.includes('Bắt đầu'))!
    expect(startBtn).toBeTruthy()
    await act(async () => startBtn.click())
    expect(saveTask).toHaveBeenCalledWith(expect.objectContaining({ id: '1', status: 'doing' }))
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    vi.unstubAllGlobals()
  }
})

test('export to JSON and CSV formats tasks into clipboard', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.window.document)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const writeClipboardText = vi.fn(async () => true)
  const sampleTasks = [
    { id: '1', title: 'Thiết kế hệ thống', description: 'Ghi chú A', status: 'todo' as const, remindAt: null, important: true }
  ]
  Object.assign(dom.window, {
    lingua: {
      listTasks: async () => sampleTasks,
      writeClipboardText,
      cancelAi: async () => true
    }
  })
  const root = createRoot(dom.window.document.querySelector('#root')!)
  try {
    await act(async () => root.render(createElement(WorkTasks, { service: 'teams', model: 'local' })))
    
    const jsonBtn = dom.window.document.querySelector('button[title="Xuất dữ liệu dạng JSON"]') as HTMLButtonElement
    expect(jsonBtn).toBeTruthy()
    await act(async () => jsonBtn.click())
    expect(writeClipboardText).toHaveBeenCalledTimes(1)
    const jsonText = (writeClipboardText.mock.calls as string[][])[0][0]
    expect(jsonText).toContain('Thiết kế hệ thống')

    const csvBtn = dom.window.document.querySelector('button[title="Xuất dữ liệu dạng CSV để mở Excel"]') as HTMLButtonElement
    expect(csvBtn).toBeTruthy()
    await act(async () => csvBtn.click())
    expect(writeClipboardText).toHaveBeenCalledTimes(2)
    const csvText = (writeClipboardText.mock.calls as string[][])[1][0]
    expect(csvText).toContain('Tiêu đề,Ghi chú')
    expect(csvText).toContain('Thiết kế hệ thống')
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    vi.unstubAllGlobals()
  }
})
