import {useState} from 'react'
export function WindowsVoiceInput({focusInput,disabled=false}:{focusInput:()=>void;disabled?:boolean}){
 const [status,setStatus]=useState('Sẵn sàng · Tiếng Việt (Windows)')
 const [busy,setBusy]=useState(false)
 return <div className="voice-input"><button type="button" className="secondary-button" disabled={disabled||busy} onClick={async()=>{
 focusInput();setBusy(true)
 try{await window.lingua.openWindowsVoiceTyping();setStatus('Chọn bàn phím Tiếng Việt. Bấm micro trong bảng Windows để nói; bấm lại để dừng.')}catch{setStatus('Anh đặt con trỏ vào ô rồi nhấn Win+H để nhập giọng nói Windows.')}
 finally{setBusy(false)}
 }}>🎙 Nhập tiếng Việt · Windows</button><span className="helper-text" role="status">{status}</span><small className="helper-text">Cần Internet; Windows xử lý giọng nói qua Microsoft. Không tự thu âm khi mở app. Chữ được điền vào ô, anh kiểm tra rồi bấm dịch.</small></div>
}
