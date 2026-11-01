import { useEffect, useRef, useState } from 'react'
import { LiveTranslation } from './LiveTranslation'
import { Vocabulary } from './Vocabulary'
import { AiResult } from './AiResult'
import { ChatGPTAccount } from './ChatGPTAccount'
import { SpeakingPractice } from './SpeakingPractice'
import { DailyLesson } from './DailyLesson'

function NotificationSettings() {
  const [preferences,setPreferences]=useState({whatsapp:false,teams:false})
  const [error,setError]=useState('')
  const [testStatus,setTestStatus]=useState('')
  useEffect(()=>{void window.lingua.getNotificationPreferences().then(setPreferences).catch(()=>setError('Không đọc được cài đặt thông báo.'))},[])
  const update=async(service:'whatsapp'|'teams',enabled:boolean)=>{
    setError('')
    try{setPreferences(await window.lingua.setNotificationPreference(service,enabled))}
    catch(error){setError(error instanceof Error?error.message:'Không đổi được quyền thông báo.')}
  }
  return <section className="notifications" id="notifications">
    <h4>Thông báo khi có tin nhắn mới</h4>
    <p>Cho phép hiện toast Windows cho từng dịch vụ. Khi bật, anh xác nhận quyền trong hộp thoại của app. Sau đó bật thông báo Desktop trong WhatsApp hoặc Notifications trong Teams.</p>
    <label><input type="checkbox" checked={preferences.whatsapp} onChange={event=>void update('whatsapp',event.target.checked)}/> WhatsApp</label>
    <label><input type="checkbox" checked={preferences.teams} onChange={event=>void update('teams',event.target.checked)}/> Microsoft Teams</label>
    <button onClick={()=>{setError('');setTestStatus('');void window.lingua.testNotification().then(()=>setTestStatus('Windows đã nhận yêu cầu toast thử nghiệm.')).catch(error=>setError(error instanceof Error?error.message:'Không gửi được thông báo thử.'))}}>Thử thông báo Windows</button>
    {testStatus?<p role="status">{testStatus}</p>:null}
    {error?<p role="alert">{error}</p>:null}
  </section>
}

function RetentionSettings(){
  const [days,setDays]=useState(0)
  const [status,setStatus]=useState('')
  useEffect(()=>{void window.lingua.getDataRetentionDays().then(setDays).catch(()=>setStatus('Không đọc được thời hạn lưu.'))},[])
  return <section className="notice"><h4>Thời hạn lưu dữ liệu học</h4><label>Từ vựng và lịch học<select value={days} onChange={async event=>{const next=Number(event.target.value);try{if(await window.lingua.setDataRetentionDays(next)){setDays(next);setStatus(next===0?'Giữ đến khi anh tự xóa':'Đã áp dụng; dữ liệu cũ hơn thời hạn đã được xóa')}else setStatus('Đã hủy thay đổi')}catch(error){setStatus(error instanceof Error?error.message:'Không lưu được thời hạn')}}}><option value={0}>Giữ đến khi tự xóa</option><option value={30}>30 ngày</option><option value={90}>90 ngày</option><option value={365}>365 ngày</option></select></label><p>Tin nhắn không được lưu. Chọn thời hạn ngắn sẽ yêu cầu xác nhận và xóa từ vựng/lịch học cũ hơn mốc đó.</p><p role="status">{status}</p></section>
}

function LocalDataSettings(){
  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)
  const clear=async()=>{
    setBusy(true)
    setStatus('')
    try{
      const result=await window.lingua.clearLocalData()
      if(result.cleared){
        setStatus(result.chatgptRevoked?'Đã xóa dữ liệu và xác nhận thu hồi ChatGPT. App sẽ khởi động lại; anh cần đăng nhập lại.':'Dữ liệu cục bộ đã xóa; chưa xác nhận OpenAI thu hồi ChatGPT. App sẽ khởi động lại; anh cần đăng nhập lại.')
        setTimeout(()=>window.location.reload(),700)
      }else setStatus('Đã hủy thao tác.')
    }catch(error){setStatus(error instanceof Error?error.message:'Không xóa được toàn bộ dữ liệu.')}
    finally{setBusy(false)}
  }
  return <section className="notice"><h4>Xóa dữ liệu trên máy</h4><p>Thao tác này đăng xuất WhatsApp/Teams, ngắt ChatGPT và xóa từ vựng, tiến độ học cùng cài đặt LinguaHub.</p><button disabled={busy} onClick={()=>void clear()}>{busy?'Đang xóa…':'Xóa toàn bộ dữ liệu cục bộ…'}</button><p role="status">{status}</p></section>
}

export function AiPanel({section=''}:{section?:string}) {
  useEffect(()=>{
    if(section==='Trả lời AI')setTask('reply')
    if(section==='English Coach')setTask('coach')
    const id=({'Dịch trực tiếp':'live','Từ vựng':'vocabulary','Luyện nói':'speaking','Cài đặt':'account','Trả lời AI':'compose','English Coach':'compose'} as Record<string,string>)[section]
    if(id){const element=document.getElementById(id);const details=element?.querySelector('details');if(details)details.open=true;element?.scrollIntoView({behavior:'smooth',block:'start'})}
  },[section])
  useEffect(()=>{ void window.lingua.getPreferences().then(p=>{setModel(p.model);document.documentElement.dataset.theme=p.theme}).catch(()=>{}) }, [])
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [task, setTask] = useState<'translate' | 'reply' | 'coach' | 'summary' | 'risks'>('translate')
  const [text, setText] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [masking,setMasking]=useState(true)
  const [demo,setDemo]=useState(false)
  const [busy, setBusy] = useState(false)
  const [autoReply,setAutoReply]=useState(false)
  const generation=useRef(0)
  const inputVersion=useRef(0)
  useEffect(()=>{
    const selectSentence=(event:Event)=>{
      const value=(event as CustomEvent<unknown>).detail
      if(typeof value!=='string'||value.trim().length<2)return
      setTask('coach')
      setText(value.slice(0,12000))
      requestAnimationFrame(()=>document.getElementById('compose')?.scrollIntoView({behavior:'smooth',block:'start'}))
    }
    window.addEventListener('linguahub:coach-text',selectSentence)
    return()=>window.removeEventListener('linguahub:coach-text',selectSentence)
  },[])
  useEffect(()=>{inputVersion.current++;setResult(null);setDemo(false)},[text,model,task,masking])
  useEffect(()=>{
    const current=++generation.current
    if(!autoReply || task!=='reply' || !model || model.startsWith('chatgpt:') || text.trim().length<2)return
    let cancelled=false
    const timer=setTimeout(async()=>{
      setBusy(true);setError('');setDemo(false)
      try{const output=await window.lingua.runAi('reply',text,model);if(!cancelled && current===generation.current)setResult(output)}
      catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Không tạo được gợi ý')}
      finally{if(!cancelled)setBusy(false)}
    },900)
    return ()=>{cancelled=true;clearTimeout(timer);setBusy(false)}
  },[autoReply,task,text,model])
  const connect = async () => { try { setError(''); const values = await window.lingua.listModels(); setModels(values); setModel(values[0] || ''); if (!values.length) setError('Ollama chưa có model. Anh cần tải model trong Ollama.'); } catch { setError('Chưa tìm thấy Ollama trên máy. Chức năng AI cục bộ cần Ollama đang chạy.'); } }
  const run = async () => {
    const version=inputVersion.current
    setDemo(false);setBusy(true);setError('');setResult(null)
    try{const output=await window.lingua.runAi(task,text,model);if(version===inputVersion.current)setResult(output)}
    catch(error){if(version===inputVersion.current)setError(error instanceof Error?error.message:'Không xử lý được yêu cầu.')}
    finally{setBusy(false)}
  }
  return <><h3>Trợ lý ngôn ngữ</h3><button onClick={()=>{const theme=document.documentElement.dataset.theme === 'light'?'dark':'light';document.documentElement.dataset.theme=theme;void window.lingua.setPreferences({theme,model}).catch(()=>setError('Không lưu được giao diện.'))}}>Đổi sáng / tối</button><div id="account"><label><input type="checkbox" checked={masking} onChange={async e=>{const enabled=e.target.checked;try{await window.lingua.setMasking(enabled);setMasking(enabled)}catch{setError('Không đổi được chế độ che dữ liệu.')}}}/> Che email/số điện thoại trước khi gửi AI</label><ChatGPTAccount/><NotificationSettings/><RetentionSettings/><LocalDataSettings/></div><div id="speaking"><SpeakingPractice/></div><div id="vocabulary"><DailyLesson/><Vocabulary/></div><div id="live"><LiveTranslation model={model}/></div><span className="badge">{model.startsWith('chatgpt:')?'CHATGPT · XỬ LÝ CLOUD':'OLLAMA · XỬ LÝ TRÊN MÁY'}</span><p>{model.startsWith('chatgpt:')?'Bấm Tạo kết quả sẽ gửi nội dung nhập đến OpenAI. Dịch OCR nền cần quyền riêng và chỉ gửi chữ nhận dạng, không gửi ảnh.':'Nội dung AI chỉ gửi đến Ollama trên máy này.'}</p><button onClick={connect}>Kết nối Ollama</button><button onClick={async()=>{try{if(!await window.lingua.allowCloud())return;const values=await window.lingua.chatgptModels();setModels(values.map(x=>'chatgpt:'+x.slug));setModel(values[0]?'chatgpt:'+values[0].slug:'');setError('')}catch(error){setError(error instanceof Error?error.message:'Không lấy được model ChatGPT')}}}>Dùng model ChatGPT · gửi nội dung đến OpenAI</button><label>Model<select value={model} onChange={e=>{setModel(e.target.value);void window.lingua.setPreferences({theme:document.documentElement.dataset.theme || 'dark',model:e.target.value}).catch(()=>setError('Không lưu được cài đặt.'))}}><option value="">Chọn model</option>{models.map(x=><option key={x}>{x}</option>)}</select></label><label id="compose">Chức năng<select value={task} onChange={e=>{setTask(e.target.value as typeof task);setResult(null)}}><option value="translate">Dịch Anh ↔ Việt</option><option value="reply">Gợi ý trả lời bằng tiếng Anh</option><option value="coach">English Coach</option><option value="summary">Tóm tắt và việc cần làm</option><option value="risks">Rà soát rủi ro giao tiếp</option></select></label><label><input type="checkbox" checked={autoReply} disabled={model.startsWith('chatgpt:')} onChange={e=>setAutoReply(e.target.checked)}/> Tự gợi ý sau khi ngừng gõ · chỉ Ollama cục bộ</label><label>Nội dung<textarea value={text} maxLength={12000} onChange={e=>setText(e.target.value)} placeholder="Nhập câu cần dịch hoặc ý trả lời tiếng Việt…"/></label><button disabled={busy || !model || text.trim().length<2} onClick={run}>{busy?'Đang xử lý…':'Tạo kết quả'}</button>{error?<p role="alert">{error}</p>:null}<button onClick={()=>{setDemo(true);setResult({translation:'Vui lòng xác nhận kết quả UAT trước khi chính thức vận hành.',explanation:'Dữ liệu minh họa cố định, không phải kết quả AI hoặc tin nhắn thật.'})}}>Xem kết quả demo</button>{demo?<p role="status">DEMO · DỮ LIỆU MINH HỌA</p>:null}{result?<AiResult result={result}/>:null}<p>Gợi ý chưa được gửi. Anh tự duyệt và gửi trong cuộc trò chuyện.</p></>
}
