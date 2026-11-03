import {useEffect,useRef,useState} from 'react'
import {AiResult} from './AiResult'

export function NativeZaloTranslation({model}:{model:string}){
 const [text,setText]=useState(''),[output,setOutput]=useState<unknown>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const generation=useRef(0),request=useRef<string|null>(null)
 const cancel=()=>{generation.current++;if(request.current)void window.lingua.cancelAi(request.current).catch(()=>{});request.current=null}
 useEffect(()=>{cancel();setOutput(null);setBusy(false);return cancel},[model])
 const translate=async()=>{
  if(busy||!model||!text.trim())return
  cancel();const current=generation.current,id=crypto.randomUUID();request.current=id;setBusy(true);setError('');setOutput(null)
  const valid=()=>current===generation.current&&request.current===id
  try{
   if(model.startsWith('chatgpt:')){const allowed=await window.lingua.allowCloud();if(!valid())return;if(!allowed){setError('Anh chưa cho phép xử lý nội dung nhập bằng ChatGPT.');return}}
   if(!valid())return
   const result=await window.lingua.runAi('translate',text.trim(),model,id)
   if(valid())setOutput(result)
  }catch(failure){if(valid())setError(failure instanceof Error?failure.message:'Chưa dịch được nội dung.')}
  finally{if(valid()){request.current=null;setBusy(false)}}
 }
 return <div className="pc-manual-translation"><p>Zalo PC chạy độc lập. Chưa hỗ trợ tự đọc/dịch tin nhắn Zalo PC. Anh có thể sao chép chữ từ Zalo rồi dán bên dưới; chỉ nội dung anh nhập được gửi khi bấm Dịch.</p><label htmlFor="pc-translation-text">Nội dung anh muốn dịch</label><textarea id="pc-translation-text" value={text} maxLength={4000} onChange={event=>{cancel();setBusy(false);setOutput(null);setError('');setText(event.target.value)}}/><button className="primary-button" disabled={busy||!model||!text.trim()} onClick={()=>void translate()}>{busy?'Đang dịch…':'Dịch nội dung tôi nhập'}</button>{!model&&<p>Anh chọn dịch vụ AI trong Cài đặt trước khi dịch.</p>}{error&&<p role="alert">{error}</p>}{output!==null&&<AiResult result={output}/>}</div>
}
