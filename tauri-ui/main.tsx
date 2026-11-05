import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

type Service = 'whatsapp' | 'teams' | 'zalo' | 'outlook'
type Tone = 'professional' | 'friendly' | 'concise'
type Msg = { id?: string; side: 'left' | 'right' | 'center'; text: string }
type Snapshot = { conversationId: string; messages: Msg[]; service: Service }
type Preferences = { theme: string; model: string; panelWidth: number; masking: boolean }
type Suggestion = { style: string; vietnamese: string; english: string; explanation: string }

declare global {
  interface Window {
    __TAURI__?: { core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> } }
  }
}
function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!window.__TAURI__) return Promise.reject(new Error('Tauri runtime unavailable. Run the Windows application.'))
  return window.__TAURI__.core.invoke<T>(command, args)
}
const SERVICES: { id: Service; name: string; short: string; description: string }[] = [
  { id: 'whatsapp', name: 'WhatsApp', short: 'WA', description: 'Tin nhắn WhatsApp Web' },
  { id: 'teams', name: 'Microsoft Teams', short: 'MT', description: 'Teams Chat và cuộc họp' },
  { id: 'zalo', name: 'Zalo Web', short: 'ZL', description: 'Zalo Web' },
  { id: 'outlook', name: 'Outlook', short: 'OL', description: 'Đọc email Outlook' },
]
const TONES: {id: Tone; label: string}[] = [
  {id: 'professional', label: 'Chuyên nghiệp'},
  {id: 'friendly', label: 'Thân thiện'},
  {id: 'concise', label: 'Ngắn gọn'},
]
const MAX_CONTEXT = 20
function recent(messages: Msg[]) {
  let budget = 9000
  const selected: Array<{side: Msg['side'];text: string}> = []
  for (const item of messages.slice(-MAX_CONTEXT).reverse()) {
    const text = item.text.trim().slice(0, Math.min(2000, budget - 32))
    if (!text) continue
    const candidate = {side: item.side, text}
    const bytes = new TextEncoder().encode(JSON.stringify(candidate)).length + 1
    if (bytes > budget) break
    selected.unshift(candidate)
    budget -= bytes
  }
  return selected
}
function errorText(error: unknown) {
  return typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thực hiện được thao tác.'
}
function Button({children, onClick, disabled, secondary = false}: {
  children: React.ReactNode; onClick(): void; disabled?: boolean; secondary?: boolean
}) {return <button type="button" className={'btn '+(secondary?'secondary':'primary')} disabled={disabled} onClick={onClick}>{children}</button>}

function App() {
  const [service, setService] = useState<Service>('whatsapp')
  const [panelWidth, setPanelWidth] = useState(400)
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(true)
  const [masking, setMasking] = useState(true)
  const [connected, setConnected] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [modelStatus, setModelStatus] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [translations, setTranslations] = useState<{id:string;translation:string}[]>([])
  const [draft, setDraft] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [preview, setPreview] = useState('')
  const [previewSource, setPreviewSource] = useState('')
  const [previewContext, setPreviewContext] = useState<string | null>(null)
  const [previewSettings, setPreviewSettings] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Đang khởi động Tauri Rust…')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'translate'|'settings'>('translate')
  const generation = useRef(0)
  const resize = useRef(false)
  const settingsKey = useMemo(() => JSON.stringify([service, model, tone]), [service, model, tone])
  const canCopy = Boolean(preview.trim() && previewSource.trim() === draft.trim()
    && previewSettings === settingsKey && previewContext && snapshot?.conversationId === previewContext && !busy)
  const widthRef = useRef(panelWidth)
  widthRef.current = panelWidth

  const invalidate = useCallback(() => {
    generation.current++
    setPreviewContext(null)
    setSuggestions([])
    setTranslations([])
    setSummary('')
    setSnapshot(null)
    setBusy(false)
  }, [])

  const updateLayout = useCallback((nextWidth?: number, nextCollapsed?: boolean) => {
    void call('set_layout', {
      width: window.innerWidth,
      height: window.innerHeight,
      panelWidth: nextWidth ?? widthRef.current,
      collapsed: nextCollapsed ?? collapsed,
    }).catch(e => setError(errorText(e)))
  }, [collapsed])

  const refreshModels = useCallback(async () => {
    try {
      const found = await call<string[]>('ollama_models')
      setModels(found)
      setModelStatus(found.length ? 'Ollama đang chạy trên máy' : 'Ollama chưa có mô hình. Chạy: ollama pull llama3.2')
      setModel(current => found.includes(current) ? current : (found[0] || ''))
    } catch (e) {
      setModels([])
      setModelStatus('Chưa kết nối Ollama (127.0.0.1:11434). Cần cài và chạy Ollama.')
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([call<Preferences>('get_preferences'), call<boolean>('chat_read_authorized')])
      .then(([prefs, access]) => {
        if (!active) return
        setDark(prefs.theme !== 'light')
        setMasking(prefs.masking)
        setPanelWidth(prefs.panelWidth || 400)
        setModel(prefs.model)
        setAuthorized(access)
      }).catch(e => setError(errorText(e)))
    void call<string>('open_service', {service: 'whatsapp'})
      .then(() => {if (active) {setConnected(true);setStatus('Đã mở WhatsApp trong WebView2')}})
      .catch(e => {if (active) setError(errorText(e))})
    void refreshModels()
    return () => {active = false;generation.current++}
  }, [refreshModels])

  useEffect(() => {
    const sync = () => updateLayout()
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [updateLayout, panelWidth, collapsed])

  const changeService = async (next: Service) => {
    if (next === service) return
    invalidate()
    setService(next)
    setError('')
    setStatus('Đang mở ' + SERVICES.find(s => s.id === next)?.name)
    try {
      await call('open_service', {service: next})
      setConnected(true)
      setStatus('Đã mở '+ next + ' trong WebView2')
    } catch (e) {setError(errorText(e))}
  }

  const authorize = async () => {
    if (authorized) {
      await call('authorize_chat_read', {allowed: false})
      setAuthorized(false)
      invalidate()
      return
    }
    const approved = window.confirm(
      'Cho phép LinguaHub đọc chỉ các tin nhắn đang hiển thị trong cửa sổ chat để dịch? Nội dung được xử lý cục bộ bằng Ollama. Có thể tắt quyền bất cứ lúc nào.'
    )
    if (!approved) return
    try {
      setAuthorized(await call<boolean>('authorize_chat_read', {allowed: true}))
      setStatus('Đã bật quyền đọc chat hiển thị trong phiên này')
    } catch (e) {setError(errorText(e))}
  }

  const read = async (): Promise<Snapshot> => {
    const data = await call<Snapshot>('read_visible_chat')
    if (data.service !== service) throw new Error('Đã chuyển nền tảng, bỏ kết quả cũ.')
    if (snapshot && snapshot.conversationId !== data.conversationId) {
      invalidate()
      setStatus('Đã đổi hội thoại. Bản xem trước cũ bị khóa.')
    }
    setSnapshot(data)
    return data
  }

  const ai = async (task: string, input: string): Promise<Record<string, any>> => {
    if (!model) throw new Error('Chưa chọn model Ollama.')
    return await call<Record<string, any>>('ollama_ai', {task, text: input, model})
  }

  const run = async (fn:(token:number)=>Promise<void>) => {
    const token = ++generation.current
    setError('')
    setBusy(true)
    try {await fn(token)} catch (e) {if (token === generation.current) setError(errorText(e))}
    finally {if (token === generation.current) setBusy(false)}
  }

  const translateVisible = () => void run(async token => {
    const data = await read()
    if (!data.messages.length) throw new Error('Chưa thấy tin nhắn trong vùng chat đang hiển thị.')
    const selected = data.messages.slice(-8).map((m,i) => ({id: m.id || 'm'+i, text: m.text}))
    const answer = await ai('translateMessages', JSON.stringify({messages: selected}))
    if (token !== generation.current) return
    const again = await read()
    if (again.conversationId !== data.conversationId) throw new Error('Đã đổi hội thoại, cần dịch lại.')
    const translations = Array.isArray(answer.translations) ? answer.translations : []
    setTranslations(translations.filter((m:any) => typeof m.id === 'string' && typeof m.translation === 'string'))
    setStatus('Đã dịch tin nhắn bằng Rust + Ollama')
  })

  const translateDraft = () => void run(async token => {
    const source = draft.trim()
    if (!source) throw new Error('Hãy nhập câu tiếng Việt trước.')
    if (!authorized) throw new Error('Cần cho phép đọc ngữ cảnh hội thoại.')
    const before = await read()
    if (!before.messages.length) throw new Error('Chưa có ngữ cảnh chat đang hiển thị.')
    const response = await ai('replyTranslationFromChat', JSON.stringify({
      messages: recent(before.messages), draft: source, tone,
    }))
    if (token !== generation.current || source !== draft.trim()) return
    const after = await read()
    if (before.conversationId !== after.conversationId) throw new Error('Hội thoại đã đổi. Không dùng bản dịch cũ.')
    if (typeof response.translation !== 'string') throw new Error('Bản dịch trả về không hợp lệ.')
    setPreview(response.translation)
    setPreviewSource(source)
    setPreviewContext(after.conversationId)
    setPreviewSettings(settingsKey)
    setStatus('Đã tạo bản tiếng Anh. Kiểm tra nội dung trước khi sao chép.')
  })

  const suggestReplies = () => void run(async token => {
    const before = await read()
    if (!before.messages.length) throw new Error('Chưa có tin nhắn để tạo gợi ý.')
    const response = await ai('replyFromChat', JSON.stringify({messages: recent(before.messages)}))
    if (token !== generation.current) return
    const after = await read()
    if (before.conversationId !== after.conversationId) throw new Error('Đã đổi hội thoại.')
    setSuggestions(Array.isArray(response.replies) ? response.replies : [])
  })

  const summarize = () => void run(async token => {
    const before = await read()
    if (!before.messages.length) throw new Error('Chưa thấy tin nhắn.')
    const response = await ai('summary', JSON.stringify({messages: recent(before.messages)}))
    if (token !== generation.current) return
    setSummary(typeof response.summary === 'string' ? response.summary : '')
  })

  const chooseSuggestion = (item: Suggestion) => {
    setDraft(item.vietnamese)
    setPreview(item.english)
    setPreviewSource(item.vietnamese)
    setPreviewContext(snapshot?.conversationId || null)
    const mapped: Tone = item.style === 'friendly' ? 'friendly' : item.style === 'simple' ? 'concise' : 'professional'
    setTone(mapped)
    setPreviewSettings(JSON.stringify([service, model, mapped]))
  }

  const copy = () => void run(async token => {
    if (!canCopy) throw new Error('Bản xem trước không còn hợp lệ.')
    const before = await read()
    if (!previewContext || previewContext !== before.conversationId) throw new Error('Đã đổi hội thoại.')
    if (token !== generation.current) return
    await call('copy_english_preview', {
      english: preview, draft, previewSource, conversationId: previewContext,
      previewSettings, currentSettings: settingsKey, busy: false,
    })
    setStatus('Đã sao chép. Hãy tự dán và kiểm tra đúng người nhận trước khi gửi.')
  })

  const saveSettings = (theme: 'dark' | 'light', nextMasking: boolean, nextModel: string) => {
    setDark(theme === 'dark');setMasking(nextMasking);setModel(nextModel)
    void call('set_preferences', {theme, masking: nextMasking, model: nextModel})
      .catch(e => setError(errorText(e)))
  }

  const setPanel = (width:number) => {
    const next = Math.min(560, Math.max(300,width))
    setPanelWidth(next); widthRef.current = next
    updateLayout(next)
  }

  const showNativeCapabilities = () => void call<Record<string,any>>('app_capabilities').then(
    info => window.alert(JSON.stringify(info,null,2))
  ).catch(e => setError(errorText(e)))

  return <div className={'app '+(dark?'dark':'light')} data-app="tauri-rust">
    <header className="header">
      <div className="brand"><div className="brand-icon">L</div><span>LinguaHub <b>AI</b><small>RUST</small></span></div>
      <nav aria-label="Nền tảng chat" className="tabs">
        {SERVICES.map(item => <button key={item.id} type="button"
          className={'tab '+(service===item.id?'active':'')}
          onClick={() => void changeService(item.id)}>{item.name}</button>)}
      </nav>
      <div className="header-right"><span className="connection"><i className={connected?'online':'offline'}/>{connected?'WebView2':'Offline'}</span>
        <button title="Tải lại trang" type="button" onClick={() => void call('reload_service').catch(e=>setError(errorText(e)))}>↻</button>
        <button title="Cài đặt" type="button" onClick={() => setMode(m => m === 'translate'?'settings':'translate')}>⚙</button>
        <button title="Thu gọn panel" type="button" onClick={() => setCollapsed(v=>!v)}>◧</button>
      </div>
    </header>
    <main className="layout">
      <div className="workspace">
        <div className="fallback">
          <h2>{SERVICES.find(item=>item.id===service)?.name}</h2>
          <p>Trang chat được mở trong WebView2 riêng, giữ phiên đăng nhập trên máy.</p>
          <span>Đang kết nối dịch vụ…</span>
        </div>
      </div>
      {!collapsed && <div className="resizer" role="separator" aria-label="Kéo chỉnh panel"
        onPointerDown={e => {resize.current=true;e.currentTarget.setPointerCapture(e.pointerId)}}
        onPointerMove={e => {if(resize.current) setPanel(Math.round(window.innerWidth-e.clientX))}}
        onPointerUp={e => {resize.current=false;e.currentTarget.releasePointerCapture(e.pointerId)}}
      />}
      <aside className={'panel '+(collapsed?'collapsed':'')} style={{width:collapsed?58:panelWidth}}>
        {collapsed ? <button className="expand" onClick={()=>setCollapsed(false)} title="Mở panel">‹</button> :
          <div className="panel-scroll">
            {mode === 'translate' ? <>
              <div className="panel-title"><span>Trợ lý dịch hội thoại</span><span className="rust-label">RUST NATIVE</span></div>
              <p className="intro">Dịch và soạn câu trả lời tiếng Anh dựa trên hội thoại đang mở.</p>
              <section className="card compact">
                <div className="line"><strong>Model AI · Ollama cục bộ</strong><button className="small-text" onClick={()=>void refreshModels()}>↻ Quét</button></div>
                <select value={model} onChange={e=>saveSettings(dark?'dark':'light',masking,e.target.value)}>
                  {!models.length&&<option value="">Chưa có model</option>}
                  {models.map(name=><option key={name} value={name}>{name}</option>)}
                </select>
                <p className="hint">{modelStatus}</p>
                <div className="line consent"><span>Đọc tin chat đang hiển thị</span>
                  <button className={authorized?'toggle enabled':'toggle'} onClick={()=>void authorize()}>{authorized?'Đang bật':'Cho phép'}</button></div>
              </section>
              <section className="card">
                <div className="card-heading"><h3>Tin nhắn cần dịch</h3><span>{snapshot?.messages.length||0} tin</span></div>
                <div className="actions">
                  <Button onClick={translateVisible} disabled={busy||!authorized||!model}>Dịch tin mới</Button>
                  <Button secondary onClick={summarize} disabled={busy||!authorized||!model}>Tóm tắt</Button>
                </div>
                {translations.length>0&&<div className="messages">
                  {translations.map((msg,i)=><div className="message" key={msg.id+'-'+i}>{msg.translation||<em>Tin không phải tiếng Anh</em>}</div>)}</div>}
                {summary&&<div className="summary">{summary}</div>}
                {!snapshot&&<p className="hint">Bấm “Dịch tin mới” sau khi mở cuộc trò chuyện. Không tự động gửi nội dung lên AI.</p>}
              </section>
              <section className="card">
                <div className="card-heading"><h3>Soạn câu trả lời</h3><span>Việt → Anh</span></div>
                <label htmlFor="draft">Câu trả lời tiếng Việt</label>
                <textarea id="draft" value={draft} onChange={e=>setDraft(e.target.value)} rows={4}
                  placeholder="Ví dụ: Em sẽ kiểm tra lại PO và phản hồi anh vào ngày mai."/>
                <label htmlFor="tone">Giọng điệu</label>
                <select id="tone" value={tone} onChange={e=>setTone(e.target.value as Tone)}>
                  {TONES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <div className="actions">
                  <Button onClick={translateDraft} disabled={!draft.trim()||busy||!authorized||!model}>Dịch theo ngữ cảnh</Button>
                  <Button secondary onClick={suggestReplies} disabled={busy||!authorized||!model}>3 gợi ý AI</Button>
                </div>
                {suggestions.length>0&&<div className="suggestions">{suggestions.map((s,i)=>
                  <button type="button" key={i} onClick={()=>chooseSuggestion(s)}>
                    <strong>{s.style}</strong><span>{s.english}</span><small>{s.vietnamese}</small>
                  </button>)}</div>}
                <label htmlFor="preview">Bản tiếng Anh · Có thể chỉnh sửa</label>
                <textarea id="preview" value={preview} onChange={e=>setPreview(e.target.value)} rows={4} placeholder="English reply preview" />
                {!canCopy&&preview&&<p className="warning">Bản nháp hoặc ngữ cảnh có thể đã thay đổi. Dịch lại trước khi sao chép.</p>}
                <Button onClick={copy} disabled={!canCopy}>Sao chép bản đã duyệt</Button>
                <p className="hint">Tự dán và kiểm tra đúng người nhận trước khi gửi. Ứng dụng không tự gửi.</p>
              </section>
              <section className="card compact">
                <div className="line"><strong>Quyền riêng tư</strong><span>On-device</span></div>
                <p className="hint">Nội dung chỉ đọc sau khi cho phép. Model Ollama chạy tại máy; khóa lại khi đổi hội thoại.</p>
              </section>
            </> : <>
              <div className="panel-title">Cài đặt Rust</div>
              <section className="card">
                <h3>Giao diện</h3>
                <div className="line"><label>Chế độ tối</label>
                  <input type="checkbox" checked={dark} onChange={e=>saveSettings(e.target.checked?'dark':'light',masking,model)}/></div>
                <div className="line"><label>Ẩn email/số điện thoại</label>
                  <input type="checkbox" checked={masking} onChange={e=>saveSettings(dark?'dark':'light',e.target.checked,model)}/></div>
                <label>Độ rộng panel ({panelWidth}px)</label>
                <input type="range" min={300} max={560} value={panelWidth} onChange={e=>setPanel(Number(e.target.value))} />
                <Button secondary onClick={showNativeCapabilities}>Xem tính năng hiện có</Button>
              </section>
              <section className="card"><h3>Giới hạn bản này</h3>
                <p>Chưa chuyển ChatGPT OAuth, Zalo PC embedding, quản lý từ vựng và gửi trực tiếp. Microphone/camera của Teams vẫn phụ thuộc quyền WebView2 và cần kiểm thử tài khoản thật.</p>
              </section>
              <Button secondary onClick={()=>setMode('translate')}>Quay lại dịch</Button>
            </>}
            {error&&<div className="error" role="alert">⚠ {error}</div>}
            <div className="status" role="status">{busy?'Đang xử lý bằng Ollama…':status}</div>
          </div>}
      </aside>
    </main>
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)
