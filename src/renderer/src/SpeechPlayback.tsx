import { useEffect, useState } from 'react'
let stopActive: (() => void) | undefined
export function stopReplyPlayback() { stopActive?.(); stopActive=undefined }
export function SpeechPlayback({text}:{text:string}) {
  const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([])
  const [accent,setAccent]=useState('en-US')
  const [rate,setRate]=useState(.85)
  const [state,setState]=useState('')
  const [playing,setPlaying]=useState(false)
  useEffect(()=>{
    if(!window.speechSynthesis){setState('Máy chưa hỗ trợ đọc văn bản.');return}
    const synth=window.speechSynthesis
    const update=()=>setVoices(synth.getVoices())
    update();synth.addEventListener('voiceschanged',update)
    return ()=>{synth.removeEventListener('voiceschanged',update);stopReplyPlayback()}
  },[])
  const listen=()=>{
    const synth=window.speechSynthesis
    if(!synth)return
    stopReplyPlayback();synth.cancel()
    const voice=voices.find(item=>item.lang.toLowerCase()===accent.toLowerCase())||voices.find(item=>/^en[-_]/i.test(item.lang))
    if(!voice){setState('Chưa có giọng tiếng Anh. Anh cài giọng đọc trong Cài đặt Windows.');return}
    const utterance=new SpeechSynthesisUtterance(text)
    utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=rate
    let active=true
    const stop=()=>{active=false;utterance.onstart=null;utterance.onend=null;utterance.onerror=null;synth.cancel();setPlaying(false);setState('Đã dừng')}
    stopActive=stop
    utterance.onstart=()=>{if(active){setPlaying(true);setState(voice.lang.toLowerCase()===accent.toLowerCase()?'Đang đọc…':`Đang dùng giọng ${voice.lang}; chưa có giọng ${accent}.`)}}
    const done=(message:string)=>{if(active){active=false;setPlaying(false);setState(message);if(stopActive===stop)stopActive=undefined}}
    utterance.onend=()=>done('Đã đọc xong')
    utterance.onerror=()=>done('Không phát được giọng đọc. Anh thử lại.')
    setPlaying(true);setState('Đang chuẩn bị giọng đọc…');try{synth.speak(utterance)}catch{done('Không phát được giọng đọc. Anh thử lại.')}
  }
  return <div className="speech-controls">
    <label>Giọng <select aria-label="Giọng đọc tiếng Anh" value={accent} onChange={event=>{stopReplyPlayback();setAccent(event.target.value)}}><option value="en-US">Mỹ (US)</option><option value="en-GB">Anh (UK)</option></select></label>
    <label>Tốc độ <input aria-label="Tốc độ đọc" type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={event=>{stopReplyPlayback();setRate(Number(event.target.value))}} /> {rate.toFixed(2)}</label>
    <button type="button" onClick={listen} disabled={!voices.some(voice=>/^en[-_]/i.test(voice.lang))}>Nghe</button>
    <button type="button" disabled={!playing} onClick={stopReplyPlayback}>Dừng</button>
    <small role="status">{state || (!voices.some(voice=>/^en[-_]/i.test(voice.lang))?'Chưa tìm thấy giọng tiếng Anh đã cài.':'')}</small>
  </div>
}
