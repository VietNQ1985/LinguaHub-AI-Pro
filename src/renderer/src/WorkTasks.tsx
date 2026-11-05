import {useEffect, useRef, useState} from 'react'

export type WorkTask = {id?: string; title: string; description: string; status: 'todo'|'doing'|'done'; remindAt: number|null; source?: {service: string; conversationId: string; evidence: string}}
const blank = (): WorkTask => ({title:'', description:'', status:'todo', remindAt:null})
const localDate = (time: number|null) => time ? new Date(time - new Date(time).getTimezoneOffset()*60000).toISOString().slice(0,16) : ''

export function WorkTasks({service,model}:{service:string;model:string}) {
 const [open,setOpen]=useState(false),[rows,setRows]=useState<WorkTask[]>([]),[draft,setDraft]=useState<WorkTask>(blank)
 const [suggestions,setSuggestions]=useState<WorkTask[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const generation=useRef(0),request=useRef<string|null>(null)
 const refresh=()=>window.lingua.listTasks().then(setRows)
 useEffect(()=>{void refresh().catch(()=>setError('Chưa đọc được công việc.'));const stop=window.lingua.onShortcut(action=>{if(action==='tasks'){setOpen(true);void refresh()}});return stop},[])
 useEffect(()=>{generation.current++;setSuggestions([]);setBusy(false);if(request.current)void window.lingua.cancelAi(request.current);request.current=null},[service,model])
 useEffect(()=>()=>{generation.current++;if(request.current)void window.lingua.cancelAi(request.current)},[])
 const capture=async()=>{
   const current=++generation.current;setBusy(true);setError('');setSuggestions([])
   try {
     if(!await window.lingua.hasVisibleChatReadAuthorization()&&!await window.lingua.authorizeVisibleChatRead())return
     const before=await window.lingua.readVisibleChat()
     if(current!==generation.current)return
     if(!before?.text.trim())throw new Error('Mở đúng cuộc trò chuyện hoặc email rồi thử lại.')
     // Explicit action and existing provider consent are both required; no automatic AI requests.
     if(model.startsWith('chatgpt:')&&!await window.lingua.allowCloud())return
     const after=await window.lingua.readVisibleChat()
     if(current!==generation.current)return
     if(!after||after.conversationId!==before.conversationId||after.text!==before.text)throw new Error('Nội dung đã đổi. Anh lấy lại công việc từ nguồn hiện tại.')
     const id='tasks-'+crypto.randomUUID();request.current=id
     const result=await window.lingua.runAi('summary',before.text.slice(0,11000),model,id) as {actions?:{text:string;evidence:string;deadline:string|null}[]}
     const latest=await window.lingua.readVisibleChat()
     if(current!==generation.current)return
     if(!latest||latest.conversationId!==before.conversationId||latest.text!==before.text)throw new Error('Chat/email đã đổi. Đề xuất cũ đã bỏ.')
     const actions=(result.actions||[]).filter(a=>typeof a.text==='string'&&typeof a.evidence==='string'&&a.evidence.trim()&&before.text.includes(a.evidence)).slice(0,10)
     setSuggestions(actions.map(a=>({...blank(),title:a.text.slice(0,200),description:a.deadline?`Hạn ghi trong nguồn: ${a.deadline}. Anh chọn ngày giờ nhắc bên dưới.`:'',source:{service,conversationId:before.conversationId,evidence:a.evidence}})))
     if(!actions.length)setError('Không tìm thấy đầu việc rõ ràng trong nội dung đang mở.')
   } catch(e){if(current===generation.current)setError(e instanceof Error?e.message:String(e))}
   finally{if(current===generation.current){setBusy(false);request.current=null}}
 }
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await window.lingua.saveTask(draft);setDraft(blank());await refresh();setError('')}catch(e){setError(String(e))}}
 return <details className="work-tasks" open={open} onToggle={e=>{setOpen(e.currentTarget.open);if(!e.currentTarget.open){generation.current++;if(request.current)void window.lingua.cancelAi(request.current);request.current=null;setBusy(false)}}}>
  <summary>Công việc & nhắc hạn · {rows.filter(r=>r.status!=='done').length}</summary>
  {open&&<div>
   <p>Lấy đầu việc từ chat/email đang mở, xem sửa rồi lưu trên máy.</p>
   <button type="button" disabled={busy||!model} onClick={()=>void capture()}>{busy?'Đang tìm công việc…':'Lấy việc từ chat/email'}</button>
   {busy&&<button type="button" onClick={()=>{generation.current++;if(request.current)void window.lingua.cancelAi(request.current);request.current=null;setBusy(false)}}>Hủy</button>}
   {suggestions.map((item,i)=><article key={i}><strong>{item.title}</strong><blockquote>{item.source?.evidence}</blockquote><button type="button" onClick={()=>setDraft(item)}>Xem sửa và lưu</button></article>)}
   <form onSubmit={e=>void save(e)}>
    <label>Tên công việc<input required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label>Ghi chú<textarea maxLength={5000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    <label>Trạng thái<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as WorkTask['status']})}><option value="todo">Chưa làm</option><option value="doing">Đang làm</option><option value="done">Hoàn thành</option></select></label>
    <label>Ngày giờ nhắc (giờ máy tính)<input type="datetime-local" value={localDate(draft.remindAt)} onChange={e=>setDraft({...draft,remindAt:e.target.value?new Date(e.target.value).getTime():null})}/></label>
    {draft.source&&<details><summary>Nguồn: {draft.source.service}</summary><blockquote>{draft.source.evidence}</blockquote><button type="button" onClick={()=>setDraft({...draft,source:undefined})}>Gỡ nguồn</button></details>}
    <button type="submit">Lưu công việc</button><button type="button" onClick={()=>setDraft(blank())}>Tạo mới</button>
   </form>
   <p>Nhắc hạn khi LinguaHub đang chạy, kể cả dưới khay hệ thống. Nếu máy tắt, app nhắc một lần khi mở lại. Nội dung công việc không hiện trên thông báo Windows.</p>
   {error&&<p role="alert">{error}</p>}
   {rows.map(item=><article key={item.id}><button type="button" onClick={()=>setDraft(item)}>{item.status==='done'?'✓ ':''}{item.title}</button>{item.remindAt&&<small>{new Date(item.remindAt).toLocaleString('vi-VN')}</small>}<button type="button" onClick={()=>{if(item.id&&window.confirm('Xóa công việc này?'))void window.lingua.deleteTask(item.id).then(refresh).catch(e=>setError(String(e)))}}>Xóa</button></article>)}
  </div>}
 </details>
}
