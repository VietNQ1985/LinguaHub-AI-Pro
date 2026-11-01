import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('lingua', {
  onShortcut: (callback:(action:string)=>void) => {
    const listener=(_event:Electron.IpcRendererEvent,action:string)=>callback(action)
    ipcRenderer.on('app:shortcut',listener)
    return ()=>ipcRenderer.removeListener('app:shortcut',listener)
  },
  reloadWorkspace: () => ipcRenderer.invoke('workspace:reload'),
  setWorkspacePanelLayout: (panelWidth:number,collapsed:boolean,persist=false) => ipcRenderer.send('workspace:panel-layout',{panelWidth,collapsed,persist}),
  setMasking: (enabled:boolean) => ipcRenderer.invoke('privacy:masking',enabled),
  getDataRetentionDays: () => ipcRenderer.invoke('privacy:retention:get'),
  setDataRetentionDays: (days:number) => ipcRenderer.invoke('privacy:retention:set',days),
  clearLocalData: () => ipcRenderer.invoke('privacy:clear-local-data'),
  connectChatGPT: () => ipcRenderer.invoke('chatgpt:connect'),
  connectChatGPTNewWorkspace: () => ipcRenderer.invoke('chatgpt:connect-new-workspace'),
  allowCloud: () => ipcRenderer.invoke('chatgpt:cloud-consent'),
  allowBackgroundCloud: () => ipcRenderer.invoke('chatgpt:background-cloud-consent'),
  disconnectChatGPT: () => ipcRenderer.invoke('chatgpt:disconnect'),
  openChatGPTUsageSettings: () => ipcRenderer.invoke('chatgpt:usage-settings'),
  chatgptModels: () => ipcRenderer.invoke('chatgpt:models'),
  chatgptStatus: () => ipcRenderer.invoke('chatgpt:status'),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  setPreferences: (input: {theme: string; model: string}) => ipcRenderer.invoke('preferences:set', input),
  getReasoningEffort: () => ipcRenderer.invoke('preferences:reasoning-effort:get'),
  setReasoningEffort: (value: string) => ipcRenderer.invoke('preferences:reasoning-effort:set', value),
  getTranslationReasoningEffort: () => ipcRenderer.invoke('preferences:translation-reasoning-effort:get'),
  setTranslationReasoningEffort: (value: string) => ipcRenderer.invoke('preferences:translation-reasoning-effort:set', value),
  getFastMode: () => ipcRenderer.invoke('preferences:fast-mode:get'),
  setFastMode: (enabled: boolean) => ipcRenderer.invoke('preferences:fast-mode:set', enabled),
  clearVocabulary: () => ipcRenderer.invoke('vocabulary:clear'),
  listVocabulary: () => ipcRenderer.invoke('vocabulary:list'),
  addVocabulary: (input: {term: string; meaning: string}) => ipcRenderer.invoke('vocabulary:add', input),
  reviewVocabulary: (id: string, remembered: boolean) => ipcRenderer.invoke('vocabulary:review', id, remembered),
  getLearningProgress: () => ipcRenderer.invoke('learning:progress'),
  completeDailyLesson: () => ipcRenderer.invoke('learning:complete-daily-lesson'),
  authorizeVisibleChatRead: () => ipcRenderer.invoke('chat:authorize-visible-read'),
  hasVisibleChatReadAuthorization: () => ipcRenderer.invoke('chat:visible-read-status'),
  stopVisibleChatRead: () => ipcRenderer.invoke('chat:stop-visible-read'),
  readVisibleChat: () => ipcRenderer.invoke('chat:read-visible'),
  onVisibleChatChanged: (callback: (change: {service:'whatsapp'|'teams';observedAt:number}) => void) => {
    const listener=(_event:Electron.IpcRendererEvent,change:{service:'whatsapp'|'teams';observedAt:number})=>callback(change)
    ipcRenderer.on('chat:visible-changed',listener)
    return ()=>ipcRenderer.removeListener('chat:visible-changed',listener)
  },
  listModels: () => ipcRenderer.invoke('ai:models'),
  runAi: (task: string, text: string, model: string, requestId?: string) => ipcRenderer.invoke('ai:run', task, text, model, requestId),
  cancelAi: (requestId: string) => ipcRenderer.invoke('ai:cancel', requestId),
  testNotification: () => ipcRenderer.invoke('notifications:test'),
  getNotificationPreferences: () => ipcRenderer.invoke('notifications:get'),
  setNotificationPreference: (service: 'whatsapp' | 'teams', enabled: boolean) => ipcRenderer.invoke('notifications:set', service, enabled),
  openWorkspace: (service: 'whatsapp' | 'teams') => ipcRenderer.invoke('workspace:open', service),
  showDashboard: () => ipcRenderer.invoke('workspace:dashboard'),
  openExternal: (service: 'whatsapp' | 'teams') => ipcRenderer.invoke('workspace:external', service),
})
