import { contextBridge, ipcRenderer } from 'electron'
const shortcutListeners=new Set<(action:string)=>void>()
const queuedShortcuts:string[]=[]
ipcRenderer.on('app:shortcut',(_event,action:string)=>{
  if(shortcutListeners.size){for(const listener of shortcutListeners)listener(action);return}
  queuedShortcuts.push(action)
  if(queuedShortcuts.length>10)queuedShortcuts.shift()
})
contextBridge.exposeInMainWorld('lingua', {
  openWindowsVoiceTyping:()=>ipcRenderer.invoke('voice:windows'),
  listTasks:()=>ipcRenderer.invoke('tasks:list'),
  saveTask:(input:unknown)=>ipcRenderer.invoke('tasks:save',input),
  extractTasksFromVisible:(service:'whatsapp'|'teams'|'zalo'|'outlook',model:string,requestId:string)=>ipcRenderer.invoke('tasks:extract-visible',service,model,requestId),
  hideToTray:()=>ipcRenderer.invoke('window:tray'),
  getWorkspaceUnread:()=>ipcRenderer.invoke('workspace:unread'),
  onWorkspaceUnread:(callback:(counts:import('../shared/workspace-unread').UnreadCounts)=>void)=>{
    const listener=(_event:Electron.IpcRendererEvent,counts:import('../shared/workspace-unread').UnreadCounts)=>callback(counts)
    ipcRenderer.on('workspace:unread-changed',listener)
    return ()=>ipcRenderer.removeListener('workspace:unread-changed',listener)
  },
  onShortcut: (callback:(action:string)=>void) => {
    shortcutListeners.add(callback)
    for(const action of queuedShortcuts.splice(0))callback(action)
    return ()=>shortcutListeners.delete(callback)
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
  providerStatus: () => ipcRenderer.invoke('providers:status'),
  setProviderSecrets: (input: { geminiKey?: string; remoteUrl?: string; remoteToken?: string }) => ipcRenderer.invoke('providers:set', input),
  setProviderConsent: (provider: 'gemini' | 'remote', enabled: boolean) => ipcRenderer.invoke('providers:consent', provider, enabled),
  providerModels: (provider: 'gemini' | 'remote') => ipcRenderer.invoke('providers:models', provider),
  setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('window:always-on-top', enabled),
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
  sendChatMessage: (text: string, conversationId: string) => ipcRenderer.invoke('chat:send-direct', text, conversationId),
  sendConfirm: (value?: boolean) => ipcRenderer.invoke('chat:send-confirm', value),
  getPermissions: () => ipcRenderer.invoke('permissions:get'),
  openZaloPc: () => ipcRenderer.invoke('zalopc:open'),
  zaloPcStatus: () => ipcRenderer.invoke('zalopc:status'),
  connectZaloPc: () => ipcRenderer.invoke('zalopc:connect'),
  callZaloPc: (kind: 'voice' | 'video') => ipcRenderer.invoke('zalopc:call', kind),
  embedZaloPc: (enabled: boolean) => ipcRenderer.invoke('zalopc:embed', enabled),
  callZaloViaPc: (kind: 'voice' | 'video') => ipcRenderer.invoke('zalo:call-via-pc', kind),
  setPermissions: (grants: Record<string, boolean>) => ipcRenderer.invoke('permissions:set', grants),
  onVisibleChatChanged: (callback: (change: {service:'whatsapp'|'teams';observedAt:number}) => void) => {
    const listener=(_event:Electron.IpcRendererEvent,change:{service:'whatsapp'|'teams';observedAt:number})=>callback(change)
    ipcRenderer.on('chat:visible-changed',listener)
    return ()=>ipcRenderer.removeListener('chat:visible-changed',listener)
  },
  startMeeting: (model:string)=>ipcRenderer.invoke('meeting:start',model),
  readMeeting: (token:string)=>ipcRenderer.invoke('meeting:read',token),
  stopMeeting: (token:string)=>ipcRenderer.invoke('meeting:stop',token),
  translateMeeting: (token:string,text:string,id:string)=>ipcRenderer.invoke('meeting:translate',token,text,id),
  writeClipboardText: (text:string) => ipcRenderer.invoke('clipboard:write-text',text),
  runAi: (task: string, text: string, model: string, requestId?: string, options?: {replyFast:boolean}) => ipcRenderer.invoke('ai:run', task, text, model, requestId, options),
  onAiStream: (requestId:string,callback:(delta:string)=>void) => {
    const listener=(_event:Electron.IpcRendererEvent,message:{requestId:string;delta:string})=>{if(message.requestId===requestId&&typeof message.delta==='string')callback(message.delta)}
    ipcRenderer.on('ai:stream',listener)
    return ()=>ipcRenderer.removeListener('ai:stream',listener)
  },
  cancelAi: (requestId: string) => ipcRenderer.invoke('ai:cancel', requestId),
  testNotification: () => ipcRenderer.invoke('notifications:test'),
  getNotificationPreferences: () => ipcRenderer.invoke('notifications:get'),
  setNotificationPreference: (service: 'whatsapp' | 'teams' | 'zalo', enabled: boolean) => ipcRenderer.invoke('notifications:set', service, enabled),
  openWorkspace: (service: 'whatsapp' | 'teams' | 'zalo' | 'outlook') => ipcRenderer.invoke('workspace:open', service),
  showDashboard: () => ipcRenderer.invoke('workspace:dashboard'),
  openExternal: (service: 'whatsapp' | 'teams' | 'zalo' | 'outlook') => ipcRenderer.invoke('workspace:external', service),
})
