import { createTaskStore, type TaskCaptureResult, type TaskCaptureSuggestion, type TaskSourceService } from './tasks'
import { openWindowsVoiceTyping } from './windows-voice'
import { meetingCaptionScript } from './meeting-captions'
import { trustedMeetingOrigin, installMeetingPermissions, type MeetingService } from './teams-meeting-permissions'
import { app, BrowserWindow, WebContentsView, ipcMain, shell, Notification, dialog, clipboard, Tray, Menu, nativeImage, screen } from 'electron'
import { randomUUID, createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { reasoningEffortForTask, runLocalAi, type AiTask } from './ai'
import { buildVisibleChatReadScript, type ChatDomSnapshot, type ChatService } from './chat-dom-reader'
import { buildComposerScript, recipientLabel, type ComposerState } from './chat-sender'
import { WindowEmbedder, type Rect } from './win-embed'
import { buildCallScript, buildFocusSearchScript, buildOpenSearchResultScript, buildOpenTitleScript, closeZaloPc, findZaloPcExe, launchZaloPc, sameChatName, zaloPcBringToFront, zaloPcConnected, zaloPcEvaluate, zaloPcPressEnter, zaloPcRunning, zaloPcType } from './zalo-pc'
import { createLearningStore } from './database/store'
import { ChatGPTConnection } from './auth/connection'
import { maskSensitive } from '../shared/mask-sensitive'
import { isZaloStorageRequest, isSafeExternalWebUrl, isWorkspaceUrl } from '../shared/navigation'
import { diagnostic } from './diagnostics'
import { zaloDiagnosticHost, zaloNetworkDiagnostic, zaloBlockedNavigationDiagnostic } from './zalo-diagnostic'
import {unreadFromTitle} from '../shared/workspace-unread'
import type {UnreadCounts,UnreadValue} from '../shared/workspace-unread'
import {restoreWindow,saveWindow} from './window-state'
import type { WorkspaceService } from './notification-policy'
import { genericWorkspaceNotificationOptions, routeWorkspaceNotificationClick, unreadChangeNeedsNotification, workspaceFromNotificationActivation } from './workspace-notifications'
import { hasCloudConsentForTask } from './cloud-consent'
import { APP_USER_MODEL_ID, startMenuShortcutPath, toastShortcutDetails } from './windows-notifications'
import { FAST_REASONING_EFFORT, isGpt6Model } from '../shared/model-reasoning'
import { createProviderSecrets, geminiListModels, geminiRespond, remoteListModels, remoteRespond, validRemoteUrl } from './remote-providers'
import { z } from 'zod'
let window: BrowserWindow
let view: WebContentsView | undefined
let currentWorkspaceService: ChatService | 'zalopc' = 'whatsapp'
let chatReadAuthorized = false
let workspacePanelWidth=360
let workspacePanelCollapsed=false
const views = new Map<string, WebContentsView>()
app.setAppUserModelId(APP_USER_MODEL_ID)
let quitting=false
let tray:Tray|undefined
let notificationWorkspaceActivator:((service:WorkspaceService)=>void)|undefined
let pendingNotificationWorkspace:WorkspaceService|undefined
let releaseEmbeddedWindows:(()=>Promise<void>)|undefined
let embedReleased=false
app.on('before-quit',event=>{
  quitting=true
  // Give Zalo PC (and any call window) back as normal windows before LinguaHub's window goes away.
  if(!embedReleased&&releaseEmbeddedWindows){event.preventDefault();embedReleased=true;void releaseEmbeddedWindows().finally(()=>app.quit())}
})
const sites = { whatsapp: 'https://web.whatsapp.com', teams: 'https://teams.microsoft.com', zalo: 'https://chat.zalo.me/', outlook: 'https://outlook.office.com/mail/' }
// Services whose visible captions can be read for live translation.
// Only these services have unread badges, website notifications and title counts.
type UnreadService = 'whatsapp' | 'teams' | 'zalo' | 'outlook'
const isUnreadService = (service: unknown): service is UnreadService => service === 'whatsapp' || service === 'teams' || service === 'zalo' || service === 'outlook'
const meetingServiceOf = (service: unknown): MeetingService | null => service === 'teams' ? service : null
if(process.env.LINGUAHUB_STARTUP_SMOKE==='1'&&process.env.LINGUAHUB_SMOKE_USER_DATA){
  mkdirSync(process.env.LINGUAHUB_SMOKE_USER_DATA,{recursive:true})
  app.setPath('userData',process.env.LINGUAHUB_SMOKE_USER_DATA)
}
const ownsInstance=app.requestSingleInstanceLock()
if(!ownsInstance)app.quit()
app.on('second-instance',(_event,commandLine)=>{
  const service=commandLine.map(argument=>workspaceFromNotificationActivation('click',argument)).find((value):value is WorkspaceService=>value!==null)
  if(service){if(notificationWorkspaceActivator)notificationWorkspaceActivator(service);else pendingNotificationWorkspace=service;return}
  if(window && !window.isDestroyed()){window.restore();window.show();window.focus()}
})
app.on('web-contents-created',(_event,contents)=>{
  contents.on('before-input-event',(event,input)=>{
    if(!input.control || input.type!=='keyDown' || input.alt || input.meta)return
    const action=({'0':'dashboard','1':'whatsapp','2':'teams','r':'reload'} as Record<string,string>)[input.key.toLowerCase()]
    if(action && window && !window.isDestroyed()){event.preventDefault();window.webContents.send('app:shortcut',action)}
  })
})
function ensureWindowsToastShortcut(){
  if(process.platform!=='win32'||!app.isPackaged)return
  const userPrograms=join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs')
  const userShortcut=startMenuShortcutPath(userPrograms)
  const commonPrograms=process.env.ProgramData||process.env.PROGRAMDATA
    ?join(process.env.ProgramData||process.env.PROGRAMDATA||'','Microsoft','Windows','Start Menu','Programs')
    :undefined
  const commonShortcut=commonPrograms?startMenuShortcutPath(commonPrograms):undefined
  const details=toastShortcutDetails(process.execPath)
  for(const shortcut of [userShortcut,commonShortcut].filter((value):value is string=>Boolean(value))){
    if(!existsSync(shortcut))continue
    try{
      if(shell.writeShortcutLink(shortcut,'replace',details)){
        void diagnostic('notification-shortcut-ready')
        return
      }
    }catch{}
  }
  try{
    mkdirSync(userPrograms,{recursive:true})
    const created=shell.writeShortcutLink(userShortcut,'create',details)
    void diagnostic(created?'notification-shortcut-ready':'notification-shortcut-failed')
  }catch{void diagnostic('notification-shortcut-failed')}
}
app.whenReady().then(async () => {
  if(!ownsInstance)return
  if(process.platform==='win32')Notification.handleActivation(details=>{
    const service=workspaceFromNotificationActivation(details.type,details.arguments)
    if(!service)return
    if(notificationWorkspaceActivator)notificationWorkspaceActivator(service)
    else pendingNotificationWorkspace=service
  })
  ensureWindowsToastShortcut()
  let cloudConsent = false
  let backgroundCloudConsent = false
  let masking = true
  const chatgpt = new ChatGPTConnection(app.getPath('userData'))
  const providerSecrets = createProviderSecrets(app.getPath('userData'))
  void providerSecrets.load()
  const aiRequests = new Map<string, AbortController>()
  await chatgpt.initialize()
  const learning = await createLearningStore(app.getPath('userData'), app.isPackaged ? join(process.resourcesPath, 'sql-wasm.wasm') : join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm'))
  cloudConsent=learning.getManualCloudConsent()
  workspacePanelWidth=learning.getPreferences().panelWidth
  if(learning.getPreferences().model.startsWith('chatgpt:')&&chatgpt.status().usageEnabled)void chatgpt.listModels().catch(()=>{})
  const notificationPermissions = await learning.getNotificationPreferences()
  const notificationPrompts = new Map<WorkspaceService, Promise<boolean>>()
  const chatMutationDebounces = new Map<ChatService, {timer:ReturnType<typeof setTimeout>;contents:Electron.WebContents;observedAt:number}>()
  const clearChatMutationDebounces=()=>{for(const entry of chatMutationDebounces.values())clearTimeout(entry.timer);chatMutationDebounces.clear()}
  const controlChatObservers=(enabled:boolean,only?:ChatService)=>{
    for(const [service,child] of views.entries())if((!only||service===only)&&!child.webContents.isDestroyed())child.webContents.send('chat:observer-control',enabled)
  }
  const grantNotificationPermission = async (service: WorkspaceService) => {
    if (notificationPermissions[service]) return true
    const pending = notificationPrompts.get(service)
    if (pending) return pending
    const prompt = (async () => {
      const answer = await dialog.showMessageBox(window, {noLink:true,
        type: 'question',
        title: 'Cho phép thông báo Windows',
        message: `Cho phép ${service === 'whatsapp' ? 'WhatsApp' : service==='zalo'?'Zalo Web':service==='outlook'?'Outlook':'Microsoft Teams'} hiện thông báo chung trên Windows?`,
        detail: 'LinguaHub chỉ hiện “Có thông báo mới.”, không hiện tên người gửi hay nội dung. Thông báo chứa nội dung do trang web tạo sẽ bị chặn.',
        buttons: ['Hủy', 'Cho phép'], defaultId: 0, cancelId: 0,
      })
      if (answer.response !== 1) return false
      if (!Notification.isSupported()) throw new Error('Thông báo Windows không khả dụng')
      const updated = await learning.setNotificationPreference(service, true)
      notificationPermissions[service] = updated[service]
      return notificationPermissions[service]
    })()
    notificationPrompts.set(service, prompt)
    try { return await prompt } finally { notificationPrompts.delete(service) }
  }
  const windowState=restoreWindow()
  window = new BrowserWindow({ ...windowState, minWidth:1000,minHeight:600, webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } })
  if(windowState.maximized)window.maximize()
  let workspaceRequest=0
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Ứng dụng',submenu:[{label:'Thu gọn xuống khay hệ thống',click:()=>{if(tray)window.hide()}},{label:'Thoát hoàn toàn',click:()=>app.quit()}]},{label:'Chỉnh sửa',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'Hiển thị',submenu:[{role:'reload'},{role:'toggleDevTools'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]}]))
  window.on('close',event=>{saveWindow(window);if(!quitting&&tray){event.preventDefault();window.hide()}})
  const layoutWorkspaceViews=()=>{
    if(window.isDestroyed())return
    const [width,height]=window.getContentSize()
    const panelWidth=workspacePanelCollapsed?56:workspacePanelWidth
    const dividerWidth=workspacePanelCollapsed?0:6
    for(const child of views.values())child.setBounds({x:0,y:64,width:Math.max(300,width-panelWidth-dividerWidth),height:Math.max(100,height-64)})
    void syncZaloEmbed()
  }
  // ---- Zalo PC window embedded in the workspace area (Windows SetParent) ----
  const embedder=new WindowEmbedder(app.getPath('userData'))
  const ZALO_STRIP=40
  let zaloMainWindow:string|null=null
  // Off by default: as a child window Zalo PC shares LinguaHub's input queue and can stall.
  let zaloEmbedEnabled=false
  let zaloEmbedBusy=false
  const hostHandle=()=>{const handle=window.getNativeWindowHandle();return (handle.length>=8?handle.readBigUInt64LE(0):BigInt(handle.readUInt32LE(0))).toString()}
  const zaloRect=():Rect=>{
    const [width,height]=window.getContentSize()
    const panelWidth=workspacePanelCollapsed?56:workspacePanelWidth
    const dividerWidth=workspacePanelCollapsed?0:6
    const scale=screen.getDisplayMatching(window.getBounds()).scaleFactor
    const top=64+ZALO_STRIP
    return {x:0,y:Math.round(top*scale),w:Math.round(Math.max(300,width-panelWidth-dividerWidth)*scale),h:Math.round(Math.max(100,height-top)*scale)}
  }
  const zaloChrome=async(hidden:boolean)=>{
    // Zalo PC draws its own title bar (minimise/close); hide it while it lives inside LinguaHub.
    await zaloPcEvaluate(hidden
      ?`(()=>{let s=document.getElementById('lh-embed-style');if(!s){s=document.createElement('style');s.id='lh-embed-style';document.head.appendChild(s)}s.textContent='#titleBar{display:none!important}';return true})()`
      :`(()=>{document.getElementById('lh-embed-style')?.remove();return true})()`).catch(()=>undefined)
  }
  const syncZaloEmbed=async()=>{
    if(process.platform!=='win32'||zaloEmbedBusy||window.isDestroyed())return
    zaloEmbedBusy=true
    try{
      const show=currentWorkspaceService==='zalopc'&&zaloEmbedEnabled&&!window.isMinimized()
      if(show&&await zaloPcConnected()){
        if(!zaloMainWindow||!embedder.isEmbedded(zaloMainWindow)){
          const main=(await embedder.find('Zalo')).find(entry=>entry.className==='Chrome_WidgetWin_1'&&entry.titleLength>0)
          if(main&&await embedder.embed(main.hwnd,hostHandle(),zaloRect())){zaloMainWindow=main.hwnd;await zaloChrome(true)}
        }
        // A call opens ZaloCall's own window: bring it inside too, on top of the chat.
        for(const call of await embedder.find('ZaloCall'))if(!embedder.isEmbedded(call.hwnd))await embedder.embed(call.hwnd,hostHandle(),zaloRect())
      }
      const rect=zaloRect()
      for(const child of embedder.embeddedWindows())await embedder.move(child,rect,show)
    }catch{}finally{zaloEmbedBusy=false}
  }
  const releaseZalo=async()=>{await zaloChrome(false);await embedder.releaseAll();zaloMainWindow=null}
  releaseEmbeddedWindows=async()=>{await releaseZalo().catch(()=>undefined);embedder.stop()}
  setInterval(()=>{if(currentWorkspaceService==='zalopc'||embedder.embeddedWindows().length)void syncZaloEmbed()},1500)
  ipcMain.handle('zalopc:embed',async(event,enabled:unknown)=>{
    trusted(event)
    zaloEmbedEnabled=z.boolean().parse(enabled)
    if(!zaloEmbedEnabled)await releaseZalo()
    else await syncZaloEmbed()
    return zaloEmbedEnabled
  })
  ipcMain.on('workspace:panel-layout',(event,input:unknown)=>{
    if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!input||typeof input!=='object')return
    const value=input as {panelWidth?:unknown;collapsed?:unknown;persist?:unknown}
    if(typeof value.panelWidth!=='number'||!Number.isInteger(value.panelWidth)||value.panelWidth<280||value.panelWidth>560||typeof value.collapsed!=='boolean'||typeof value.persist!=='boolean')return
    const [width]=window.getContentSize()
    workspacePanelWidth=Math.min(value.panelWidth,Math.max(280,width-520))
    workspacePanelCollapsed=value.collapsed
    layoutWorkspaceViews()
    if(value.persist)void learning.setPanelWidth(workspacePanelWidth).catch(()=>{})
  })
  ipcMain.on('chat:visible-dom-change',(event,rawObservedAt:unknown)=>{
    const service=[...views.entries()].find(([,child])=>child.webContents===event.sender)?.[0] as ChatService|undefined
    if(!service||event.senderFrame!==event.sender.mainFrame||!chatReadAuthorized||!window.isVisible()||window.isMinimized()||!view||view.webContents!==event.sender||!view.getVisible()||!isWorkspaceUrl(service,event.sender.getURL()))return
    const observedAt=typeof rawObservedAt==='number'&&Number.isFinite(rawObservedAt)&&Math.abs(Date.now()-rawObservedAt)<60000?rawObservedAt:Date.now()
    const previous=chatMutationDebounces.get(service)
    if(previous)clearTimeout(previous.timer)
    const contents=event.sender
    const timer=setTimeout(()=>{
      chatMutationDebounces.delete(service)
      if(!chatReadAuthorized||view?.webContents!==contents||!view.getVisible()||!isWorkspaceUrl(service,contents.getURL()))return
      window.webContents.send('chat:visible-changed',{service,observedAt})
    },45)
    chatMutationDebounces.set(service,{timer,contents,observedAt})
  })
  // The shell has no audio capture/model; meeting devices belong to the trusted Teams/Zalo views.
  let microphoneAllowed=learning.getMeetingRemember('mic')
  window.webContents.session.setPermissionCheckHandler((contents,permission,_origin,details)=>contents===window.webContents&&permission==='media'&&microphoneAllowed&&details.mediaType==='audio')
  window.webContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
    if(contents!==window.webContents||permission!=='media'||!('mediaTypes' in details)||!details.mediaTypes?.length||details.mediaTypes.some(type=>type!=='audio')){callback(false);return}
    if(microphoneAllowed){callback(true);return}
    try{const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Microphone luyện nói',message:'Cho phép ghi âm bài luyện nói trên máy?',detail:'Chỉ ghi khi anh bấm ghi âm để nghe lại. Không dùng Whisper hoặc gửi âm thanh tới AI.',buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0});microphoneAllowed=answer.response===1;callback(microphoneAllowed)}catch{callback(false)}
  })
  const trusted = (event: Electron.IpcMainInvokeEvent) => { if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted sender') }
  ipcMain.handle('voice:windows',async event=>{
    trusted(event)
    if(!window.isFocused()||window.isMinimized()||!window.isVisible()||!window.webContents.isFocused())throw new Error('Đặt con trỏ vào ô nhập trước.')
    const focused=await window.webContents.executeJavaScript("['reply-input','reply-composer-input'].includes(document.activeElement?.id)")
    if(!focused||!window.isFocused()||!window.webContents.isFocused())throw new Error('Ô nhập chưa có con trỏ.')
    return openWindowsVoiceTyping()
  })
  const tasks=createTaskStore(app.getPath('userData'))
  ipcMain.handle('tasks:list',event=>{trusted(event);return tasks.list()})
  ipcMain.handle('tasks:save',(event,input:unknown)=>{trusted(event);return tasks.save(input)})
  const activateWorkspace=(service:keyof typeof sites)=>{
    if(window.isDestroyed())return
    if(currentWorkspaceService===service&&window.isVisible()&&!window.isMinimized()&&view?.webContents===views.get(service)?.webContents){window.focus();return}
    currentWorkspaceService=service
    for(const [key,child] of views){child.setVisible(key===service);child.webContents.send('chat:observer-control',key===service&&chatReadAuthorized)}
    view=views.get(service);stopMeeting();layoutWorkspaceViews()
    window.restore();window.show();window.focus()
    window.webContents.send('app:shortcut',service)
  }
  try{
    const icon=nativeImage.createFromPath(join(import.meta.dirname,'../renderer/linguahub.ico'))
    tray=new Tray(icon)
    tray.setToolTip('LinguaHub AI Pro')
    tray.setContextMenu(Menu.buildFromTemplate([{label:'Mở LinguaHub',click:()=>{window.restore();window.show();window.focus()}},{label:'WhatsApp',click:()=>activateWorkspace('whatsapp')},{label:'Microsoft Teams',click:()=>activateWorkspace('teams')},{label:'Zalo Web',click:()=>activateWorkspace('zalo')},{label:'Outlook',click:()=>activateWorkspace('outlook')},{type:'separator'},{label:'Thoát hoàn toàn',click:()=>app.quit()}]))
    tray.on('double-click',()=>{window.restore();window.show();window.focus()})
  }catch{tray=undefined}
  ipcMain.handle('window:tray',event=>{trusted(event);if(!tray)throw new Error('Chưa tạo được biểu tượng khay hệ thống.');window.hide();return true})
  const unreadCounts:UnreadCounts={whatsapp:0,teams:0,zalo:0,outlook:0}
  const domUnread=new Map<string,UnreadValue>()
  const notificationArmed=new Set<WorkspaceService>()
  const notificationWarmupTimers=new Map<WorkspaceService,ReturnType<typeof setTimeout>>()
  const scheduleNotificationWarmup=(service:WorkspaceService,contents:Electron.WebContents)=>{
    const previousTimer=notificationWarmupTimers.get(service)
    if(previousTimer)clearTimeout(previousTimer)
    notificationArmed.delete(service)
    const timer=setTimeout(()=>{
      notificationWarmupTimers.delete(service)
      if(contents.isDestroyed()||!isWorkspaceUrl(service,contents.getURL()))return
      const baseline=domUnread.get(service)??unreadFromTitle(contents.getTitle())
      const previous=unreadCounts[service]
      unreadCounts[service]=baseline
      notificationArmed.add(service)
      if(previous!==baseline){void diagnostic('workspace-unread',{host:service,code:`baseline:${baseline}`});if(!window.isDestroyed())window.webContents.send('workspace:unread-changed',{...unreadCounts})}
    },2000)
    notificationWarmupTimers.set(service,timer)
  }
  const updateUnreadCount=(service:WorkspaceService,next:UnreadValue,source:'dom'|'title')=>{
    const previous=unreadCounts[service]
    const armed=notificationArmed.has(service)
    if(previous!==next){
      unreadCounts[service]=next
      void diagnostic('workspace-unread',{host:service,code:`${source}:${next}`})
      if(!window.isDestroyed())window.webContents.send('workspace:unread-changed',{...unreadCounts})
      if(!armed){const contents=views.get(service)?.webContents;if(contents&&!contents.isDestroyed())scheduleNotificationWarmup(service,contents)}
    }
    if(notificationPermissions[service]&&Notification.isSupported()&&unreadChangeNeedsNotification(previous,next,armed)){
      const notification=new Notification(genericWorkspaceNotificationOptions(service))
      routeWorkspaceNotificationClick(notification,service,activateWorkspace)
      notification.show()
    }
  }
  ipcMain.on('workspace:unread-dom',(event,count:unknown)=>{
    const found=[...views.entries()].find(([,child])=>child.webContents===event.sender)?.[0]
    const service=isUnreadService(found)?found:undefined
    if(!service||event.senderFrame!==event.sender.mainFrame||!isWorkspaceUrl(service,event.sender.getURL()))return
    if(count!==null&&count!=='dot'&&(typeof count!=='number'||!Number.isInteger(count)||count<0||count>999999))return
    if(count===null)domUnread.delete(service);else domUnread.set(service,count as UnreadValue)
    const next=count===null?unreadFromTitle(event.sender.getTitle()):count as UnreadValue
    updateUnreadCount(service,next,'dom')
  })
  ipcMain.handle('workspace:unread',event=>{trusted(event);return {...unreadCounts}})
  let meetingSession:{token:string;contents:Electron.WebContents;model:string;cloud:boolean}|null=null
  const stopMeeting=()=>{meetingSession=null;for(const [id,controller] of aiRequests)if(id.startsWith('meeting-')){controller.abort();aiRequests.delete(id)}}
  notificationWorkspaceActivator=activateWorkspace
  if(pendingNotificationWorkspace){const service=pendingNotificationWorkspace;pendingNotificationWorkspace=undefined;activateWorkspace(service)}
  ipcMain.handle('meeting:start',async(event,model:unknown)=>{
    trusted(event)
    const meetingService=meetingServiceOf(currentWorkspaceService)
    if(typeof model==='string'&&(model.startsWith('gemini:')||model.startsWith('remote:')))throw new Error('Dịch cuộc họp hiện chỉ dùng ChatGPT.')
    if(typeof model!=='string'||!model.startsWith('chatgpt:')||model.length>200||!meetingService||!view||!view.getVisible())throw new Error('Anh mở Teams trước khi dịch cuộc họp.')
    const contents=view.webContents
    if(!trustedMeetingOrigin(meetingService,contents.getURL()))throw new Error('Trang cuộc họp chưa được xác minh.')
    const remembered=await learning.getMeetingRemember(meetingService)
    const read=remembered?{response:1,checkboxChecked:false}:await dialog.showMessageBox(window,{noLink:true,type:'question',checkboxLabel:'Ghi nhớ cho ứng dụng này (không hỏi lại)',checkboxChecked:false,title:'Đọc phụ đề cuộc họp',message:'Cho phép đọc chữ phụ đề cuộc họp đang hiển thị?',detail:'Anh tự bật phụ đề tiếng Anh trong ứng dụng họp. Tuân thủ chính sách cuộc họp và thông báo cho người tham gia khi cần. Không thu âm; không lưu transcript tự động.',buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0})
    if(read.response!==1)return null
    if(!remembered&&read.checkboxChecked)await learning.setMeetingRemember(meetingService,true)
    let cloud=false
    if(model.startsWith('chatgpt:')){const consent=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Dịch phụ đề bằng ChatGPT',message:'Gửi chữ phụ đề đang hiển thị đến OpenAI để dịch?',detail:'Đây là quyền riêng cho cuộc họp, không dùng quyền chat hoặc nội dung nhập tay. Không gửi âm thanh. Dừng dịch để thu hồi quyền phiên này.',buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0});if(consent.response!==1)return null;cloud=true}
    if(!meetingServiceOf(currentWorkspaceService)||view?.webContents!==contents||contents.isDestroyed())return null
    stopMeeting();const token=randomUUID();meetingSession={token,contents,model,cloud};return token
  })
  const validMeeting=(token:unknown)=>{const state=meetingSession;if(typeof token!=='string'||!state||state.token!==token||state.contents.isDestroyed()||!window.isVisible()||window.isMinimized()||!meetingServiceOf(currentWorkspaceService)||view?.webContents!==state.contents||!view.getVisible()||!trustedMeetingOrigin(meetingServiceOf(currentWorkspaceService)!,state.contents.getURL()))throw new Error('Phiên dịch cuộc họp đã dừng.');return state}
  ipcMain.handle('meeting:read',async(event,token:unknown)=>{trusted(event);const state=validMeeting(token);return state.contents.executeJavaScript(meetingCaptionScript(meetingServiceOf(currentWorkspaceService)!))})
  ipcMain.handle('meeting:stop',(event,token:unknown)=>{trusted(event);if(meetingSession?.token===token)stopMeeting()})
  ipcMain.handle('meeting:translate',async(event,token:unknown,text:unknown,id:unknown)=>{
    trusted(event);const state=validMeeting(token)
    if(typeof text!=='string'||text.length<2||text.length>4000||typeof id!=='string'||!/^meeting-[a-zA-Z0-9-]{1,80}$/.test(id)||aiRequests.has(id))throw new Error('Đoạn phụ đề không hợp lệ.')
    if(state.model.startsWith('chatgpt:')&&!state.cloud)throw new Error('Chưa cấp quyền cloud cho cuộc họp.')
    const controller=new AbortController();aiRequests.set(id,controller)
    try{return await runLocalAi('translateLatest',JSON.stringify({text:masking?maskSensitive(text):text}),state.model.startsWith('chatgpt:')?state.model.slice(8):state.model,state.model.startsWith('chatgpt:')?(model,input,instructions,signal)=>chatgpt.respond(model,input,instructions,signal,'low'):undefined,controller.signal)}finally{aiRequests.delete(id)}
  })

  ipcMain.handle('window:always-on-top',(event,enabled:unknown)=>{trusted(event);if(typeof enabled!=='boolean')throw new Error('Giá trị không hợp lệ.');window.setAlwaysOnTop(enabled,'floating');return window.isAlwaysOnTop()})

  ipcMain.handle('clipboard:write-text',(event,value:unknown)=>{
    trusted(event)
    if(typeof value!=='string'||value.length>50000)throw new Error('Nội dung sao chép không hợp lệ.')
    clipboard.writeText(value)
    return true
  })
  ipcMain.handle('workspace:reload',async event=>{
    trusted(event)
    stopMeeting()
    if(!view || view.webContents.isDestroyed())throw new Error('Anh mở workspace trước.')
    const current=view
    const url=current.webContents.getURL()
    const service=[...views.entries()].find(([,entry])=>entry===current)?.[0]
    if(service!=='whatsapp' && service!=='teams' && service!=='zalo' && service!=='outlook')throw new Error('Workspace không hợp lệ')
    await current.webContents.loadURL(isWorkspaceUrl(service,url)?url:sites[service])
    if(chatReadAuthorized&&view===current)current.webContents.send('chat:observer-control',true)
    return {title:current.webContents.getTitle()}
  })
  ipcMain.handle('privacy:masking',(event,enabled:unknown)=>{trusted(event);if(typeof enabled!=='boolean')throw new Error('Cài đặt không hợp lệ');masking=enabled})
  ipcMain.handle('privacy:retention:get',event=>{trusted(event);return learning.getRetentionDays()})
  ipcMain.handle('privacy:retention:set',async(event,days:unknown)=>{
    trusted(event)
    if(typeof days!=='number'||![0,30,90,365].includes(days))throw new Error('Thời hạn lưu không hợp lệ.')
    if(days>0){
      const result=await dialog.showMessageBox(window,{noLink:true,type:'warning',title:'Áp dụng thời hạn lưu dữ liệu',message:`Xóa từ vựng và lịch học cũ hơn ${days} ngày?`,detail:'Chỉ dữ liệu học trên máy này bị xóa. Tin nhắn, tài khoản và phiên đăng nhập không bị ảnh hưởng.',buttons:['Hủy','Áp dụng'],defaultId:0,cancelId:0})
      if(result.response!==1)return false
    }
    await learning.setRetentionDays(days)
    return true
  })
  ipcMain.handle('privacy:clear-local-data',async event=>{
    trusted(event)
    const answer=await dialog.showMessageBox(window,{noLink:true,type:'warning',title:'Xóa toàn bộ dữ liệu LinguaHub trên máy này?',message:'Xóa tài khoản và dữ liệu đã lưu trong LinguaHub?',detail:'App sẽ thử thu hồi token ChatGPT, đăng xuất WhatsApp và Teams, rồi xóa công việc (kể cả trích dẫn chat/email đã lưu), từ vựng, tiến độ học, quyền thông báo và cài đặt. Anh sẽ cần đăng nhập lại. Không thể hoàn tác.',buttons:['Hủy','Xóa toàn bộ dữ liệu'],defaultId:0,cancelId:0})
    if(answer.response!==1)return false
    stopMeeting()
    cloudConsent=false
    backgroundCloudConsent=false
    chatReadAuthorized=false
    outlookReadAuthorized=false
    microphoneAllowed=false
    masking=true
    for(const controller of aiRequests.values())controller.abort(new DOMException('Dữ liệu ứng dụng đã được xóa.','AbortError'))
    aiRequests.clear()
    for(const child of views.values()){
      const serviceSession=child.webContents.session
      window.contentView.removeChildView(child)
      if(!child.webContents.isDestroyed())child.webContents.close()
      await serviceSession.clearStorageData()
      await serviceSession.clearCache()
    }
    views.clear()
    for(const timer of notificationWarmupTimers.values())clearTimeout(timer)
    notificationWarmupTimers.clear();notificationArmed.clear();domUnread.clear();unreadCounts.whatsapp=0;unreadCounts.teams=0;unreadCounts.zalo=0;unreadCounts.outlook=0
    window.webContents.send('workspace:unread-changed',{...unreadCounts})
    view=undefined
    const chatgptResult=await chatgpt.clearLocalData()
    await tasks.clear()
    await learning.clearAll()
    notificationPermissions.whatsapp=false
    notificationPermissions.teams=false
    notificationPermissions.zalo=false
    notificationPermissions.outlook=false
    workspacePanelWidth=360
    workspacePanelCollapsed=false
    layoutWorkspaceViews()
    return {cleared:true,chatgptRevoked:chatgptResult.revoked}
  })
  ipcMain.handle('chatgpt:status',event=>{trusted(event);return chatgpt.status()})
  ipcMain.handle('chatgpt:cloud-consent',async event=>{
    trusted(event)
    if(cloudConsent)return true
    const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Xử lý nội dung bằng ChatGPT',message:'Cho phép gửi nội dung anh chủ động nhập đến OpenAI để xử lý?',detail:'Dùng quyền gói ChatGPT đã cấp. Nếu cho phép, lựa chọn được lưu trên máy này cho các lần mở app sau đến khi anh ngắt kết nối, đổi tài khoản ChatGPT hoặc xóa dữ liệu LinguaHub. Chỉ áp dụng nội dung anh chủ động nhập; dịch tin nhắn hiển thị cần xác nhận riêng.',buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0})
    if(answer.response!==1)return false
    await learning.setManualCloudConsent(true)
    cloudConsent=true
    return true
  })
  ipcMain.handle('chatgpt:background-cloud-consent',async event=>{
    trusted(event)
    if(backgroundCloudConsent)return true
    const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Cho phép dịch tin nhắn hiển thị bằng ChatGPT?',message:'Gửi chữ đang hiển thị trong WhatsApp, Teams, Zalo hoặc email Outlook đã cho phép đọc đến OpenAI để dịch?',detail:'LinguaHub đọc nội dung chữ từ DOM của trang ngay trên máy. Chỉ chữ của bong bóng tin đang hiển thị được gửi; không gửi ảnh chụp hoặc nội dung chat ẩn. Bật che email/số điện thoại sẽ áp dụng trước khi gửi nhưng có thể bỏ sót. Dừng dịch để ngừng gửi chữ. Anh có thể từ chối và chỉ dùng các trang trò chuyện/email.',buttons:['Không cho phép','Cho phép gửi chữ hiển thị'],defaultId:0,cancelId:0})
    backgroundCloudConsent=answer.response===1
    return backgroundCloudConsent
  })
  ipcMain.handle('chatgpt:disconnect',async event=>{trusted(event);stopMeeting();await learning.setManualCloudConsent(false);cloudConsent=false;backgroundCloudConsent=false;return chatgpt.disconnect()})
  ipcMain.handle('chatgpt:models',event=>{trusted(event);return chatgpt.listModels()})
  ipcMain.handle('chatgpt:usage-settings',event=>{trusted(event);return shell.openExternal('https://chatgpt.com/settings/usage')})
  ipcMain.handle('chatgpt:connect',event=>{trusted(event);return chatgpt.connect()})
  ipcMain.handle('chatgpt:connect-new-workspace',async event=>{
    trusted(event)
    const answer=await dialog.showMessageBox(window,{noLink:true,
      type:'question',
      title:'Đăng nhập bằng tài khoản hoặc không gian làm việc khác',
      message:'Anh muốn đăng ký kết nối ChatGPT mới?',
      detail:'OpenAI gắn mỗi đăng ký với tài khoản và không gian làm việc đã chọn. LinguaHub sẽ mở đăng nhập mới, không dùng lại mã đăng ký cũ. Nếu không thành công, kết nối ChatGPT hiện tại vẫn được giữ. Khi thành công, kết nối ChatGPT cũ trong LinguaHub sẽ được thay thế. WhatsApp, Teams và dữ liệu học không bị ảnh hưởng.',
      buttons:['Hủy','Tiếp tục đăng nhập'],defaultId:0,cancelId:0,
    })
    if(answer.response!==1)return null
    await learning.setManualCloudConsent(false)
    stopMeeting()
    cloudConsent=false
    backgroundCloudConsent=false
    return chatgpt.connect(true)
  })
  ipcMain.handle('preferences:get', event => { trusted(event); return learning.getPreferences() })
  ipcMain.handle('preferences:set', (event, input) => { trusted(event); return learning.setPreferences(input) })
  ipcMain.handle('preferences:reasoning-effort:get', event => { trusted(event); return learning.getReasoningEffort() })
  ipcMain.handle('preferences:reasoning-effort:set', async (event, input) => { trusted(event); return learning.setReasoningEffort(input) })
  ipcMain.handle('preferences:translation-reasoning-effort:get', event => { trusted(event); return learning.getTranslationReasoningEffort() })
  ipcMain.handle('preferences:translation-reasoning-effort:set', async (event, input) => { trusted(event); return learning.setTranslationReasoningEffort(input) })
  ipcMain.handle('preferences:fast-mode:get', event => { trusted(event); return learning.getFastMode() })
  ipcMain.handle('preferences:fast-mode:set', async (event, enabled) => { trusted(event); return learning.setFastMode(enabled) })
  ipcMain.handle('vocabulary:clear', async event => {
    trusted(event)
    const answer = await dialog.showMessageBox(window, {noLink:true,type:'warning',message:'Xóa toàn bộ từ vựng và lịch ôn trên máy này?',detail:'Thao tác không thể hoàn tác.',buttons:['Hủy','Xóa dữ liệu'],defaultId:0,cancelId:0})
    if(answer.response !== 1) return false
    await learning.clearVocabulary()
    return true
  })
  ipcMain.handle('vocabulary:list', event => { trusted(event); return learning.list() })
  ipcMain.handle('learning:progress', event => { trusted(event); return learning.getLearningProgress() })
  ipcMain.handle('learning:complete-daily-lesson', event => { trusted(event); return learning.completeDailyLesson() })
  ipcMain.handle('vocabulary:add', (event, input) => { trusted(event); return learning.add(input) })
  ipcMain.handle('vocabulary:review', (event, id, remembered) => { trusted(event); return learning.review(id, remembered) })
  ipcMain.handle('chat:authorize-visible-read', async event => {
    trusted(event)
    if(currentWorkspaceService==='outlook'&&!outlookReadAuthorized){
      const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Đọc email Outlook đang mở',message:'Cho phép LinguaHub đọc nội dung email Outlook đang mở?',detail:'Chỉ đọc thư đang chọn, không quét hộp thư hoặc bản nháp. Gửi nội dung đến ChatGPT để tạo công việc sẽ hỏi riêng khi anh bấm lấy việc.',checkboxLabel:'Ghi nhớ quyền đọc email Outlook',checkboxChecked:false,buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0})
      if(answer.response!==1)return false
      outlookReadAuthorized=true
      if(answer.checkboxChecked)await learning.setMeetingRemember('outlook-read',true)
    }
    if(chatReadAuthorized)return true
    // Asked once; with "remember" ticked, later sessions start reading without the prompt.
    chatReadPaused=false
    if(learning.getMeetingRemember('chat'))chatReadAuthorized=true
    else{
      const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Đọc chat hoặc email đang mở',message:'Cho phép LinguaHub đọc chữ trong chat/email đang mở?',detail:'Chỉ đọc tin nhắn hoặc email anh đã chọn trên WhatsApp, Teams, Zalo Web hoặc Outlook; không chụp màn hình. Gửi chữ đến ChatGPT để tạo công việc sẽ hỏi riêng mỗi lần.',checkboxLabel:'Ghi nhớ, không hỏi lại',checkboxChecked:true,buttons:['Hủy','Cho phép'],defaultId:1,cancelId:0})
      chatReadAuthorized=answer.response===1
      if(chatReadAuthorized&&answer.checkboxChecked)void learning.setMeetingRemember('chat',true).catch(()=>{})
    }
    controlChatObservers(false)
    if(chatReadAuthorized){
      const activeService=[...views.entries()].find(([,child])=>child===view)?.[0]
      if(activeService)controlChatObservers(true,activeService as ChatService)
    }
    return chatReadAuthorized
  })
  // One checklist for the permissions the app would otherwise ask for one by one.
  // Pausing translation must win over a remembered grant until the user turns it back on.
  let outlookReadAuthorized=learning.getMeetingRemember('outlook-read')
  let chatReadPaused=false
  const PERMISSION_KEYS=['chat','mic','teams','zalo'] as const
  ipcMain.handle('permissions:get', event => {
    trusted(event)
    return {...Object.fromEntries(PERMISSION_KEYS.map(key=>[key,learning.getMeetingRemember(key)])),reviewed:learning.getMeetingRemember('reviewed')}
  })
  ipcMain.handle('permissions:set', async (event, input: unknown) => {
    trusted(event)
    const data=z.object(Object.fromEntries(PERMISSION_KEYS.map(key=>[key,z.boolean()]))).strict().parse(input) as Record<typeof PERMISSION_KEYS[number],boolean>
    for(const key of PERMISSION_KEYS)await learning.setMeetingRemember(key,data[key])
    await learning.setMeetingRemember('reviewed',true)
    microphoneAllowed=data.mic
    chatReadAuthorized=data.chat
    chatReadPaused=false
    controlChatObservers(false)
    if(chatReadAuthorized){
      const activeService=[...views.entries()].find(([,child])=>child===view)?.[0]
      if(activeService)controlChatObservers(true,activeService as ChatService)
    }else{backgroundCloudConsent=false;clearChatMutationDebounces()}
    return true
  })
  ipcMain.handle('chat:visible-read-status', event => { trusted(event); if(!chatReadAuthorized&&!chatReadPaused&&learning.getMeetingRemember('chat'))chatReadAuthorized=true; return chatReadAuthorized&&(currentWorkspaceService!=='outlook'||outlookReadAuthorized) })
  ipcMain.handle('chat:stop-visible-read', event => { trusted(event); chatReadAuthorized=false; chatReadPaused=true; backgroundCloudConsent=false; clearChatMutationDebounces(); controlChatObservers(false) })
  const conversationIdOf=(service:string,url:string,snapshot:ChatDomSnapshot|null|undefined)=>createHash('sha256').update(`${service}:${url}:${String(snapshot?.conversationHint||'').slice(0,200)}`).digest('hex').slice(0,16)
  // ---- Zalo PC (official app, connected through its local DevTools port) ----
  const cleanSnapshot=(snapshot:ChatDomSnapshot|null|undefined)=>(Array.isArray(snapshot?.messages)?snapshot.messages:[])
    .filter(item=>item && typeof item.text==='string' && item.text.trim().length>=2)
    .slice(-60)
    .map(item=>({text:item.text.trim().slice(0,4000),side:(item.side==='left'||item.side==='right'?item.side:'center') as 'left'|'right'|'center',...(typeof item.id==='string'&&item.id.length>=1&&item.id.length<=200?{id:item.id}: {})}))
  const readZaloPc=async()=>{
    if(window.isMinimized()||!window.isVisible()||!await zaloPcConnected())return null
    const snapshot=await zaloPcEvaluate<ChatDomSnapshot>(buildVisibleChatReadScript('zalo'))
    const messages=cleanSnapshot(snapshot)
    return {conversationId:conversationIdOf('zalopc','zalo-pc',snapshot),messages,text:messages.map(item=>item.text).join('\n'),hint:String(snapshot?.conversationHint||'')}
  }
  ipcMain.handle('tasks:extract-visible',async(event,rawService:unknown,rawModel:unknown,rawRequestId:unknown)=>{
    trusted(event)
    const service=z.enum(['whatsapp','teams','zalo','outlook']).parse(rawService) as TaskSourceService
    const model=z.string().regex(/^chatgpt:[a-zA-Z0-9._:-]{1,180}$/).parse(rawModel)
    const requestId=z.string().regex(/^task-capture-[a-zA-Z0-9-]{1,80}$/).parse(rawRequestId)
    if(aiRequests.has(requestId))throw new Error('Yêu cầu tạo việc đang chạy.')
    if(service!==currentWorkspaceService)throw new Error('Ứng dụng chat/email đã đổi. Anh mở lại mục Công việc rồi thử lần nữa.')
    if(!chatReadAuthorized||(service==='outlook'&&!outlookReadAuthorized))throw new Error(service==='outlook'?'Anh cần cho phép đọc email Outlook đang mở trước.':'Anh cần cho phép đọc chat đang mở trước.')
    if(!window.isVisible()||window.isMinimized())throw new Error('Hãy mở LinguaHub trước khi lấy việc từ chat/email.')
    const targetCandidate=view??views.get(service)
    if(!targetCandidate)throw new Error('Không tìm thấy chat/email đang chọn. Mở chat hoặc email rồi quay lại Công việc.')
    const target=targetCandidate
    const stillCurrent=()=>!window.isDestroyed()&&!target.webContents.isDestroyed()&&window.isVisible()&&!window.isMinimized()&&currentWorkspaceService===service&&views.get(service)===target&&((view===target&&target.getVisible())||(view===undefined&&!target.getVisible()))&&isWorkspaceUrl(service,target.webContents.getURL())
    if(!stillCurrent())throw new Error('Không tìm thấy chat/email đang chọn. Mở chat hoặc email rồi quay lại Công việc.')
    const readSource=async()=>{
      if(!stillCurrent())throw new Error('Chat/email đã đổi. Chưa gửi nội dung đi; anh thử lại.')
      const url=target.webContents.getURL()
      const snapshot=await target.webContents.executeJavaScript(buildVisibleChatReadScript(service,10000)) as ChatDomSnapshot
      const rawMessages=Array.isArray(snapshot?.messages)?snapshot.messages:[]
      let remaining=10000
      const picked:ChatDomSnapshot['messages']=[]
      for(const item of rawMessages.slice(-60).reverse()){
        if(!item||typeof item.text!=='string')continue
        const text=item.text.trim().slice(0,remaining)
        if(text.length<2)continue
        picked.unshift({text,side:item.side==='left'||item.side==='right'?item.side:'center',...(typeof item.id==='string'?{id:item.id.slice(0,200)}:{})})
        remaining-=text.length+24
        if(remaining<100||picked.length>=20)break
      }
      if(!picked.length)throw new Error('Chưa thấy tin nhắn hoặc nội dung email trong vùng đang mở.')
      const cleanSnapshot={conversationHint:String(snapshot?.conversationHint||'').trim().slice(0,200),conversationLabel:String(snapshot?.conversationLabel||'').replace(/\s+/g,' ').trim().slice(0,200),messages:picked}
      return {snapshot:cleanSnapshot,url,conversationId:conversationIdOf(service,url,cleanSnapshot),fingerprint:createHash('sha256').update(JSON.stringify(picked)).digest('hex')}
    }
    const controller=new AbortController()
    aiRequests.set(requestId,controller)
    try{
      const captured=await readSource()
      const label=captured.snapshot.conversationLabel|| (captured.snapshot.conversationHint.startsWith('id:')?'Nội dung đang mở':captured.snapshot.conversationHint)||'Nội dung đang mở'
      const serviceName=service==='outlook'?'Outlook':service==='teams'?'Microsoft Teams':service==='zalo'?'Zalo Web':'WhatsApp'
      const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Lấy việc từ chat/email đang mở',message:`Gửi nội dung đang chọn trong ${serviceName} đến tài khoản ChatGPT để tìm việc cần làm?`,detail:'Chỉ đọc tối đa 20 tin gần nhất hoặc phần email đang mở (tối đa 10.000 ký tự). Mỗi lần bấm sẽ hỏi riêng. LinguaHub chỉ đưa việc đề xuất vào biểu mẫu; không lưu cho đến khi anh kiểm tra và bấm Lưu. Không gửi email hay tin nhắn.',buttons:['Hủy','Cho phép lần này'],defaultId:0,cancelId:0})
      if(answer.response!==1)return {cancelled:true,source:{service,label},tasks:[]} satisfies TaskCaptureResult&{cancelled:boolean}
      if(controller.signal.aborted)throw controller.signal.reason||new DOMException('Yêu cầu đã bị hủy.','AbortError')
      const beforeSend=await readSource()
      if(beforeSend.conversationId!==captured.conversationId||beforeSend.fingerprint!==captured.fingerprint)throw new Error('Nội dung chat/email vừa thay đổi. Chưa gửi đi; anh bấm lấy việc lại nhé.')
      const slug=model.slice('chatgpt:'.length)
      const available=(await chatgpt.listModels()).some(item=>item.slug===slug)
      if(!available)throw new Error('Model ChatGPT đã chọn không còn khả dụng. Anh chọn lại model trong Cài đặt.')
      if(controller.signal.aborted)throw controller.signal.reason||new DOMException('Yêu cầu đã bị hủy.','AbortError')
      const sourceMessages=captured.snapshot.messages.map(message=>({side:message.side,text:message.text}))
      const makePayload=()=>JSON.stringify({service,conversation:captured.snapshot.conversationHint,messages:sourceMessages})
      let sourceText=makePayload()
      while(sourceText.length>11500&&sourceMessages.length){
        if(sourceMessages.length>1)sourceMessages.shift()
        else{
          const message=sourceMessages[0]
          const keep=Math.max(1000,Math.floor(message.text.length*0.7))
          const start=Math.ceil(keep*0.65),end=keep-start
          message.text=`${message.text.slice(0,start)}\n[… nội dung giữa đã rút gọn …]\n${message.text.slice(-end)}`
        }
        sourceText=makePayload()
      }
      const providerInput=masking?maskSensitive(sourceText):sourceText
      const effort=isGpt6Model(slug)?reasoningEffortForTask('extractTasks',learning.getReasoningEffort(),learning.getTranslationReasoningEffort(),learning.getFastMode(),FAST_REASONING_EFFORT):undefined
      const result=await runLocalAi('extractTasks',providerInput,slug,(provider,input,instructions,signal,onTiming,onText)=>chatgpt.respond(provider,input,instructions,signal,effort,onTiming,onText),controller.signal)
      if(controller.signal.aborted)throw controller.signal.reason||new DOMException('Yêu cầu đã bị hủy.','AbortError')
      const after=await readSource()
      if(after.conversationId!==captured.conversationId||after.fingerprint!==captured.fingerprint)throw new Error('Chat/email đã đổi trong lúc phân tích. Đề xuất cũ bị bỏ; anh lấy việc lại nhé.')
      const tasks=(result as {tasks:TaskCaptureSuggestion[]}).tasks
      await learning.recordAiUsage('chatgpt','extractTasks').catch(()=>{})
      return {cancelled:false,source:{service,label},tasks} satisfies TaskCaptureResult&{cancelled:boolean}
    }finally{if(aiRequests.get(requestId)===controller)aiRequests.delete(requestId)}
  })
  const sendZaloPc=async(text:string,expectedConversation:string)=>{
    const before=await readZaloPc()
    if(!before||before.conversationId!==expectedConversation)throw new Error('Cuộc trò chuyện trong Zalo PC đã đổi. Mở lại đúng chat rồi dịch lại trước khi gửi.')
    const box=await zaloPcEvaluate<ComposerState>(buildComposerScript('zalo',false))
    if(!box?.found)throw new Error('Không tìm thấy ô soạn tin trong Zalo PC.')
    if(box.text)throw new Error('Ô soạn tin trong Zalo PC đang có chữ. Xoá hoặc gửi phần đó trước.')
    const recipient=recipientLabel('zalo',box.label,before.hint)
    if(learning.getSendConfirm()){
      const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Gửi tin nhắn?',message:`Gửi tin này đến ${recipient} trên Zalo PC?`,detail:text.length>600?`${text.slice(0,600)}…`:text,buttons:['Hủy','Gửi'],defaultId:0,cancelId:0})
      if(answer.response!==1)return {sent:false,cancelled:true,recipient}
      const again=await readZaloPc()
      if(!again||again.conversationId!==expectedConversation)throw new Error('Cuộc trò chuyện đã đổi trong lúc xác nhận nên chưa gửi.')
    }
    const focused=await zaloPcEvaluate<ComposerState>(buildComposerScript('zalo',true))
    if(!focused?.found||focused.text)throw new Error('Ô soạn tin đã thay đổi nên chưa gửi.')
    await zaloPcType(text)
    await new Promise(resolve=>setTimeout(resolve,150))
    const typed=await zaloPcEvaluate<ComposerState>(buildComposerScript('zalo',false))
    const normalize=(value:string)=>value.replace(/\s+/g,' ').trim()
    if(normalize(typed?.text||'')!==normalize(text))throw new Error('Chữ trong ô soạn tin Zalo PC không khớp bản xem trước nên chưa gửi.')
    await zaloPcPressEnter()
    for(let attempt=0;attempt<20;attempt++){
      await new Promise(resolve=>setTimeout(resolve,100))
      const state=await zaloPcEvaluate<ComposerState>(buildComposerScript('zalo',false)).catch(()=>null)
      if(state?.found&&!state.text)return {sent:true,cancelled:false,recipient}
    }
    return {sent:false,cancelled:false,recipient}
  }
  const zaloPcStatus=async()=>({installed:!!await findZaloPcExe(),running:await zaloPcRunning(),connected:await zaloPcConnected()})
  ipcMain.handle('zalopc:open', async event => {
    trusted(event)
    stopMeeting()
    ++workspaceRequest
    currentWorkspaceService='zalopc'
    clearChatMutationDebounces()
    for(const existing of views.values()){existing.webContents.send('chat:observer-control',false);existing.setVisible(false)}
    view=undefined
    void syncZaloEmbed()
    return {...await zaloPcStatus(),embedded:zaloEmbedEnabled}
  })
  ipcMain.handle('zalopc:status', async event => { trusted(event); return zaloPcStatus() })
  ipcMain.handle('zalopc:connect', async event => {
    trusted(event)
    return connectZaloPcFlow()
  })
  // Zalo Web tab call button: Zalo Web has no calls, so open the same chat in Zalo PC and press its call button.
  ipcMain.handle('zalo:call-via-pc', async (event, kind: unknown) => {
    trusted(event)
    const value=z.enum(['voice','video']).parse(kind)
    const zaloView=views.get('zalo')
    if(currentWorkspaceService!=='zalo'||!zaloView||zaloView.webContents.isDestroyed())throw new Error('Mở tab Zalo Web trước.')
    const title=String(await zaloView.webContents.executeJavaScript(`(document.querySelector('header#header .header-title')?.innerText||'').replace(/\\s+/g,' ').trim()`)||'')
    if(!title)throw new Error('Mở một cuộc trò chuyện trong Zalo Web trước.')
    if(!await connectZaloPcFlow())return {called:false,name:title}
    await zaloPcBringToFront().catch(()=>undefined)
    const opened=async()=>sameChatName(String(await zaloPcEvaluate<string>(buildOpenTitleScript())||''),title)
    if(!await opened()){
      // Search by the full name first, then by its first two words (Zalo PC search ignores some punctuation).
      let matches=0
      for(const query of [...new Set([title,title.split(/\s+/).slice(0,2).join(' ')])]){
        if(!await zaloPcEvaluate<boolean>(buildFocusSearchScript()))throw new Error('Không tìm thấy ô tìm kiếm của Zalo PC.')
        await zaloPcType(query)
        for(let attempt=0;attempt<15&&matches===0;attempt++){
          await new Promise(resolve=>setTimeout(resolve,200))
          matches=Number(await zaloPcEvaluate<number>(buildOpenSearchResultScript(title))||0)
        }
        if(matches)break
      }
      if(matches>1)throw new Error(`Zalo PC có ${matches} cuộc trò chuyện trùng tên "${title}". Mở đúng người trong Zalo PC rồi bấm gọi ở đó.`)
      if(matches===0)throw new Error(`Không tìm thấy "${title}" trong Zalo PC.`)
      for(let attempt=0;attempt<15&&!await opened();attempt++)await new Promise(resolve=>setTimeout(resolve,200))
      if(!await opened())throw new Error('Zalo PC chưa mở được đúng cuộc trò chuyện nên chưa gọi.')
    }
    const pressed=await zaloPcEvaluate<boolean>(buildCallScript(value))
    if(!pressed)throw new Error('Cuộc trò chuyện này không có nút gọi (nhóm hoặc tài khoản OA).')
    return {called:true,name:title}
  })
  const connectZaloPcFlow=async()=>{
    if(await zaloPcConnected())return true
    const exe=await findZaloPcExe()
    if(!exe)throw new Error('Chưa thấy Zalo PC trên máy. Cài Zalo PC rồi thử lại.')
    if(await zaloPcRunning()){
      const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Kết nối Zalo PC',message:'Mở lại Zalo PC để LinguaHub kết nối?',detail:'Zalo PC đang chạy nhưng chưa bật kết nối. LinguaHub sẽ đóng Zalo PC rồi mở lại với cổng kết nối chỉ trên máy này (127.0.0.1). Tin nhắn không mất, không cần đăng nhập lại.',buttons:['Hủy','Mở lại'],defaultId:1,cancelId:0})
      if(answer.response!==1)return false
      await closeZaloPc()
      for(let attempt=0;attempt<20&&await zaloPcRunning();attempt++)await new Promise(resolve=>setTimeout(resolve,250))
    }
    launchZaloPc(exe)
    for(let attempt=0;attempt<60;attempt++){
      await new Promise(resolve=>setTimeout(resolve,500))
      if(await zaloPcConnected()){setTimeout(()=>void syncZaloEmbed(),1500);return true}
    }
    throw new Error('Zalo PC đã mở nhưng chưa cho kết nối. Thoát hẳn Zalo PC (khay hệ thống → Thoát) rồi bấm Kết nối lại.')
  }
  ipcMain.handle('zalopc:call', async (event, kind: unknown) => {
    trusted(event)
    const value=z.enum(['voice','video']).parse(kind)
    if(!await zaloPcConnected())throw new Error('Chưa kết nối Zalo PC.')
    const pressed=await zaloPcEvaluate<boolean>(buildCallScript(value))
    if(!pressed)throw new Error('Mở một cuộc trò chuyện 1-1 trong Zalo PC trước (nhóm không có nút gọi).')
    return true
  })
  ipcMain.handle('chat:read-visible', async event => {
    trusted(event)
    if(!chatReadAuthorized||(currentWorkspaceService==='outlook'&&!outlookReadAuthorized))throw new Error(currentWorkspaceService==='outlook'?'Anh bấm Bật dịch để cho phép đọc email đang mở.':'Chưa cho phép đọc chữ chat đang hiển thị.')
    if(currentWorkspaceService==='zalopc')return readZaloPc()
    if(window.isMinimized() || !window.isVisible() || !view || view.webContents.isDestroyed() || !view.getVisible())return null

    const url=view.webContents.getURL()
    if(!isWorkspaceUrl(currentWorkspaceService,url))return null
    const snapshot=await view.webContents.executeJavaScript(buildVisibleChatReadScript(currentWorkspaceService)) as ChatDomSnapshot
    const messages=(Array.isArray(snapshot?.messages)?snapshot.messages:[])
      .filter(item=>item && typeof item.text==='string' && item.text.trim().length>=2)
      .slice(-60)
      .map(item=>({text:item.text.trim().slice(0,4000),side:item.side==='left'||item.side==='right'?item.side:'center',...(typeof item.id==='string'&&item.id.length>=1&&item.id.length<=200?{id:item.id}: {})}))
    const conversationId=conversationIdOf(currentWorkspaceService,url,snapshot)
    return {conversationId,messages,text:messages.map(item=>item.text).join('\n')}
  })
  // Direct send: only into the conversation the English preview was made for, after a native
  // confirmation naming the recipient, and only reported as sent once the message box is empty again.
  ipcMain.handle('chat:send-confirm', (event, value: unknown) => { trusted(event); return value === undefined ? learning.getSendConfirm() : learning.setSendConfirm(value) })
  ipcMain.handle('chat:send-direct', async (event, rawText: unknown, rawConversation: unknown) => {
    trusted(event)
    if(currentWorkspaceService==='outlook')throw new Error('Outlook chỉ hỗ trợ sao chép câu trả lời; anh kiểm tra và gửi trong Outlook.')
    const text=z.string().trim().min(1).max(4000).parse(rawText).replace(/\s*\n+\s*/g,' ')
    const expectedConversation=z.string().min(8).max(64).parse(rawConversation)
    if(!chatReadAuthorized)throw new Error('Chưa cho phép đọc chat đang hiển thị nên chưa xác minh được người nhận.')
    if(currentWorkspaceService==='zalopc')return sendZaloPc(text,expectedConversation)
    const service=currentWorkspaceService
    const target=view
    const ready=()=>!!target&&view===target&&!target.webContents.isDestroyed()&&target.getVisible()&&window.isVisible()&&!window.isMinimized()&&currentWorkspaceService===service&&isWorkspaceUrl(service,target.webContents.getURL())
    const currentConversation=async()=>{
      if(!ready())return null
      const snapshot=await target!.webContents.executeJavaScript(buildVisibleChatReadScript(service)) as ChatDomSnapshot
      return {id:conversationIdOf(service,target!.webContents.getURL(),snapshot),hint:String(snapshot?.conversationHint||'')}
    }
    const composer=async(focus:boolean)=>await target!.webContents.executeJavaScript(buildComposerScript(service,focus)) as ComposerState
    const before=await currentConversation()
    if(!before||before.id!==expectedConversation)throw new Error('Cuộc trò chuyện đã đổi. Mở lại đúng chat rồi dịch lại trước khi gửi.')
    const box=await composer(false)
    if(!box.found)throw new Error('Không tìm thấy ô soạn tin. Mở khung chat rồi thử lại.')
    if(box.text)throw new Error('Ô soạn tin trong chat đang có chữ. Xoá hoặc gửi phần đó trước.')
    const appName=service==='whatsapp'?'WhatsApp':service==='teams'?'Teams':service==='zalo'?'Zalo':'Outlook'
    const recipient=recipientLabel(service,box.label,before.hint)
    if(learning.getSendConfirm()){
      const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Gửi tin nhắn?',message:`Gửi tin này đến ${recipient} trên ${appName}?`,detail:text.length>600?`${text.slice(0,600)}…`:text,buttons:['Hủy','Gửi'],defaultId:0,cancelId:0})
      if(answer.response!==1)return {sent:false,cancelled:true,recipient}
    }
    const after=await currentConversation()
    if(!after||after.id!==expectedConversation)throw new Error('Cuộc trò chuyện đã đổi trong lúc xác nhận nên chưa gửi.')
    target!.webContents.focus()
    const focused=await composer(true)
    if(!focused.found||focused.text)throw new Error('Ô soạn tin đã thay đổi nên chưa gửi.')
    await target!.webContents.insertText(text)
    await new Promise(resolve=>setTimeout(resolve,150))
    const typed=await composer(false)
    const normalize=(value:string)=>value.replace(/\s+/g,' ').trim()
    if(normalize(typed.text)!==normalize(text))throw new Error('Chữ trong ô soạn tin không khớp bản xem trước nên chưa gửi. Anh kiểm tra ô chat.')
    target!.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'})
    target!.webContents.sendInputEvent({type:'char',keyCode:'\r'})
    target!.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'})
    for(let attempt=0;attempt<20;attempt++){
      await new Promise(resolve=>setTimeout(resolve,100))
      if(!ready())break
      const state=await composer(false)
      if(state.found&&!state.text)return {sent:true,cancelled:false,recipient}
    }
    return {sent:false,cancelled:false,recipient}
  })
  ipcMain.handle('providers:status', event => {
    trusted(event)
    const secrets = providerSecrets.get()
    return { geminiKeySet: !!secrets.geminiKey, remoteUrl: secrets.remoteUrl || '', remoteTokenSet: !!secrets.remoteToken, geminiConsent: learning.getProviderConsent('gemini'), remoteConsent: learning.getProviderConsent('remote') }
  })
  ipcMain.handle('providers:set', async (event, input: unknown) => {
    trusted(event)
    const data = z.object({ geminiKey: z.string().trim().min(10).max(200).optional(), remoteUrl: z.string().trim().max(300).optional(), remoteToken: z.string().trim().min(8).max(300).optional() }).parse(input)
    if (data.remoteUrl && !validRemoteUrl(data.remoteUrl)) throw new Error('Địa chỉ máy AI phải là HTTPS công khai, ví dụ link ngrok.')
    await providerSecrets.set(Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)))
    return { ok: true }
  })
  ipcMain.handle('providers:consent', async (event, provider: unknown, enabled: unknown) => { trusted(event); return learning.setProviderConsent(provider, enabled) })
  ipcMain.handle('providers:models', async (event, provider: unknown) => {
    trusted(event)
    const secrets = providerSecrets.get()
    if (provider === 'gemini') {
      if (!secrets.geminiKey) throw new Error('Chưa nhập khóa API Gemini.')
      return (await geminiListModels(secrets.geminiKey)).map(name => `gemini:${name}`)
    }
    if (provider === 'remote') {
      if (!secrets.remoteUrl || !secrets.remoteToken) throw new Error('Chưa nhập địa chỉ hoặc token máy AI.')
      return (await remoteListModels(secrets.remoteUrl, secrets.remoteToken)).map(name => `remote:${name}`)
    }
    throw new Error('Nhà cung cấp không hợp lệ.')
  })
  ipcMain.handle('ai:run', async (event, task: AiTask, text: string, model: string, requestId?: unknown, options?:unknown) => {
    trusted(event)
    if(task==='extractTasks')throw new Error('Tạo công việc phải đọc nguồn chat/email trong luồng riêng có xác nhận.')
    if(typeof model!=='string'||typeof text!=='string'||(requestId!==undefined&&(typeof requestId!=='string'||requestId.length<1||requestId.length>100)))throw new Error('Nội dung không hợp lệ')
    if(options!==undefined&&(!options||typeof options!=='object'||typeof (options as {replyFast?:unknown}).replyFast!=='boolean'||Object.keys(options).some(key=>key!=='replyFast')))throw new Error('Cấu hình gợi ý không hợp lệ.')
    if(!/^(chatgpt:|gemini:|remote:)/.test(model))throw new Error('Ollama đã được gỡ. Anh chọn lại ChatGPT trong Cài đặt.')
    if(masking)text=maskSensitive(text)
    if(model.startsWith('chatgpt:')&&!hasCloudConsentForTask(task,cloudConsent,backgroundCloudConsent))throw new Error(task==='translateLatest'||task==='translateMessages'||task==='replyTranslationFromChat'?'Anh cần cho phép gửi chữ tin nhắn hiển thị đến ChatGPT trước.':'Anh cần cho phép xử lý cloud trước khi gửi nội dung.')
    let reasoningEffort=model.startsWith('chatgpt:')&&isGpt6Model(model.slice(8))
      ? reasoningEffortForTask(task,learning.getReasoningEffort(),learning.getTranslationReasoningEffort(),learning.getFastMode(),FAST_REASONING_EFFORT)
      : undefined
    if(model.startsWith('chatgpt:')&&(task==='reply'||task==='replyFromChat')&&(options as {replyFast?:boolean}|undefined)?.replyFast){
      const allowed=(await chatgpt.listModels()).find(item=>item.slug===model.slice(8))?.reasoningEfforts
      const fast=allowed?.includes('low')?'low':allowed?.includes('medium')?'medium':undefined
      if(!fast)throw new Error('Model chưa công bố hỗ trợ Low/Medium. Anh tắt Trả lời nhanh để tiếp tục.')
      reasoningEffort=fast
    }
    const controller=new AbortController()
    const id=typeof requestId==='string'?requestId:null
    if(id && aiRequests.has(id))throw new Error('Mã yêu cầu AI đang được dùng.')
    if(id)aiRequests.set(id,controller)
    try {
      const timing={requestMs:0,firstResponseMs:null as number|null,completionMs:0}
      const onTiming=(update:Partial<typeof timing>)=>Object.assign(timing,update)
      const onText=(delta:string)=>{if(task==='translateLatest'&&id&&!event.sender.isDestroyed())event.sender.send('ai:stream',{requestId:id,delta})}
      // Gemini and a self-hosted endpoint need their own explicit consent; keys stay in the main process.
      const external:'gemini'|'remote'|null=model.startsWith('gemini:')?'gemini':model.startsWith('remote:')?'remote':null
      if(external&&!learning.getProviderConsent(external))throw new Error(external==='gemini'?'Anh cần cho phép gửi chữ đến Gemini trước.':'Anh cần cho phép gửi chữ đến máy AI riêng trước.')
      const externalResponder=external==='gemini'
        ? async(m:string,input:string,instructions:string,signal?:AbortSignal)=>{const s=providerSecrets.get();if(!s.geminiKey)throw new Error('Chưa nhập khóa API Gemini.');return geminiRespond(s.geminiKey,m,input,instructions,signal)}
        : external==='remote'
          ? async(m:string,input:string,instructions:string,signal?:AbortSignal)=>{const s=providerSecrets.get();if(!s.remoteUrl||!s.remoteToken)throw new Error('Chưa nhập địa chỉ hoặc token máy AI.');return remoteRespond(s.remoteUrl,s.remoteToken,m,input,instructions,signal)}
          : undefined
      const result=model.startsWith('chatgpt:')
        ? await runLocalAi(task,text,model.slice(8),(provider,input,instructions,signal,onResponseTiming,onResponseText)=>chatgpt.respond(provider,input,instructions,signal,reasoningEffort,onResponseTiming,onResponseText),controller.signal,onTiming,onText)
        : external
          ? await runLocalAi(task,text,model.slice(external.length+1),externalResponder,controller.signal,onTiming,onText)
          : (()=>{throw new Error('Dịch vụ AI không còn được hỗ trợ.')})()
      await learning.recordAiUsage(external??'chatgpt',task).catch(()=>{})
      return task==='translateMessages'||task==='translateLatest'?{result,timing}:result
    } finally { if(id)aiRequests.delete(id) }
  })
  ipcMain.handle('ai:cancel',(event,requestId:unknown)=>{
    trusted(event)
    if(typeof requestId!=='string'||requestId.length>100)return false
    const controller=aiRequests.get(requestId)
    if(!controller)return false
    controller.abort(new DOMException('Yêu cầu đã bị hủy.','AbortError'))
    return true
  })
  ipcMain.handle('notifications:test', async (event) => {
    trusted(event)
    if (!Notification.isSupported()) throw new Error('Thông báo Windows không khả dụng')
    if (!isUnreadService(currentWorkspaceService)) throw new Error('Mở WhatsApp, Teams, Zalo hoặc Outlook để thử thông báo.')
    const notification = new Notification(genericWorkspaceNotificationOptions(currentWorkspaceService))
    routeWorkspaceNotificationClick(notification,currentWorkspaceService,activateWorkspace)
    await new Promise<void>((resolve,reject)=>{
      let settled=false
      let timeout:ReturnType<typeof setTimeout>|undefined
      const finish=(error?:Error)=>{
        if(settled)return
        settled=true
        if(timeout)clearTimeout(timeout)
        if(error){notification.close();reject(error)}else resolve()
      }
      timeout=setTimeout(()=>finish(new Error('Windows chưa xác nhận đã nhận toast thử nghiệm.')),5000)
      notification.once('show',()=>finish())
      notification.once('failed',(_event,error)=>finish(new Error(`Windows không hiển thị được toast: ${error}`)))
      notification.show()
    })
    return true
  })
  ipcMain.handle('notifications:get', event => { trusted(event); return learning.getNotificationPreferences() })
  ipcMain.handle('notifications:set', async (event, service: unknown, enabled: unknown) => {
    trusted(event)
    if ((service !== 'whatsapp' && service !== 'teams' && service !== 'zalo' && service !== 'outlook') || typeof enabled !== 'boolean') throw new Error('Cài đặt thông báo không hợp lệ')
    if (enabled) {
      if (!Notification.isSupported()) throw new Error('Thông báo Windows không khả dụng')
      const allowed = await grantNotificationPermission(service)
      if (!allowed) return learning.getNotificationPreferences()
    } else {
      const updated = await learning.setNotificationPreference(service, false)
      notificationPermissions[service] = false
      return updated
    }
    return learning.getNotificationPreferences()
  })
  ipcMain.handle('workspace:external', (event, service: keyof typeof sites) => {
    trusted(event)
    if (!Object.hasOwn(sites, service)) throw new Error('Invalid service')
    return shell.openExternal(sites[service])
  })
  ipcMain.handle('workspace:open', async (event, service: keyof typeof sites) => {
    trusted(event)
    stopMeeting()
    if (!Object.hasOwn(sites, service)) throw new Error('Invalid service')
    const request=++workspaceRequest
    if(request!==workspaceRequest)return {title:''}
    currentWorkspaceService=service
    void syncZaloEmbed()
    for (const existing of views.values()) { existing.webContents.send('chat:observer-control',false); existing.setVisible(false) }
    const existing = views.get(service)
    if (existing) {
      view = existing
      view.setVisible(true)
      if(chatReadAuthorized)view.webContents.send('chat:observer-control',true)
      layoutWorkspaceViews()
      return { title: view.webContents.getTitle() }
    }
    view = new WebContentsView({ webPreferences: { preload: join(import.meta.dirname, '../preload/chat-view.cjs'), partition: `persist:linguahub-${service}`, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } })
    views.set(service, view)
    const serviceContents=view.webContents
    serviceContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame&&isUnreadService(service)){const timer=notificationWarmupTimers.get(service);if(timer)clearTimeout(timer);notificationWarmupTimers.delete(service);notificationArmed.delete(service);domUnread.delete(service);if(unreadCounts[service]!==0){unreadCounts[service]=0;if(!window.isDestroyed())window.webContents.send('workspace:unread-changed',{...unreadCounts})}}})
    const updateUnread=(title:string)=>{
      if(!isUnreadService(service)||!isWorkspaceUrl(service,serviceContents.getURL()))return
      const count=domUnread.get(service)??unreadFromTitle(title)
      updateUnreadCount(service,count,'title')
    }
    serviceContents.on('page-title-updated',(_event,title)=>updateUnread(title))
    serviceContents.on('did-finish-load',()=>{updateUnread(serviceContents.getTitle());if(isUnreadService(service))scheduleNotificationWarmup(service,serviceContents)})
    if(service==='zalo'){
      let remaining=100
      serviceContents.session.webRequest.onErrorOccurred(details=>{
        if(remaining>0&&zaloDiagnosticHost(details.url)!=='other'){remaining--;void diagnostic('zalo-network-failed',zaloNetworkDiagnostic(details.url,details.error))}
      })
      serviceContents.on('did-finish-load',()=>{void diagnostic('zalo-loaded',{host:zaloDiagnosticHost(serviceContents.getURL())})})
      serviceContents.on('render-process-gone',()=>{void diagnostic('zalo-renderer-gone')})
    }
    serviceContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame&&meetingSession?.contents===serviceContents)stopMeeting()})
    const zaloAuthContents=new Set<Electron.WebContents>()
    let zaloStorageAllowed=false
    let zaloMediaGranted=false
    const zaloMediaOwned=(contents:Electron.WebContents|null)=>!!contents&&(contents===serviceContents||zaloAuthContents.has(contents))&&isWorkspaceUrl('zalo',contents.getURL())
    serviceContents.on('focus',()=>{if(view?.webContents!==serviceContents||!window.isVisible()||window.isMinimized())activateWorkspace(service)})
    serviceContents.session.setPermissionCheckHandler((contents,permission,origin,details)=>{
      if(permission==='notifications')return false
      // Zalo calls: microphone/camera only for Zalo pages (main view or its call window) once granted.
      if(service==='zalo'&&permission==='media')return zaloMediaOwned(contents)&&isWorkspaceUrl('zalo',origin)&&(!details.embeddingOrigin||isWorkspaceUrl('zalo',details.embeddingOrigin))&&(zaloMediaGranted||learning.getMeetingRemember('zalo'))
      if(service==='zalo')return zaloStorageAllowed&&isZaloStorageRequest(permission,serviceContents.getURL(),origin,contents===serviceContents||!!contents&&zaloAuthContents.has(contents))&&(!details.embeddingOrigin||isWorkspaceUrl('zalo',details.embeddingOrigin))
      return false
    })
    serviceContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
      if(permission==='notifications'){
        callback(false)
        return
      }
      if(service==='zalo'&&permission==='media'){
        const origin=('securityOrigin' in details?details.securityOrigin:undefined)||details.requestingUrl||''
        const types='mediaTypes' in details?details.mediaTypes||[]:[]
        if(!zaloMediaOwned(contents)||!isWorkspaceUrl('zalo',origin)||!types.length||types.some(type=>type!=='audio'&&type!=='video')){callback(false);return}
        if(zaloMediaGranted||learning.getMeetingRemember('zalo')){zaloMediaGranted=true;callback(true);return}
        try{
          const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Cuộc gọi Zalo',message:`Cho phép Zalo dùng ${types.map(type=>type==='audio'?'microphone':'camera').join(' và ')} để gọi?`,detail:'Chỉ cho trang Zalo (chat.zalo.me) trong ứng dụng. Windows vẫn có thể chặn thiết bị trong Cài đặt quyền riêng tư.',checkboxLabel:'Ghi nhớ, không hỏi lại',checkboxChecked:true,buttons:['Hủy','Cho phép'],defaultId:1,cancelId:0})
          zaloMediaGranted=answer.response===1
          if(zaloMediaGranted&&answer.checkboxChecked)await learning.setMeetingRemember('zalo',true)
          callback(zaloMediaGranted)
        }catch{callback(false)}
        return
      }
      if(service==='zalo'){
        const origin=details.requestingUrl||''
        if(!isZaloStorageRequest(permission,serviceContents.getURL(),origin,contents===serviceContents||!!contents&&zaloAuthContents.has(contents))){callback(false);return}
        try{const answer=await dialog.showMessageBox(window,{noLink:true,type:'question',title:'Phiên đăng nhập Zalo',message:'Cho phép trang đăng nhập Zalo sử dụng phiên Zalo trong ứng dụng?',detail:'Chỉ áp dụng chat.zalo.me và id.zalo.me; không cấp microphone, camera hoặc dữ liệu của WhatsApp/Teams.',buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0});zaloStorageAllowed=answer.response===1&&isZaloStorageRequest(permission,serviceContents.getURL(),origin,contents===serviceContents||!!contents&&zaloAuthContents.has(contents));callback(zaloStorageAllowed)}catch{callback(false)}
        return
      }
      callback(false)
    })
    if(service==='teams')installMeetingPermissions(service,serviceContents,window,{get:async()=>learning.getMeetingRemember(service),set:async enabled=>{await learning.setMeetingRemember(service,enabled)}})
    // Keep the real Chromium version; remove application-specific product tokens
    // that legacy browser-version parsers can mistake for the browser version.
    const chromiumUserAgent = view.webContents.getUserAgent()
      .replace(/\sElectron\/[^\s]+/g, '')
      .replace(/\slinguahub-ai-pro\/[^\s]+/gi, '')
    view.webContents.setUserAgent(chromiumUserAgent)
    // Sign-in popups stay inside the same service session: Zalo and Outlook.
    const popupAllowed=(url:string)=>(service==='zalo'||service==='outlook')&&isWorkspaceUrl(service,url)
    view.webContents.setWindowOpenHandler(({ url }) => {
      if(popupAllowed(url))return {action:'allow',overrideBrowserWindowOptions:{parent:window,width:700,height:850,webPreferences:{session:serviceContents.session,nodeIntegration:false,contextIsolation:true,sandbox:true}}}
      if(isSafeExternalWebUrl(url)){
        const hostname=new URL(url).hostname
        void dialog.showMessageBox(window,{noLink:true,type:'question',title:'Mở liên kết ngoài LinguaHub?',message:`Mở ${hostname} trong trình duyệt mặc định?`,detail:'Kiểm tra tên miền trước khi mở liên kết từ cuộc trò chuyện.',buttons:['Hủy','Mở liên kết'],defaultId:0,cancelId:0}).then(result=>{if(result.response===1)return shell.openExternal(url)}).catch(()=>{})
      }
      return { action: 'deny' }
    })
    if(service==='zalo')serviceContents.on('did-create-window',child=>{
      const childContents=child.webContents
      zaloAuthContents.add(childContents)
      childContents.once('destroyed',()=>zaloAuthContents.delete(childContents))
      child.webContents.setWindowOpenHandler(()=>({action:'deny'}))
      child.webContents.on('will-navigate',(event,url)=>{if(!isWorkspaceUrl('zalo',url))event.preventDefault()})
      child.webContents.on('will-redirect',(event,url)=>{if(!isWorkspaceUrl('zalo',url))event.preventDefault()})
    })
    if(service==='outlook')serviceContents.on('did-create-window',child=>{
      child.webContents.setWindowOpenHandler(()=>({action:'deny'}))
      child.webContents.on('will-navigate',(event,url)=>{if(!popupAllowed(url))event.preventDefault()})
      child.webContents.on('will-redirect',(event,url)=>{if(!popupAllowed(url))event.preventDefault()})
    })
    view.webContents.on('will-navigate', (event,url)=>{if(!isWorkspaceUrl(service,event.url||url)){event.preventDefault();if(service==='zalo')void diagnostic('zalo-navigation-blocked',zaloBlockedNavigationDiagnostic(event.url||url))}})
    view.webContents.on('will-redirect', (event,url)=>{if(!isWorkspaceUrl(service,event.url||url)){event.preventDefault();if(service==='zalo')void diagnostic('zalo-navigation-blocked',zaloBlockedNavigationDiagnostic(event.url||url))}})
    window.contentView.addChildView(view)
    layoutWorkspaceViews()
    const openingView = view
    return openingView.webContents.loadURL(sites[service]).then(() => {
      if(chatReadAuthorized&&view===openingView)openingView.webContents.send('chat:observer-control',true)
      return { title: openingView.webContents.getTitle() }
    })
  })
  ipcMain.handle('workspace:dashboard', async event => {
    trusted(event)
    const request=++workspaceRequest;if(request!==workspaceRequest)return false
    stopMeeting()
    chatReadAuthorized=false
    backgroundCloudConsent=false
    clearChatMutationDebounces()
    controlChatObservers(false)
    for(const child of views.values())if(!child.webContents.isDestroyed())child.setVisible(false)
    view=undefined
    return true
  })
  window.on('resize', layoutWorkspaceViews)
  window.on('closed', () => { tray?.destroy();tray=undefined; chatReadAuthorized=false; for (const child of views.values()) if (!child.webContents.isDestroyed()) child.webContents.close(); views.clear() })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('render-process-gone',()=>{void diagnostic('renderer-gone')})
  void diagnostic('application-ready')
  window.webContents.on('will-navigate',event=>event.preventDefault())
  if(process.env.LINGUAHUB_STARTUP_SMOKE==='1'&&process.env.LINGUAHUB_SMOKE_MARKER){
    window.webContents.once('did-finish-load',()=>{
      try{writeFileSync(process.env.LINGUAHUB_SMOKE_MARKER as string,'renderer-ready\n',{encoding:'utf8'});setTimeout(()=>app.quit(),0)}
      catch{app.exit(1)}
    })
  }
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
}).catch(() => {
  void diagnostic('startup-failed')
  dialog.showErrorBox('LinguaHub chưa khởi động được', 'Không mở được dữ liệu hoặc thành phần ứng dụng. Anh giữ nguyên thư mục dữ liệu để có thể khôi phục, rồi mở lại app. Chưa có dữ liệu nào bị tự động xóa.')
  app.quit()
})
app.on('window-all-closed', () => app.quit())
