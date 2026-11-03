import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { AiPanel } from './AiPanel'

type WorkspaceService = 'whatsapp' | 'teams' | 'zalo'
type UiService=WorkspaceService|'zalo-pc'

declare global {
  interface Window {
    lingua: {
      openZaloPc():Promise<{status:'ready'|'opened'|'cancelled';arranged:boolean}>
      releaseZaloPc():Promise<boolean>
      onShortcut(callback: (action: string) => void): () => void
      reloadWorkspace(): Promise<{ title: string }>
      setWorkspacePanelLayout(width: number, collapsed: boolean, persist?: boolean): void
      openWorkspace(service: WorkspaceService): Promise<{ title: string }>
      showDashboard(): Promise<boolean>
      openExternal(service: WorkspaceService): Promise<void>
      testNotification(): Promise<boolean>
      getNotificationPreferences(): Promise<{ whatsapp: boolean; teams: boolean }>
      setNotificationPreference(service: WorkspaceService, enabled: boolean): Promise<{ whatsapp: boolean; teams: boolean }>
      authorizeVisibleChatRead(): Promise<boolean>
      hasVisibleChatReadAuthorization(): Promise<boolean>
      stopVisibleChatRead(): Promise<void>
      readVisibleChat(): Promise<{ conversationId: string; text: string; messages: Array<{ text: string; side: 'left' | 'right' | 'center'; id?: string }> } | null>
      onVisibleChatChanged(callback: (change: {service:WorkspaceService;observedAt:number}) => void): () => void
      listVocabulary(): Promise<import('./Vocabulary').Word[]>
      addVocabulary(input: { term: string; meaning: string }): Promise<void>
      reviewVocabulary(id: string, remembered: boolean): Promise<void>
      getLearningProgress(): Promise<{ totalWords: number; reviewedWords: number; dueWords: number; reviewsToday: number; lessonsToday: number; lessonCompletedToday: boolean; studyStreak: number; aiRequestsToday: number; ollamaRequestsToday: number; chatgptRequestsToday: number }>
      completeDailyLesson(): Promise<boolean>
      getDataRetentionDays(): Promise<number>
      setDataRetentionDays(days: number): Promise<boolean>
      clearLocalData(): Promise<{ cleared: boolean; chatgptRevoked: boolean }>
      getPreferences(): Promise<{ theme: string; model: string; panelWidth: number }>
      setPreferences(input: { theme: string; model: string }): Promise<void>
      getReasoningEffort(): Promise<import('../../shared/model-reasoning').ReasoningEffort>
      setReasoningEffort(value: import('../../shared/model-reasoning').ReasoningEffort): Promise<import('../../shared/model-reasoning').ReasoningEffort>
      getTranslationReasoningEffort(): Promise<import('../../shared/model-reasoning').ReasoningEffort>
      setTranslationReasoningEffort(value: import('../../shared/model-reasoning').ReasoningEffort): Promise<import('../../shared/model-reasoning').ReasoningEffort>
      getFastMode(): Promise<boolean>
      setFastMode(enabled: boolean): Promise<boolean>
      clearVocabulary(): Promise<boolean>
      disconnectChatGPT(): Promise<{ revoked: boolean }>
      openChatGPTUsageSettings(): Promise<void>
      setMasking(enabled: boolean): Promise<void>
      allowCloud(): Promise<boolean>
      allowBackgroundCloud(): Promise<boolean>
      chatgptModels(): Promise<{ slug: string; name: string; reasoningEfforts?: import('../../shared/model-reasoning').ReasoningEffort[] }[]>
      connectChatGPT(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean }>
      connectChatGPTNewWorkspace(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean } | null>
      chatgptStatus(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean }>
      startMeeting(model:string):Promise<string|null>
      readMeeting(token:string):Promise<{diagnostics?:{captionMarkers:string[];iframeCount:number};session:string|null;segments:Array<{id:string;text:string;speaker:string;timestamp:number}>}>
      stopMeeting(token:string):Promise<void>
      translateMeeting(token:string,text:string,id:string):Promise<{translation:string}>
      listModels(): Promise<string[]>
      writeClipboardText(text: string): Promise<boolean>
      runAi(task: string, text: string, model: string, requestId?: string, options?: {replyFast:boolean}): Promise<unknown>
      onAiStream(requestId: string, callback: (delta: string) => void): () => void
      cancelAi(requestId: string): Promise<boolean>
    }
  }
}

function App() {
  const [activeService, setActiveService] = React.useState<UiService>('whatsapp')
  const [nativeArranged,setNativeArranged]=React.useState(false)
  const [nativeBusy,setNativeBusy]=React.useState(false)
  const operation=React.useRef(0)
  const [fallbackService, setFallbackService] = React.useState<WorkspaceService | null>(null)
  const [panelWidth, setPanelWidth] = React.useState(400)
  const [panelCollapsed, setPanelCollapsed] = React.useState(false)
  const [status, setStatus] = React.useState('Đang mở WhatsApp…')
  const [online, setOnline] = React.useState(navigator.onLine)
  const resizing = React.useRef(false)

  React.useEffect(() => {
    const refresh = () => setOnline(navigator.onLine)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [])

  React.useEffect(() => {
    void window.lingua.getPreferences().then(preferences => {
      setPanelWidth(preferences.panelWidth)
      document.documentElement.dataset.theme = preferences.theme
      document.documentElement.lang = 'vi'
    }).catch(() => {})
  }, [])

  const updatePanelWidth = (clientX: number, persist: boolean) => {
    const max = Math.min(560, window.innerWidth - 520)
    const width = Math.max(280, Math.min(max, Math.round(window.innerWidth - clientX)))
    setPanelWidth(width)
    window.lingua.setWorkspacePanelLayout(width, panelCollapsed, persist)
  }

  React.useEffect(() => {
    window.lingua.setWorkspacePanelLayout(panelWidth, panelCollapsed, false)
  }, [panelWidth, panelCollapsed])

  const open = React.useCallback(async (service: WorkspaceService) => {
    const current=++operation.current
    setNativeArranged(false);setNativeBusy(false)
    setActiveService(service)
    setFallbackService(null)
    window.dispatchEvent(new Event('linguahub:workspace'))
    window.dispatchEvent(new CustomEvent('linguahub:service',{detail:service}))
    setStatus(service === 'whatsapp' ? 'Đang mở WhatsApp…' : service==='zalo'?'Đang mở Zalo Web…':'Đang mở Teams…')
    try {
      await window.lingua.openWorkspace(service)
      if(current!==operation.current)return
      setStatus('Đã mở trang trò chuyện')
    } catch {
      if(current!==operation.current)return
      setFallbackService(service)
      setStatus('Không mở được trang trong ứng dụng.')
    }
  }, [])

  const openPc=async()=>{
    const current=++operation.current
    setActiveService('zalo-pc');setFallbackService(null);setNativeBusy(true);setPanelCollapsed(false)
    window.dispatchEvent(new Event('linguahub:workspace'))
    window.dispatchEvent(new CustomEvent('linguahub:service',{detail:'zalo-pc'}))
    setStatus('Đang mở Zalo PC…')
    try{const result=await window.lingua.openZaloPc();if(current!==operation.current)return
      setNativeArranged(result.arranged)
      setStatus(result.status==='cancelled'?'Đã hủy mở Zalo PC':result.arranged?'Zalo PC và trợ lý đang chạy cạnh nhau':'Đã mở Zalo PC riêng; chưa sắp xếp được cửa sổ. Anh mở cửa sổ chính Zalo rồi bấm Sắp xếp cạnh nhau.')
    }catch(failure){if(current===operation.current){setNativeArranged(false);setStatus(failure instanceof Error?failure.message:'Không mở được Zalo PC.')}}
    finally{if(current===operation.current)setNativeBusy(false)}
  }
  const releasePc=async()=>{const current=++operation.current;setNativeBusy(true);try{await window.lingua.releaseZaloPc();if(current===operation.current){setNativeArranged(false);setStatus('Zalo PC tiếp tục chạy độc lập.')}}catch{if(current===operation.current)setStatus('Chưa khôi phục được vị trí cửa sổ.')}finally{if(current===operation.current)setNativeBusy(false)}}

  React.useEffect(() => {
    void open('whatsapp')
  }, [open])

  const reload = React.useCallback(async () => {
    if(activeService==='zalo-pc')return
    window.dispatchEvent(new Event('linguahub:workspace'))
    setStatus('Đang tải lại trang…')
    try {
      await window.lingua.reloadWorkspace()
      setFallbackService(null)
      setStatus('Đã tải lại trang')
    } catch {
      setFallbackService(activeService)
      setStatus('Không thể tải lại trang.')
    }
  }, [activeService])

  React.useEffect(() => window.lingua.onShortcut(action => {
    if (action === 'whatsapp' || action === 'teams') void open(action)
    else if (action === 'dashboard') void open('whatsapp')
    else if (action === 'reload') void reload()
  }), [open, reload])

  const openFallback = async () => {
    if (!fallbackService) return
    try {
      await window.lingua.openExternal(fallbackService)
      setStatus('Đã mở trang trong trình duyệt mặc định.')
    } catch {
      setStatus('Không mở được trình duyệt mặc định.')
    }
  }

  return <div className={nativeArranged?'app pc-companion':'app'} lang="vi">
    <header className="topbar">
      <div className="topbar-brand"><span className="brand-mark">VI</span><span>LinguaHub <small>AI</small></span></div>
      {nativeArranged&&<button className="pc-return" onClick={()=>void open('whatsapp')}>← Trở về</button>}
      <nav className="workspace-tabs" aria-label="Chọn ứng dụng trò chuyện">
        <button type="button" className={activeService === 'whatsapp' ? 'workspace-tab active' : 'workspace-tab'} aria-current={activeService === 'whatsapp' ? 'page' : undefined} onClick={() => void open('whatsapp')}>WhatsApp</button>
        <button type="button" className={activeService === 'teams' ? 'workspace-tab active' : 'workspace-tab'} aria-current={activeService === 'teams' ? 'page' : undefined} onClick={() => void open('teams')}>Microsoft Teams</button>
        <button type="button" className={activeService==='zalo'?'workspace-tab active':'workspace-tab'} aria-current={activeService==='zalo'?'page':undefined} onClick={()=>void open('zalo')}>Zalo Web</button>
        <button type="button" disabled={nativeBusy} className={activeService==='zalo-pc'?'workspace-tab active':'workspace-tab'} aria-current={activeService==='zalo-pc'?'page':undefined} onClick={()=>void openPc()}>Zalo PC</button>
      </nav>
      <div className="topbar-actions">
        <span className={online ? 'connection-status' : 'connection-status offline'} title={status}>{online ? status : 'Máy đang ngoại tuyến'}</span>
        {activeService!=='zalo-pc'&&<button type="button" className="icon-button" title="Tải lại trang trò chuyện" aria-label="Tải lại trang" onClick={() => void reload()}>↻</button>}
        <button type="button" className="icon-button" title="Cài đặt" aria-label="Cài đặt" onClick={() => { if (panelCollapsed) setPanelCollapsed(false); window.dispatchEvent(new Event('linguahub:settings')) }}>⚙</button>
        {activeService!=='zalo-pc'&&<button type="button" className="icon-button" title={panelCollapsed ? 'Mở bản dịch' : 'Thu gọn bản dịch'} aria-label={panelCollapsed ? 'Mở bản dịch' : 'Thu gọn bản dịch'} onClick={() => setPanelCollapsed(value => !value)}>{panelCollapsed ? '▤' : '◧'}</button>}
      </div>
    </header>
    <div className="workspace-row">
      <main className="workspace" aria-label="Trang trò chuyện">
        {activeService==='zalo-pc'?<div className="workspace-fallback"><h2>Zalo PC trên máy</h2><p role="status">{status}</p><p>Zalo PC là cửa sổ riêng, giữ nguyên tính năng của Zalo. LinguaHub không đọc màn hình hoặc nội dung Zalo PC.</p><button disabled={nativeBusy} onClick={()=>void openPc()}>{nativeBusy?'Đang mở…':'Mở / Sắp xếp cạnh nhau'}</button><button onClick={()=>void open('zalo')}>Dùng Zalo Web</button></div>:fallbackService ? <div className="workspace-fallback"><h2>Chưa mở được trang trò chuyện</h2><p>Trang này có thể không hỗ trợ chạy bên trong ứng dụng. Anh có thể mở bằng trình duyệt.</p><button onClick={() => void openFallback()}>Mở bằng trình duyệt</button></div> : <div className="workspace-placeholder">Đang mở trang trò chuyện…</div>}
      </main>
      {!panelCollapsed && <div className="panel-resizer" role="separator" aria-label="Kéo để điều chỉnh độ rộng bản dịch" aria-orientation="vertical" onPointerDown={event => { resizing.current = true; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (resizing.current) updatePanelWidth(event.clientX, false) }} onPointerUp={event => { if (resizing.current) { resizing.current = false; updatePanelWidth(event.clientX, true) } }} onLostPointerCapture={() => { resizing.current = false }} />}
      <aside className={panelCollapsed ? 'panel panel-collapsed' : 'panel'} style={{width: panelCollapsed ? 56 : panelWidth}} aria-label="Trợ lý dịch tiếng Việt">
        {panelCollapsed && <button className="expand-panel" title="Mở bản dịch" aria-label="Mở bản dịch" onClick={() => setPanelCollapsed(false)}>›</button>}
        <div className={panelCollapsed ? 'panel-body panel-body-hidden' : 'panel-body'} aria-hidden={panelCollapsed}>
          {activeService==='zalo-pc'&&<div className="pc-toolbar"><p role="status">{status}</p><button disabled={nativeBusy} onClick={()=>void openPc()}>Sắp xếp cạnh nhau</button><button disabled={nativeBusy} onClick={()=>void releasePc()}>Dùng Zalo riêng</button><button onClick={()=>void open('whatsapp')}>Trở về LinguaHub</button></div>}
          <AiPanel />
        </div>
      </aside>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
