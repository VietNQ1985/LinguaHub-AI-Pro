import { WorkTasks, type TaskSourceSnapshot } from './WorkTasks'
import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import './bridge'
import { DialogHost } from './DialogHost'
import { AiPanel } from './AiPanel'
import type {UnreadCounts} from '../../shared/workspace-unread'
import {WorkspaceUnreadBadge} from './WorkspaceUnreadBadge'
import { APP_ITEMS, AppsPanel, type AppId, type AppsSettings } from './AppsPanel'
import { AppLogo } from './AppLogo'

type WorkspaceService = 'whatsapp' | 'telegram' | 'teams' | 'outlook' | 'zalo' | 'zoom' | 'meet'
type UiService=WorkspaceService

declare global {
  interface Window {
    lingua: {
      setTasksWorkspace(open: boolean): Promise<void>
      listTasks(): Promise<import('./WorkTasks').WorkTask[]>
      saveTask(input: import('./WorkTasks').WorkTask): Promise<import('./WorkTasks').WorkTask>
      deleteTask(id: string): Promise<void>
      getWorkspaceUnread():Promise<UnreadCounts>
      onWorkspaceUnread(callback:(counts:UnreadCounts)=>void):()=>void
      hideToTray():Promise<boolean>
      onShortcut(callback: (action: string) => void): () => void
      reloadWorkspace(): Promise<{ title: string }>
      setWorkspacePanelLayout(width: number, collapsed: boolean, persist?: boolean): void
      openWorkspace(service: WorkspaceService): Promise<{ title: string }>
      showDashboard(): Promise<boolean>
      openExternal(service: WorkspaceService): Promise<void>
      getApps(): Promise<AppsSettings>
      setApps(enabled: AppId[], startup: AppId | 'last'): Promise<AppsSettings>
      testNotification(): Promise<boolean>
      getNotificationPreferences(): Promise<{ whatsapp: boolean; teams: boolean; zalo:boolean }>
      setNotificationPreference(service: WorkspaceService, enabled: boolean): Promise<{ whatsapp: boolean; teams: boolean; zalo:boolean }>
      authorizeVisibleChatRead(): Promise<boolean>
      hasVisibleChatReadAuthorization(): Promise<boolean>
      stopVisibleChatRead(): Promise<void>
      sendChatMessage(text: string, conversationId: string): Promise<{ sent: boolean; cancelled: boolean; recipient: string }>
      sendConfirm(value?: boolean): Promise<boolean>
      callZaloViaPc(kind: 'voice' | 'video'): Promise<{ called: boolean; name: string }>
      getPermissions(): Promise<{ chat: boolean; mic: boolean; captions: boolean; teams: boolean; zoom: boolean; meet: boolean; zalo: boolean; reviewed: boolean }>
      setPermissions(grants: { chat: boolean; mic: boolean; captions: boolean; teams: boolean; zoom: boolean; meet: boolean; zalo: boolean }): Promise<boolean>
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
      getPreferences(): Promise<{ theme: string; model: string; replyModel?: string; panelWidth: number }>
      setPreferences(input: { theme: string; model: string; replyModel?: string }): Promise<void>
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
      providerStatus(): Promise<{ geminiKeySet: boolean; remoteUrl: string; remoteTokenSet: boolean; geminiConsent: boolean; remoteConsent: boolean }>
      setProviderSecrets(input: { geminiKey?: string; remoteUrl?: string; remoteToken?: string }): Promise<{ ok: boolean }>
      setProviderConsent(provider: 'gemini' | 'remote', enabled: boolean): Promise<boolean>
      providerModels(provider: 'gemini' | 'remote'): Promise<string[]>
      startCaptions(model: string, translate: boolean): Promise<string | null>
      prepareWhisper(size: 'base' | 'small', gpu: boolean): Promise<boolean>
      armAudio(token: string): Promise<boolean>
      whisperCached(size: 'base' | 'small', gpu: boolean): Promise<boolean>
      stopCaptions(token: string): Promise<void>
      translateCaptions(token: string, text: string, id: string): Promise<{ translation: string }>
      setAlwaysOnTop(enabled: boolean): Promise<boolean>
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
  const [unread,setUnread]=React.useState<UnreadCounts>({whatsapp:0,teams:0,zalo:0})
  React.useEffect(()=>{
    let alive=true,updated=false
    const stop=window.lingua.onWorkspaceUnread(counts=>{updated=true;if(alive)setUnread(counts)})
    void window.lingua.getWorkspaceUnread().then(counts=>{if(alive&&!updated)setUnread(counts)}).catch(()=>{})
    return()=>{alive=false;stop()}
  },[])
  const badge=(service:'whatsapp'|'teams'|'zalo')=><WorkspaceUnreadBadge value={unread[service]}/>
  const [tasksOpen,setTasksOpen]=React.useState(false)
  const [taskSource,setTaskSource]=React.useState<TaskSourceSnapshot|null>(null)
  const [taskModel,setTaskModel]=React.useState('')
  const [activeService, setActiveService] = React.useState<UiService>('whatsapp')
  const operation=React.useRef(0)
  const [fallbackService, setFallbackService] = React.useState<WorkspaceService | null>(null)
  const [panelWidth, setPanelWidth] = React.useState(400)
  const [panelCollapsed, setPanelCollapsed] = React.useState(false)
  const [status, setStatus] = React.useState('Đang mở…')
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
    setTasksOpen(false)
    setActiveService(service)
    setFallbackService(null)
    window.dispatchEvent(new Event('linguahub:workspace'))

    setStatus(service === 'telegram' ? 'Đang mở Telegram…' : service === 'outlook' ? 'Đang mở Outlook…' : service === 'whatsapp' ? 'Đang mở WhatsApp…' : service==='zalo'?'Đang mở Zalo Web…':service==='zoom'?'Đang mở Zoom…':service==='meet'?'Đang mở Google Meet…':'Đang mở Teams…')
    try {
      await window.lingua.openWorkspace(service)
      if(current!==operation.current)return
      window.dispatchEvent(new CustomEvent('linguahub:service',{detail:service}))
      setStatus('Đã mở trang trò chuyện')
    } catch {
      if(current!==operation.current)return
      setFallbackService(service)
      setStatus('Không mở được trang trong ứng dụng.')
    }
  }, [])

  // Tabs come from Settings → Ứng dụng; the startup tab is the chosen app or the one used last time.
  // First run: nothing is loaded until the user picks apps (AppsPanel firstRun in the workspace area).
  const [apps, setApps] = React.useState<AppId[] | null>(null)
  const [needsSetup, setNeedsSetup] = React.useState(false)
  const openApp = React.useCallback((app: AppId) => open(app), [open])
  const openStartup = React.useCallback((settings: AppsSettings) => {
    const wanted = settings.startup === 'last' ? settings.last : settings.startup
    void openApp(settings.enabled.includes(wanted) ? wanted : settings.enabled[0])
  }, [openApp])
  React.useEffect(() => {
    let alive = true
    void window.lingua.getApps().then(settings => {
      if (!alive) return
      if (!settings.reviewed) { setNeedsSetup(true); setApps([]); setStatus('Chọn ứng dụng để bắt đầu'); void window.lingua.showDashboard().catch(() => {}); return }
      setApps(settings.enabled)
      openStartup(settings)
    }).catch(() => { if (alive) { setApps(APP_ITEMS.map(item => item.id)); void open('whatsapp') } })
    return () => { alive = false }
  }, [open, openStartup])
  const activeRef = React.useRef(activeService)
  const needsSetupRef = React.useRef(needsSetup)
  needsSetupRef.current = needsSetup
  activeRef.current = activeService
  React.useEffect(() => {
    const changed = (event: Event) => {
      const settings = (event as CustomEvent<AppsSettings>).detail
      setApps(settings.enabled)
      if (needsSetupRef.current) { needsSetupRef.current = false; setNeedsSetup(false); openStartup(settings); return }
      if (!settings.enabled.includes(activeRef.current)) void openApp(settings.enabled[0])
    }
    window.addEventListener('linguahub:apps', changed)
    return () => window.removeEventListener('linguahub:apps', changed)
  }, [openApp, openStartup])
  const shown = (app: AppId) => !apps || apps.includes(app)

  const reload = React.useCallback(async () => {
    if(needsSetup)return
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
  }, [activeService, needsSetup])

  React.useEffect(() => window.lingua.onShortcut(action => {
    if ((action === 'whatsapp' || action === 'teams' || action==='zalo' || action==='zoom' || action==='meet') && (!apps || apps.includes(action))) void open(action)
    else if (action === 'dashboard' && apps?.length) void openApp(apps[0])
    else if (action === 'reload') void reload()
  }), [open, openApp, reload, apps])

  React.useEffect(() => {
    const handleOpenApp = (event: Event) => {
      const target = (event as CustomEvent<AppId>).detail
      if (target) void openApp(target)
    }
    window.addEventListener('linguahub:open-app', handleOpenApp)
    return () => window.removeEventListener('linguahub:open-app', handleOpenApp)
  }, [openApp])

  const openTasks=React.useCallback(async()=>{
    const version=++operation.current
    try {
      const preferences=await window.lingua.getPreferences()
      let snapshot: TaskSourceSnapshot|null=null
      if(await window.lingua.hasVisibleChatReadAuthorization()){
        try { const value=await window.lingua.readVisibleChat(); if(value?.text.trim())snapshot={...value,service:activeRef.current,capturedAt:Date.now()} } catch { /* Tasks remain available even when a page is unavailable. */ }
      }
      if(version!==operation.current)return
      await window.lingua.setTasksWorkspace(true)
      if(version!==operation.current)return
      setTaskSource(snapshot);setTaskModel(preferences.replyModel||preferences.model);setTasksOpen(true);setStatus('Công việc của tôi')
    }catch{setStatus('Chưa mở được công việc. Anh thử lại.')}
  },[])
  React.useEffect(()=>{
    const handler=()=>void openTasks()
    window.addEventListener('linguahub:open-tasks',handler)
    const stop=window.lingua.onShortcut(action=>{if(action==='tasks')handler()})
    return()=>{window.removeEventListener('linguahub:open-tasks',handler);stop()}
  },[openTasks])

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
        {APP_ITEMS.filter(item => shown(item.id)).map(item => <button key={item.id} type="button" className={!tasksOpen && activeService === item.id ? 'workspace-tab active' : 'workspace-tab'} aria-current={!tasksOpen && activeService === item.id ? 'page' : undefined} onClick={() => void openApp(item.id)}><AppLogo app={item.id} size={22} />{item.label}{item.id === 'whatsapp' || item.id === 'teams' || item.id === 'zalo' ? badge(item.id) : null}</button>)}
        <button type="button" className={tasksOpen?'workspace-tab active':'workspace-tab'} aria-current={tasksOpen?'page':undefined} onClick={()=>void openTasks()}>☑ Công việc</button>
      </nav>
      <div className="topbar-actions">
        <button type="button" className="icon-button" title="Thu gọn xuống khay hệ thống" aria-label="Thu gọn xuống khay hệ thống" onClick={()=>void window.lingua.hideToTray().catch(()=>setStatus('Chưa thu gọn được xuống khay hệ thống.'))}>▁</button>
        <span className={online ? 'connection-status' : 'connection-status offline'} title={status}>{online ? status : 'Máy đang ngoại tuyến'}</span>
        <button type="button" className="icon-button" title="Tải lại trang trò chuyện" aria-label="Tải lại trang" onClick={() => void reload()}>↻</button>
        <button type="button" className="icon-button" title="Cài đặt" aria-label="Cài đặt" onClick={() => { if (panelCollapsed) setPanelCollapsed(false); window.dispatchEvent(new Event('linguahub:settings')) }}>⚙</button>
        <button type="button" className="icon-button" title={panelCollapsed ? 'Mở bản dịch' : 'Thu gọn bản dịch'} aria-label={panelCollapsed ? 'Mở bản dịch' : 'Thu gọn bản dịch'} onClick={() => setPanelCollapsed(value => !value)}>{panelCollapsed ? '▤' : '◧'}</button>
      </div>
    </header>
    <div className="workspace-row">
      <main className={tasksOpen?"workspace tasks-workspace":"workspace"} aria-label={tasksOpen?"Công việc":"Trang trò chuyện"}>
        {tasksOpen&&<WorkTasks service={activeService} model={taskModel} sourceSnapshot={taskSource} onBack={()=>void openApp(activeService)}/>}
        {!tasksOpen&&<>
        {needsSetup ? <AppsPanel firstRun /> : fallbackService ? <div className="workspace-fallback"><h2>Chưa mở được trang trò chuyện</h2><p>Trang này có thể không hỗ trợ chạy bên trong ứng dụng. Anh có thể mở bằng trình duyệt.</p><button onClick={() => void openFallback()}>Mở bằng trình duyệt</button></div> : <div className="workspace-placeholder">Đang mở trang trò chuyện…</div>}
        </>}
      </main>
      {!tasksOpen && !panelCollapsed && <div className="panel-resizer" role="separator" aria-label="Kéo để điều chỉnh độ rộng bản dịch" aria-orientation="vertical" onPointerDown={event => { resizing.current = true; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (resizing.current) updatePanelWidth(event.clientX, false) }} onPointerUp={event => { if (resizing.current) { resizing.current = false; updatePanelWidth(event.clientX, true) } }} onLostPointerCapture={() => { resizing.current = false }} />}
      <aside hidden={tasksOpen} className={panelCollapsed ? 'panel panel-collapsed' : 'panel'} style={{width: panelCollapsed ? 56 : panelWidth}} aria-label="Trợ lý dịch tiếng Việt">
        {panelCollapsed && <button className="expand-panel" title="Mở bản dịch" aria-label="Mở bản dịch" onClick={() => setPanelCollapsed(false)}>›</button>}
        <div className={panelCollapsed ? 'panel-body panel-body-hidden' : 'panel-body'} aria-hidden={panelCollapsed}>
          <AiPanel workspaceActive={!tasksOpen} />
        </div>
      </aside>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<><App /><DialogHost /></>)
