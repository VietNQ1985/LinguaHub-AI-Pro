import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import './dashboard.css'
import { AiPanel } from './AiPanel'

type WorkspaceService = 'whatsapp' | 'teams'

declare global {
  interface Window {
    lingua: {
      onShortcut(callback: (action: string) => void): () => void
      reloadWorkspace(): Promise<{ title: string }>
      setWorkspacePanelLayout(width: number, collapsed: boolean, persist?: boolean): void
      openWorkspace(service: WorkspaceService): Promise<{ title: string }>
      showDashboard(): Promise<boolean>
      openExternal(service: WorkspaceService): Promise<void>
      testNotification(): Promise<boolean>
      getNotificationPreferences(): Promise<{ whatsapp: boolean; teams: boolean }>
      setNotificationPreference(service: WorkspaceService, enabled: boolean): Promise<{ whatsapp: boolean; teams: boolean }>
      authorizeOcr(): Promise<boolean>
      getOcrAssetPaths(): Promise<{ workerUrl: string; corePath: string }>
      stopOcr(): Promise<void>
      readOcr(left: number): Promise<{ pngBase64: string; width: number; height: number } | null>
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
      clearVocabulary(): Promise<boolean>
      disconnectChatGPT(): Promise<{ revoked: boolean }>
      openChatGPTUsageSettings(): Promise<void>
      setMasking(enabled: boolean): Promise<void>
      allowCloud(): Promise<boolean>
      allowBackgroundCloud(): Promise<boolean>
      chatgptModels(): Promise<{ slug: string; name: string }[]>
      connectChatGPT(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean }>
      chatgptStatus(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean }>
      listModels(): Promise<string[]>
      runAi(task: string, text: string, model: string, requestId?: string): Promise<unknown>
      cancelAi(requestId: string): Promise<boolean>
    }
  }
}

function App() {
  const [online, setOnline] = React.useState(navigator.onLine)
  const [section, setSection] = React.useState('Tổng quan')
  const [activeService, setActiveService] = React.useState<WorkspaceService | null>(null)
  const [fallbackService, setFallbackService] = React.useState<WorkspaceService | null>(null)
  const [panelWidth, setPanelWidth] = React.useState(360)
  const [panelCollapsed, setPanelCollapsed] = React.useState(false)
  const [status, setStatus] = React.useState('Chọn không gian làm việc')
  const resizing = React.useRef(false)

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  React.useEffect(() => {
    void window.lingua.getPreferences().then(preferences => setPanelWidth(preferences.panelWidth)).catch(() => {})
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
    setSection('')
    setActiveService(service)
    setFallbackService(null)
    window.dispatchEvent(new Event('linguahub:workspace'))
    setStatus('Đang tải trang chính thức…')
    try {
      const result = await window.lingua.openWorkspace(service)
      setStatus(result.title)
    } catch {
      setFallbackService(service)
      setStatus('Website chưa tải được trong app. Có thể mở bằng trình duyệt mặc định; trợ lý vẫn dùng được.')
    }
  }, [])

  const reload = React.useCallback(async () => {
    if (!activeService) {
      setStatus('Anh mở WhatsApp hoặc Microsoft Teams trước.')
      return
    }
    window.dispatchEvent(new Event('linguahub:workspace'))
    setStatus('Đang tải lại…')
    try {
      const result = await window.lingua.reloadWorkspace()
      setFallbackService(null)
      setStatus(result.title)
    } catch {
      setFallbackService(activeService)
      setStatus('Không tải lại được. Anh có thể mở website trong trình duyệt ngoài app.')
    }
  }, [activeService])

  const openFallback = async () => {
    if (!fallbackService) return
    try {
      await window.lingua.openExternal(fallbackService)
      setStatus('Đã mở website trong trình duyệt mặc định · trợ lý vẫn dùng được')
    } catch {
      setStatus('Không mở được trình duyệt mặc định.')
    }
  }

  const showDashboard = React.useCallback(async () => {
    try {
      await window.lingua.showDashboard()
      window.dispatchEvent(new Event('linguahub:dashboard'))
      setActiveService(null)
      setFallbackService(null)
      setSection('Tổng quan')
      setStatus('Chọn WhatsApp hoặc Microsoft Teams')
    } catch {
      setStatus('Không mở được tổng quan.')
    }
  }, [])

  React.useEffect(() => window.lingua.onShortcut(action => {
    if (action === 'whatsapp' || action === 'teams') void open(action)
    else if (action === 'dashboard') void showDashboard()
    else if (action === 'reload') void reload()
  }), [open, reload, showDashboard])

  const navigation = ['Dịch trực tiếp', 'Trả lời AI', 'English Coach', 'Từ vựng', 'Luyện nói', 'Cài đặt']

  return <div className="app">
    <aside>
      <div className="brand">◈ LinguaHub <small>AI PRO</small></div>
      <p>KHÔNG GIAN LÀM VIỆC</p>
      <button onClick={() => void open('whatsapp')}>◉ WhatsApp</button>
      <button onClick={() => void open('teams')}>▦ Microsoft Teams</button>
      <p>HỖ TRỢ TIẾNG ANH</p>
      <button className="nav" aria-current={section === 'Tổng quan' ? 'page' : undefined} onClick={() => void showDashboard()}>⌂ Tổng quan</button>
      {navigation.map(item => <button className="nav" aria-current={section === item ? 'page' : undefined} key={item} onClick={() => setSection(item)}>{item}</button>)}
      <footer>Ctrl+0: Tổng quan · Ctrl+1: WhatsApp · Ctrl+2: Teams · Ctrl+R: tải lại.</footer>
    </aside>
    <main>
      <header>
        <b>{activeService === 'whatsapp' ? 'WhatsApp' : activeService === 'teams' ? 'Microsoft Teams' : 'Tổng quan'}</b>
        <span>{online ? status : 'Đang ngoại tuyến'}</span>
        {fallbackService ? <button style={{ width: 'auto' }} onClick={() => void openFallback()}>Mở {fallbackService === 'whatsapp' ? 'WhatsApp' : 'Teams'} ngoài app</button> : null}
        <button style={{ width: 'auto' }} disabled={!activeService} onClick={() => void reload()}>Tải lại</button>
      </header>
      {activeService ? null : <section className="dashboard-home">
        <div className="dashboard-eyebrow">LINGUAHUB AI PRO</div>
        <h1>Tiếng Anh tự tin hơn.<br />Công việc liền mạch hơn.</h1>
        <p>Mở một không gian để tiếp tục trò chuyện. Phiên đăng nhập được giữ riêng cho từng dịch vụ.</p>
        <div className="dashboard-cards">
          <article className="dashboard-card"><h2>◉ WhatsApp</h2><p>Mở WhatsApp Web đã đăng nhập trong app.</p><button onClick={() => void open('whatsapp')}>Mở WhatsApp</button></article>
          <article className="dashboard-card"><h2>▦ Microsoft Teams</h2><p>Mở Microsoft Teams trong phiên riêng của app.</p><button onClick={() => void open('teams')}>Mở Teams</button></article>
        </div>
        <p className="dashboard-help">Dịch trực tiếp, trả lời AI và công cụ học tiếng Anh nằm ở thanh bên.</p>
      </section>}
    </main>
    {panelCollapsed ? null : <div
      className="panel-resizer"
      role="separator"
      aria-label="Điều chỉnh chiều rộng trợ lý"
      aria-orientation="vertical"
      onPointerDown={event => { resizing.current = true; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { if (resizing.current) updatePanelWidth(event.clientX, false) }}
      onPointerUp={event => { if (resizing.current) { resizing.current = false; updatePanelWidth(event.clientX, true) } }}
    />}
    <div className={`panel${panelCollapsed ? ' panel-collapsed' : ''}`} style={{ width: panelCollapsed ? 52 : panelWidth }}>
      {panelCollapsed
        ? <button className="expand-panel" aria-label="Mở trợ lý" title="Mở trợ lý ngôn ngữ" onClick={() => setPanelCollapsed(false)}>‹</button>
        : <><button className="collapse-panel" onClick={() => setPanelCollapsed(true)}>Thu gọn trợ lý</button><AiPanel section={section} /></>}
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
