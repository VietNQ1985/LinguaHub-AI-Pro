import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
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
      authorizeVisibleChatRead(): Promise<boolean>
      hasVisibleChatReadAuthorization(): Promise<boolean>
      stopVisibleChatRead(): Promise<void>
      readVisibleChat(): Promise<{ conversationId: string; text: string; messages: Array<{ text: string; side: 'left' | 'right' | 'center' }> } | null>
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
      getFastMode(): Promise<boolean>
      setFastMode(enabled: boolean): Promise<boolean>
      clearVocabulary(): Promise<boolean>
      disconnectChatGPT(): Promise<{ revoked: boolean }>
      openChatGPTUsageSettings(): Promise<void>
      setMasking(enabled: boolean): Promise<void>
      allowCloud(): Promise<boolean>
      allowBackgroundCloud(): Promise<boolean>
      chatgptModels(): Promise<{ slug: string; name: string }[]>
      connectChatGPT(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean }>
      connectChatGPTNewWorkspace(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean } | null>
      chatgptStatus(): Promise<{ connected: boolean; email: string | null; usageEnabled: boolean }>
      listModels(): Promise<string[]>
      runAi(task: string, text: string, model: string, requestId?: string): Promise<unknown>
      cancelAi(requestId: string): Promise<boolean>
    }
  }
}

function App() {
  const [activeService, setActiveService] = React.useState<WorkspaceService>('whatsapp')
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
    setActiveService(service)
    setFallbackService(null)
    window.dispatchEvent(new Event('linguahub:workspace'))
    setStatus(service === 'whatsapp' ? 'Đang mở WhatsApp…' : 'Đang mở Teams…')
    try {
      await window.lingua.openWorkspace(service)
      setStatus('Đã mở trang trò chuyện')
    } catch {
      setFallbackService(service)
      setStatus('Không mở được trang trong ứng dụng.')
    }
  }, [])

  React.useEffect(() => {
    void open('whatsapp')
  }, [open])

  const reload = React.useCallback(async () => {
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

  return <div className="app" lang="vi">
    <header className="topbar">
      <div className="topbar-brand"><span className="brand-mark">VI</span><span>LinguaHub <small>AI</small></span></div>
      <nav className="workspace-tabs" aria-label="Chọn ứng dụng trò chuyện">
        <button type="button" className={activeService === 'whatsapp' ? 'workspace-tab active' : 'workspace-tab'} aria-current={activeService === 'whatsapp' ? 'page' : undefined} onClick={() => void open('whatsapp')}>WhatsApp</button>
        <button type="button" className={activeService === 'teams' ? 'workspace-tab active' : 'workspace-tab'} aria-current={activeService === 'teams' ? 'page' : undefined} onClick={() => void open('teams')}>Microsoft Teams</button>
      </nav>
      <div className="topbar-actions">
        <span className={online ? 'connection-status' : 'connection-status offline'} title={status}>{online ? status : 'Máy đang ngoại tuyến'}</span>
        <button type="button" className="icon-button" title="Tải lại trang trò chuyện" aria-label="Tải lại trang" onClick={() => void reload()}>↻</button>
        <button type="button" className="icon-button" title="Cài đặt" aria-label="Cài đặt" onClick={() => { if (panelCollapsed) setPanelCollapsed(false); window.dispatchEvent(new Event('linguahub:settings')) }}>⚙</button>
        <button type="button" className="icon-button" title={panelCollapsed ? 'Mở bản dịch' : 'Thu gọn bản dịch'} aria-label={panelCollapsed ? 'Mở bản dịch' : 'Thu gọn bản dịch'} onClick={() => setPanelCollapsed(value => !value)}>{panelCollapsed ? '▤' : '◧'}</button>
      </div>
    </header>
    <div className="workspace-row">
      <main className="workspace" aria-label="Trang trò chuyện">
        {fallbackService ? <div className="workspace-fallback"><h2>Chưa mở được trang trò chuyện</h2><p>Trang này có thể không hỗ trợ chạy bên trong ứng dụng. Anh có thể mở bằng trình duyệt.</p><button onClick={() => void openFallback()}>Mở bằng trình duyệt</button></div> : <div className="workspace-placeholder">Đang mở trang trò chuyện…</div>}
      </main>
      {!panelCollapsed && <div className="panel-resizer" role="separator" aria-label="Kéo để điều chỉnh độ rộng bản dịch" aria-orientation="vertical" onPointerDown={event => { resizing.current = true; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (resizing.current) updatePanelWidth(event.clientX, false) }} onPointerUp={event => { if (resizing.current) { resizing.current = false; updatePanelWidth(event.clientX, true) } }} onLostPointerCapture={() => { resizing.current = false }} />}
      <aside className={panelCollapsed ? 'panel panel-collapsed' : 'panel'} style={{width: panelCollapsed ? 56 : panelWidth}} aria-label="Trợ lý dịch tiếng Việt">
        {panelCollapsed && <button className="expand-panel" title="Mở bản dịch" aria-label="Mở bản dịch" onClick={() => setPanelCollapsed(false)}>›</button>}
        <div className={panelCollapsed ? 'panel-body panel-body-hidden' : 'panel-body'} aria-hidden={panelCollapsed}>
          <AiPanel />
        </div>
      </aside>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
