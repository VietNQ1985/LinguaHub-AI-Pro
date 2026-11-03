import { MeetingTranslation } from './MeetingTranslation'
import {NativeZaloTranslation} from './NativeZaloTranslation'
import { stopReplyPlayback } from './SpeechPlayback'
import { useEffect, useRef, useState } from 'react'
import { LiveTranslation } from './LiveTranslation'
import { AiResult } from './AiResult'
import { ChatGPTAccount } from './ChatGPTAccount'
import { AdvancedSettings } from './AdvancedSettings'
import { DEFAULT_CHATGPT_MODEL, DEFAULT_REASONING_EFFORT, DEFAULT_TRANSLATION_REASONING_EFFORT, isGpt6Model, REASONING_EFFORTS, type ReasoningEffort } from '../../shared/model-reasoning'

type PanelMode = 'translate' | 'settings'
type Theme = 'light' | 'dark'
const reasoningEffortLabels: Record<ReasoningEffort, string> = {
  none: 'Tắt suy luận (None)',
  low: 'Thấp (Low)',
  medium: 'Vừa (Medium)',
  high: 'Cao (High)',
  xhigh: 'Rất cao (Extra High)',
  max: 'Tối đa (Max)',
}
type ChatContextMessage = { side: 'left' | 'right' | 'center'; text: string }

function recentChatContext(messages: ChatContextMessage[]) {
  const selected: ChatContextMessage[] = []
  let remaining = 9000
  for (const message of messages.slice(-20).reverse()) {
    const text = message.text.trim().slice(0, Math.min(2000, remaining - 32))
    if (!text) continue
    const candidate = { side: message.side, text }
    const size = JSON.stringify(candidate).length + 1
    if (size > remaining) break
    selected.unshift(candidate)
    remaining -= size
  }
  return selected
}

function modelLabel(value: string) {
  if (value === DEFAULT_CHATGPT_MODEL) return 'ChatGPT · GPT-6 Luna'
  if (value.startsWith('chatgpt:')) return 'ChatGPT · ' + value.slice(8)
  return value ? 'Ollama · ' + value : 'Chưa chọn mô hình'
}

export function AiPanel() {
  const [service,setService]=useState('whatsapp')
  useEffect(()=>{const changed=(event:Event)=>{const value=(event as CustomEvent<string>).detail;setService(value);setMeetingMode(false);invalidateReply()};window.addEventListener('linguahub:service',changed);return()=>window.removeEventListener('linguahub:service',changed)},[])
  const [meetingMode,setMeetingMode]=useState(false)
  const [mode, setMode] = useState<PanelMode>('translate')
  const [model, setModel] = useState('')
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(DEFAULT_REASONING_EFFORT)
  const [translationReasoningEffort, setTranslationReasoningEffort] = useState<ReasoningEffort>(DEFAULT_TRANSLATION_REASONING_EFFORT)
  const [fastMode, setFastMode] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [modelReasoningEfforts, setModelReasoningEfforts] = useState<Record<string,ReasoningEffort[]>>({})
  const [theme, setTheme] = useState<Theme>('light')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [masking, setMasking] = useState(true)
  const requestGeneration = useRef(0)
  const activeReply = useRef<string | null>(null)
  const replyConversation = useRef<string | null>(null)
  const [boundConversation,setBoundConversation]=useState<string|null>(null)
  const intentRef = useRef<HTMLTextAreaElement>(null)
  const [voiceHelp,setVoiceHelp]=useState(false)
  const [replyFast,setReplyFast]=useState(false)
  const invalidateReply=()=>{
    requestGeneration.current++
    replyConversation.current=null;setBoundConversation(null)
    if(activeReply.current)void window.lingua.cancelAi(activeReply.current).catch(()=>{})
    activeReply.current=null
    setBusy(false);setOutput(null);stopReplyPlayback()
  }
  useEffect(()=>{
    const reset=()=>invalidateReply()
    window.addEventListener('linguahub:workspace',reset)
    window.addEventListener('linguahub:dashboard',reset)
    return ()=>{requestGeneration.current++;window.removeEventListener('linguahub:workspace',reset);window.removeEventListener('linguahub:dashboard',reset);if(activeReply.current)void window.lingua.cancelAi(activeReply.current).catch(()=>{});stopReplyPlayback()}
  },[])
  useEffect(()=>{invalidateReply()},[model,mode])
  useEffect(()=>{
    if(!boundConversation || (!busy && output===null))return
    let disposed=false,checking=false
    const generation=requestGeneration.current
    const check=async()=>{
      if(disposed||checking)return
      checking=true
      try{
        const next=await window.lingua.readVisibleChat()
        if(!disposed&&generation===requestGeneration.current&&replyConversation.current===boundConversation&&next?.conversationId!==boundConversation)invalidateReply()
      }catch{if(!disposed&&generation===requestGeneration.current)invalidateReply()}
      finally{checking=false}
    }
    const unsubscribe=window.lingua.onVisibleChatChanged(()=>void check())
    const timer=setInterval(()=>void check(),1000)
    return ()=>{disposed=true;unsubscribe();clearInterval(timer)}
  },[boundConversation,busy,output])


  useEffect(() => {
    let active = true
    void Promise.all([window.lingua.getPreferences(), window.lingua.getReasoningEffort(), window.lingua.getTranslationReasoningEffort(), window.lingua.getFastMode()]).then(([preferences, savedEffort, savedTranslationEffort, savedFastMode]) => {
      if (!active) return
      const selectedModel = preferences.model || DEFAULT_CHATGPT_MODEL
      setModel(selectedModel)
      setReasoningEffort(savedEffort)
      setTranslationReasoningEffort(savedTranslationEffort)
      setFastMode(savedFastMode)
      setTheme(preferences.theme as Theme)
      document.documentElement.dataset.theme = preferences.theme
      setModels([selectedModel])
    }).catch(() => setError('Chưa tải được cài đặt.'))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const showSettings = () => {invalidateReply();setMode('settings')}
    window.addEventListener('linguahub:settings', showSettings)
    return () => window.removeEventListener('linguahub:settings', showSettings)
  }, [])

  const saveModel = (value: string) => {
    invalidateReply()
    setModel(value)
    setError('')
    void window.lingua.setPreferences({ theme, model: value }).catch(() => setError('Không lưu được mô hình AI.'))
    const slug = value.startsWith('chatgpt:') ? value.slice(8) : ''
    if (isGpt6Model(slug) && !modelReasoningEfforts[slug]?.includes('none') && reasoningEffort === 'none') {
      setReasoningEffort('low')
      void window.lingua.setReasoningEffort('low').catch(() => setError('Không lưu được mức suy luận.'))
    }
  }

  const saveReasoningEffort = (value: ReasoningEffort) => {
    setReasoningEffort(value)
    setError('')
    void window.lingua.setReasoningEffort(value).catch(() => setError('Không lưu được mức suy luận.'))
  }

  const saveTranslationReasoningEffort = (value: ReasoningEffort) => {
    setTranslationReasoningEffort(value)
    setError('')
    void window.lingua.setTranslationReasoningEffort(value).catch(() => setError('Không lưu được mức suy luận khi dịch.'))
  }

  const saveFastMode = (enabled: boolean) => {
    setFastMode(enabled)
    setError('')
    void window.lingua.setFastMode(enabled).catch(() => setError('Không lưu được chế độ tăng tốc.'))
  }

  const changeTheme = (next: Theme) => {
    setTheme(next)
    document.documentElement.dataset.theme = next
    void window.lingua.setPreferences({ theme: next, model }).catch(() => setError('Không lưu được giao diện.'))
  }

  const connectOllama = async () => {
    setError('')
    try {
      const values = await window.lingua.listModels()
      if (!values.length) { setError('Ollama chưa có mô hình. Anh cần cài mô hình trên máy.'); return }
      setModels(values)
      saveModel(values[0])
    } catch {
      setError('Chưa kết nối được Ollama. Anh kiểm tra Ollama đang chạy trên máy.')
    }
  }

  const connectChatGPT = async () => {
    setError('')
    try {
      const values = await window.lingua.chatgptModels()
      if (!values.length) { setError('Tài khoản ChatGPT chưa có mô hình khả dụng.'); return }
      const names = values.map(value => 'chatgpt:' + value.slug)
      setModelReasoningEfforts(Object.fromEntries(values.map(value=>[value.slug,value.reasoningEfforts||[]])))
      setModels(names)
      saveModel(names.includes(DEFAULT_CHATGPT_MODEL) ? DEFAULT_CHATGPT_MODEL : names[0])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa lấy được mô hình ChatGPT. Anh hãy đăng nhập trong Cài đặt.')
    }
  }

  const generateReply = async (contextual:boolean) => {
    if(!model||busy||(!contextual&&!input.trim()))return
    invalidateReply()
    const generation=requestGeneration.current
    const requestId=crypto.randomUUID()
    activeReply.current=requestId
    const valid=()=>generation===requestGeneration.current&&activeReply.current===requestId
    setBusy(true);setError('')
    try{
      let authorized=await window.lingua.hasVisibleChatReadAuthorization()
      if(!valid())return
      if(!authorized){authorized=await window.lingua.authorizeVisibleChatRead();if(!valid())return}
      if(!authorized){setError('Anh chưa cho phép đọc chữ chat đang hiển thị.');return}
      const snapshot=authorized?await window.lingua.readVisibleChat():null
      if(!valid())return
      if(!snapshot?.conversationId||(contextual&&!snapshot.messages.length))throw new Error('Chưa xác định được cuộc trò chuyện đang hiển thị.')
      if(snapshot?.conversationId){replyConversation.current=snapshot.conversationId;setBoundConversation(snapshot.conversationId)}
      const matches=async()=>{
        if(!valid())return false
        if(!snapshot)return true
        const current=await window.lingua.readVisibleChat()
        if(!valid())return false
        if(current?.conversationId!==snapshot.conversationId){invalidateReply();return false}
        return true
      }
      if(model.startsWith('chatgpt:')){
        const allowed=await (contextual?window.lingua.allowBackgroundCloud():window.lingua.allowCloud())
        if(!valid())return
        if(!allowed){setError('Anh chưa cho phép xử lý nội dung bằng ChatGPT.');return}
      }
      if(!await matches()||!valid())return
      const payload=contextual?JSON.stringify({messages:recentChatContext(snapshot!.messages),intent:input.trim()||undefined}):input
      const result=await window.lingua.runAi(contextual?'replyFromChat':'reply',payload,model,requestId,{replyFast:model.startsWith('chatgpt:')&&replyFast})
      if(!valid())return
      if(!await matches()||!valid())return
      setOutput(result)
    }catch(failure){if(valid())setError(failure instanceof Error?failure.message:'Chưa tạo được gợi ý. Anh thử lại.')}
    finally{if(activeReply.current===requestId)activeReply.current=null;if(generation===requestGeneration.current)setBusy(false)}
  }
  const sendReplyRequest=()=>generateReply(false)
  const sendContextualReplyRequest=()=>generateReply(true)

  return <div className="assistant-shell">
    <div className="assistant-heading">
      <div>
        <h2>Bản dịch tiếng Việt</h2>
        <p>Đọc tin nhắn dễ dàng hơn</p>
      </div>
    </div>

    <div className="assistant-content">
      <div className="meeting-modes" role="group" aria-label="Chế độ dịch"><button type="button" aria-pressed={!meetingMode} onClick={()=>{invalidateReply();setMeetingMode(false)}}>Dịch tin nhắn</button><button type="button" disabled={service!=='teams'} aria-pressed={meetingMode} onClick={()=>{invalidateReply();setMeetingMode(true)}}>Dịch cuộc họp</button></div>
      {service==='zalo'&&<p className="translation-empty">Zalo Web có phiên đăng nhập riêng. Bản này hỗ trợ mở và dùng Zalo, chưa hỗ trợ tự đọc/dịch hội thoại Zalo.</p>}
      {service==='zalo-pc'&&mode==='translate'&&<NativeZaloTranslation model={model}/>}
      {service==='teams'&&!meetingMode&&<p className="meeting-hint">Đang ở chế độ dịch tin nhắn. Để đọc phụ đề khi họp: chọn <button type="button" onClick={()=>{invalidateReply();setMeetingMode(true)}}>Dịch cuộc họp</button>, bật phụ đề English trong Teams rồi bấm Bắt đầu dịch.</p>}
      {meetingMode&&mode==='translate'&&<MeetingTranslation model={model}/>}

      {/* Keep the translation component mounted: changing tabs or hiding the panel must not stop visible chat reading. */}
      <div style={{ display: mode === 'translate' && !meetingMode && service!=='zalo' && service!=='zalo-pc' ? 'block' : 'none' }} aria-hidden={mode !== 'translate'}>
        <LiveTranslation model={model} />
        <details className="reply-suggestions" onToggle={event=>{if(!event.currentTarget.open)invalidateReply()}}>
          <summary>Gợi ý trả lời</summary>
          <div className="reply-view">
            <p className="helper-text">AI đọc các tin nhắn đang hiển thị để gợi ý cách trả lời bằng tiếng Anh. Anh có thể thêm ý riêng hoặc để trống.</p>
            <label htmlFor="reply-input">Ý anh muốn bổ sung (không bắt buộc)</label>
            <textarea ref={intentRef} id="reply-input" value={input} maxLength={2000} onChange={event => { setInput(event.target.value); invalidateReply() }} placeholder="Ví dụ: Tôi sẽ kiểm tra lại và phản hồi vào sáng mai." />
            <button type="button" onClick={()=>{intentRef.current?.focus();setVoiceHelp(true)}}>🎙 Nhập giọng nói Windows (Win+H)</button>
            {voiceHelp && <p role="status" className="helper-text">Đặt ngôn ngữ bàn phím là Tiếng Việt, nhấn Win+H rồi nói. Windows quản lý quyền microphone và có thể dùng xử lý trực tuyến theo cài đặt của anh. Dừng hoặc đóng thanh Win+H để kết thúc. LinguaHub chưa tích hợp STT cục bộ, không thu hay lưu âm thanh. Anh sửa chữ trong ô rồi tự bấm tạo gợi ý.</p>}
            <label className="checkbox-label"><input type="checkbox" checked={model.startsWith('chatgpt:')&&replyFast} disabled={!model.startsWith('chatgpt:')} onChange={event=>{invalidateReply();setReplyFast(event.target.checked)}} /> Trả lời nhanh ChatGPT (Low/Medium được model công bố)</label>
            {!model.startsWith('chatgpt:') && <p className="helper-text">Ollama dùng cấu hình của model cục bộ; tùy chọn Low/Medium này không áp dụng.</p>}
            {!model && <p className="helper-text">Anh hãy chọn dịch vụ AI trong phần Cài đặt.</p>}
            <button type="button" className="primary-button" disabled={!model || busy} onClick={() => void sendContextualReplyRequest()}>{busy ? 'Đang đọc chat và tạo gợi ý…' : 'Đọc chat & gợi ý trả lời'}</button>
            {input.trim() && <button type="button" className="secondary-button reply-manual-button" disabled={!model || busy} onClick={() => void sendReplyRequest()}>Chỉ dùng ý tôi nhập</button>}
            {output !== null && <div className="reply-results"><AiResult result={output} /></div>}
            <p className="helper-text">Chỉ lấy chữ trong các tin đang hiển thị. Ứng dụng không tự gửi tin nhắn; anh xem và tự chọn câu trả lời.</p>
          </div>
        </details>
      </div>

      {mode === 'settings' && <div className="settings-view">
        <div className="settings-title"><h3>Cài đặt</h3><button type="button" onClick={() => setMode('translate')}>← Quay lại bản dịch</button></div>
        <div className="settings-group">
          <h4>Dịch vụ AI</h4>
          <p className="helper-text">Chọn ChatGPT hoặc Ollama. Ứng dụng không tự sử dụng API trả phí.</p>
          <div className="settings-actions">
            <button type="button" onClick={() => void connectChatGPT()}>Chọn ChatGPT</button>
            <button type="button" onClick={() => void connectOllama()}>Chọn Ollama</button>
          </div>
          <label htmlFor="model-choice">Mô hình AI đang sử dụng</label>
          <select id="model-choice" value={model} onChange={event => saveModel(event.target.value)}>
            <option value="">Chưa chọn mô hình</option>
            {models.includes(model) || !model ? null : <option value={model}>{modelLabel(model)}</option>}
            {models.map(name => <option key={name} value={name}>{modelLabel(name)}</option>)}
          </select>
          <p className="helper-text">Đang chọn: {modelLabel(model)}{model.startsWith('chatgpt:') && isGpt6Model(model.slice(8)) ? ` · ${reasoningEffortLabels[reasoningEffort]}` : ''}</p>
          {model.startsWith('chatgpt:') && isGpt6Model(model.slice(8)) && <>
            <label htmlFor="reasoning-effort">Mức suy luận cho tác vụ khác</label>
            <select id="reasoning-effort" value={reasoningEffort} onChange={event => saveReasoningEffort(event.target.value as ReasoningEffort)}>
              {REASONING_EFFORTS.filter(effort => effort !== 'none' || modelReasoningEfforts[model.slice(8)]?.includes('none')).map(effort => <option key={effort} value={effort}>{reasoningEffortLabels[effort]}</option>)}
            </select>
            <p className="helper-text">Mặc định Max; áp dụng cho gợi ý trả lời và các tác vụ AI khác.</p>
            <label htmlFor="translation-reasoning-effort">Mức suy luận cho tác vụ dịch</label>
            <select id="translation-reasoning-effort" value={translationReasoningEffort} onChange={event => saveTranslationReasoningEffort(event.target.value as ReasoningEffort)}>
              {REASONING_EFFORTS.filter(effort => effort !== 'none' || modelReasoningEfforts[model.slice(8)]?.includes('none')).map(effort => <option key={effort} value={effort}>{reasoningEffortLabels[effort]}</option>)}
            </select>
            <p className="helper-text">Mặc định Low để dịch nhanh hơn; có cấu hình riêng, không đổi mức của tác vụ khác.</p>
            <label className="checkbox-label"><input type="checkbox" checked={fastMode} onChange={event => saveFastMode(event.target.checked)} /> Ưu tiên tốc độ khi dịch</label>
            <p className="helper-text">Chỉ áp dụng cho dịch: khi bật sẽ dùng Low; tắt để quay lại mức {reasoningEffortLabels[translationReasoningEffort]}.</p>
          </>}
        </div>
        <div className="settings-group">
          <h4>Tài khoản ChatGPT</h4>
          <ChatGPTAccount />
        </div>
        <div className="settings-group">
          <h4>Giao diện</h4>
          <label htmlFor="theme-choice">Chế độ hiển thị</label>
          <select id="theme-choice" value={theme} onChange={event => changeTheme(event.target.value as Theme)}>
            <option value="light">Sáng</option>
            <option value="dark">Tối</option>
          </select>
        </div>
        <div className="settings-group">
          <h4>Quyền riêng tư</h4>
          <label className="checkbox-label"><input type="checkbox" checked={masking} onChange={async event => { const next = event.target.checked; try { await window.lingua.setMasking(next); setMasking(next) } catch { setError('Không cập nhật được quyền riêng tư.') } }}/> Che email và số điện thoại trước khi gửi AI</label>
          <p className="helper-text">Chức năng che thông tin có thể bỏ sót dữ liệu nhạy cảm. Chỉ bật dịch cloud khi anh đồng ý.</p>
        </div>
        <details className="advanced-settings"><summary>Cài đặt nâng cao</summary><AdvancedSettings /></details>
      </div>}
    </div>
    {error && <p className="assistant-error" role="alert">{error}</p>}
  </div>
}
