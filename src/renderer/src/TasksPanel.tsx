import {useEffect,useRef,useState} from 'react'
import type {TaskCaptureResult,TaskSourceService,WorkTask} from '../../main/tasks'

const blank={title:'',description:'',status:'todo' as WorkTask['status'],priority:'normal' as WorkTask['priority'],assignee:'',dueDate:'',notes:'',sourceService:undefined as TaskSourceService|undefined,sourceLabel:'',sourceEvidence:''}
const serviceName=(service:TaskSourceService)=>service==='outlook'?'Outlook':service==='teams'?'Microsoft Teams':service==='zalo'?'Zalo Web':'WhatsApp'
const cleanIpcError=(error:unknown)=>error instanceof Error?error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,''):'Chưa xử lý được nội dung chat/email.'

export function TasksPanel({service,onClose}:{service:string;onClose:()=>void}){
 const [rows,setRows]=useState<WorkTask[]>([])
 const [draft,setDraft]=useState({...blank,id:undefined as string|undefined})
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [model,setModel]=useState(''),[captureBusy,setCaptureBusy]=useState(false),[captureStatus,setCaptureStatus]=useState(''),[capture,setCapture]=useState<TaskCaptureResult|null>(null)
 const activeCapture=useRef<string|null>(null)
 const refresh=()=>window.lingua.listTasks().then(setRows).catch(()=>setError('Chưa đọc được công việc.'))
 useEffect(()=>{
   void refresh()
   void window.lingua.getPreferences().then(preferences=>setModel(preferences.model)).catch(()=>{})
   return()=>{const requestId=activeCapture.current;activeCapture.current=null;if(requestId)void window.lingua.cancelAi(requestId).catch(()=>{})}
 },[])
 const captureTasks=async()=>{
   if(captureBusy)return
   if(service==='zalopc'){setCaptureStatus('Zalo PC chưa hỗ trợ đọc nội dung để tạo việc. Anh chọn chat trong Zalo Web rồi quay lại đây.');return}
   if(!['whatsapp','teams','zalo','outlook'].includes(service)){setCaptureStatus('Anh mở WhatsApp, Teams, Zalo Web hoặc Outlook trước.');return}
   if(!model.startsWith('chatgpt:')){setCaptureStatus('Tính năng này dùng ChatGPT đã đăng nhập để tránh gửi nội dung sang API/model khác. Anh chọn ChatGPT trong Cài đặt.');return}
   setCaptureBusy(true);setCaptureStatus('');setError('')
   const requestId=`task-capture-${crypto.randomUUID()}`
   activeCapture.current=requestId
   try{
     let authorized=await window.lingua.hasVisibleChatReadAuthorization()
     if(!authorized)authorized=await window.lingua.authorizeVisibleChatRead()
     if(activeCapture.current!==requestId)return
     if(!authorized)throw new Error('Chưa cho phép đọc chat/email đang mở.')
     const result=await window.lingua.extractTasksFromVisible(service as TaskSourceService,model,requestId)
     if(activeCapture.current!==requestId)return
     if(result.cancelled){setCaptureStatus('Đã hủy. Chưa gửi nội dung và chưa tạo công việc.');return}
     setCapture(result)
     setCaptureStatus(result.tasks.length?`Tìm thấy ${result.tasks.length} việc đề xuất. Anh chọn từng việc để kiểm tra trước khi lưu.`:'Không thấy đầu việc rõ ràng trong nội dung đang mở.')
   }catch(failure){if(activeCapture.current===requestId)setCaptureStatus(cleanIpcError(failure))}
   finally{if(activeCapture.current===requestId){activeCapture.current=null;setCaptureBusy(false)}}
 }
 const chooseSuggestion=(suggestion:TaskCaptureResult['tasks'][number],source:TaskCaptureResult['source'])=>{
   setDraft({...blank,id:undefined,title:suggestion.title,description:suggestion.description,assignee:suggestion.assignee,dueDate:suggestion.dueDate,status:'todo',priority:suggestion.priority,sourceService:source.service,sourceLabel:source.label,sourceEvidence:suggestion.evidence})
   setError('')
 }
 const visibleRows=rows.filter(row=>(filter==='all'||row.status===filter)&&(row.title+' '+row.assignee).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).sort((a,b)=>b.updatedAt-a.updatedAt)
 return <section className="tasks-panel">
  <div className="settings-title"><h2>Công việc của tôi</h2><button type="button" onClick={onClose}>Về trò chuyện</button></div>
  <p>Lưu riêng trong LinguaHub trên máy này. Không kết nối hoặc sửa dữ liệu AritoActive.</p>
  <div className="task-capture-box">
   <h3>Lấy việc từ chat hoặc email</h3>
   <p>Đọc nội dung của chat/email anh đã chọn gần nhất. ChatGPT chỉ tìm đầu việc rõ ràng; anh xem, sửa và bấm lưu từng việc.</p>
   <button type="button" className="primary-button" disabled={captureBusy||service==='zalopc'} onClick={()=>void captureTasks()}>{captureBusy?'Đang đọc và tìm việc…':'Lấy từ chat/email đang chọn'}</button>
   <small>Hỏi quyền đọc nếu cần. Trước khi gửi chữ tới ChatGPT sẽ hỏi riêng mỗi lần. Không tự lưu, gửi tin hay gửi email.</small>
   {service==='zalopc'&&<p className="task-capture-status">Zalo PC chưa hỗ trợ đọc để tạo việc. Anh chọn cuộc trò chuyện trong tab Zalo Web rồi quay lại đây.</p>}
   {captureStatus&&<p className="task-capture-status" role="status" aria-live="polite">{captureStatus}</p>}
  </div>
  {capture?.tasks.length? <section className="task-suggestions" aria-label="Việc đề xuất từ chat/email">
   <h3>Đề xuất từ {serviceName(capture.source.service)} · {capture.source.label}</h3>
   <p>Chọn một việc để đưa vào biểu mẫu. Trích dẫn nguồn chỉ lưu trên máy nếu anh lưu công việc; có thể gỡ trước khi lưu.</p>
   {capture.tasks.map((suggestion,index)=><article className="task-suggestion" key={`${index}:${suggestion.title}`}>
    <strong>{suggestion.title}</strong>
    {suggestion.description&&<p>{suggestion.description}</p>}
    {suggestion.evidence&&<blockquote>{suggestion.evidence}</blockquote>}
    <button type="button" onClick={()=>chooseSuggestion(suggestion,capture.source)}>Kiểm tra và chỉnh sửa</button>
   </article>)}
  </section>:null}
  <div className="tasks-columns">
   <div>
    <input aria-label="Tìm công việc" placeholder="Tìm công việc…" value={query} onChange={event=>setQuery(event.target.value)}/>
    <select aria-label="Lọc trạng thái" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Tất cả</option><option value="todo">Chưa làm</option><option value="doing">Đang làm</option><option value="done">Hoàn thành</option></select>
    <button type="button" onClick={()=>{setDraft({...blank,id:undefined});setError('')}}>＋ Công việc mới</button>
    {visibleRows.map(row=><button type="button" className="task-card" key={row.id} onClick={()=>{setDraft({...blank,...row});setError('')}}><strong>{row.title}</strong><small>{row.status==='done'?'✓ Hoàn thành':row.status==='doing'?'Đang làm':'Chưa làm'} · {row.assignee||'Chưa giao'} · {row.dueDate||'Chưa có hạn'}</small></button>)}
    {!rows.length&&<p>Chưa có công việc. Anh có thể lấy đầu việc từ chat/email hoặc tạo thủ công.</p>}
   </div>
   <form onSubmit={async event=>{
    event.preventDefault();setBusy(true);setError('')
    try{const {createdAt,updatedAt,...input}=draft as typeof draft&Partial<WorkTask>;await window.lingua.saveTask(input);await refresh();setDraft({...blank,id:undefined})}
    catch(failure){setError(cleanIpcError(failure))}finally{setBusy(false)}
   }}>
    <h3>{draft.id?'Chỉnh sửa công việc':'Tạo công việc'}</h3>
    {draft.sourceService&&<div className="task-source-note"><strong>Nguồn: {serviceName(draft.sourceService)} · {draft.sourceLabel||'nội dung đang mở'}</strong><details><summary>Xem trích dẫn gốc</summary><blockquote>{draft.sourceEvidence}</blockquote></details><button type="button" className="secondary-button" onClick={()=>setDraft({...draft,sourceService:undefined,sourceLabel:'',sourceEvidence:''})}>Gỡ nguồn khỏi công việc</button></div>}
    <label>Tiêu đề<input required maxLength={200} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
    <label>Mô tả<textarea maxLength={10000} value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
    <label>Người phụ trách<input maxLength={200} value={draft.assignee} onChange={event=>setDraft({...draft,assignee:event.target.value})}/></label>
    <label>Hạn xử lý<input type="date" value={draft.dueDate} onChange={event=>setDraft({...draft,dueDate:event.target.value})}/></label>
    <label>Trạng thái<select value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value as WorkTask['status']})}><option value="todo">Chưa làm</option><option value="doing">Đang làm</option><option value="done">Hoàn thành</option></select></label>
    <label>Ưu tiên<select value={draft.priority} onChange={event=>setDraft({...draft,priority:event.target.value as WorkTask['priority']})}><option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option></select></label>
    <label>Ghi chú tiến độ<textarea maxLength={10000} value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label>
    <button type="submit" className="primary-button" disabled={busy}>{busy?'Đang lưu…':'Lưu công việc'}</button>
    {error&&<p role="alert">{error}</p>}
   </form>
  </div>
 </section>
}
