import { app, BrowserWindow, WebContentsView, ipcMain, shell, Notification, dialog } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { listLocalModels, runLocalAi, type AiTask } from './ai'
import { VisibleOcr } from './visible-ocr'
import { createLearningStore } from './database/store'
import { ChatGPTConnection } from './auth/connection'
import { maskSensitive } from '../shared/mask-sensitive'
import { isSafeExternalWebUrl, isWorkspaceUrl } from '../shared/navigation'
import { diagnostic } from './diagnostics'
import {restoreWindow,saveWindow} from './window-state'
import { canShowWorkspaceNotification, isNotificationOrigin, type WorkspaceService } from './notification-policy'
import { getOcrAssetPaths } from './ocr-assets'
import { hasCloudConsentForTask } from './cloud-consent'
import { APP_USER_MODEL_ID, TOAST_ACTIVATOR_CLSID, startMenuShortcutPath, toastShortcutDetails } from './windows-notifications'
const ocr = new VisibleOcr()
let window: BrowserWindow
let view: WebContentsView | undefined
let workspacePanelWidth=360
let workspacePanelCollapsed=false
const views = new Map<string, WebContentsView>()
app.setAppUserModelId(APP_USER_MODEL_ID)
if(process.platform==='win32')app.setToastActivatorCLSID(TOAST_ACTIVATOR_CLSID)
const sites = { whatsapp: 'https://web.whatsapp.com', teams: 'https://teams.microsoft.com' }
const ownsInstance=app.requestSingleInstanceLock()
if(!ownsInstance)app.quit()
app.on('second-instance',()=>{if(window && !window.isDestroyed()){window.restore();window.show();window.focus()}})
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
  ensureWindowsToastShortcut()
  let cloudConsent = false
  let backgroundCloudConsent = false
  let masking = true
  const chatgpt = new ChatGPTConnection(app.getPath('userData'))
  const aiRequests = new Map<string, AbortController>()
  await chatgpt.initialize()
  const learning = await createLearningStore(app.getPath('userData'), app.isPackaged ? join(process.resourcesPath, 'sql-wasm.wasm') : join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm'))
  workspacePanelWidth=learning.getPreferences().panelWidth
  const notificationPermissions = await learning.getNotificationPreferences()
  const notificationPrompts = new Map<WorkspaceService, Promise<boolean>>()
  const grantNotificationPermission = async (service: WorkspaceService) => {
    if (notificationPermissions[service]) return true
    const pending = notificationPrompts.get(service)
    if (pending) return pending
    const prompt = (async () => {
      const answer = await dialog.showMessageBox(window, {
        type: 'question',
        title: 'Cho phép thông báo Windows',
        message: `Cho phép ${service === 'whatsapp' ? 'WhatsApp' : 'Microsoft Teams'} hiện thông báo trên Windows?`,
        detail: 'Thông báo có thể hiển thị tên người gửi và nội dung tin nhắn. Anh có thể tắt quyền này trong Cài đặt.',
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
  window.on('close',()=>saveWindow(window))
  const layoutWorkspaceViews=()=>{
    if(window.isDestroyed())return
    const [width,height]=window.getContentSize()
    const panelWidth=workspacePanelCollapsed?56:workspacePanelWidth
    const dividerWidth=workspacePanelCollapsed?0:6
    for(const child of views.values())child.setBounds({x:0,y:64,width:Math.max(300,width-panelWidth-dividerWidth),height:Math.max(100,height-64)})
  }
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
  let microphoneAllowed=false
  window.webContents.session.setPermissionCheckHandler((contents,permission)=>contents===window.webContents && permission==='media' && microphoneAllowed)
  window.webContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
    if(contents!==window.webContents || permission!=='media' || !('mediaTypes' in details) || !details.mediaTypes?.length || details.mediaTypes.some(type=>type!=='audio')){callback(false);return}
    try{const result=await dialog.showMessageBox(window,{type:'question',message:'Cho phép microphone để luyện nói?',detail:'Thu âm cục bộ, tối đa 60 giây. Không gửi bản thu đến AI.',buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0});microphoneAllowed=result.response===1;callback(microphoneAllowed)}catch{callback(false)}
  })
  const trusted = (event: Electron.IpcMainInvokeEvent) => { if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted sender') }
  ipcMain.handle('workspace:reload',async event=>{
    trusted(event)
    if(!view || view.webContents.isDestroyed())throw new Error('Anh mở workspace trước.')
    const current=view
    const url=current.webContents.getURL()
    const service=[...views.entries()].find(([,entry])=>entry===current)?.[0]
    if(service!=='whatsapp' && service!=='teams')throw new Error('Workspace không hợp lệ')
    ocr.invalidate()
    await current.webContents.loadURL(isWorkspaceUrl(service,url)?url:sites[service])
    return {title:current.webContents.getTitle()}
  })
  ipcMain.handle('privacy:masking',(event,enabled:unknown)=>{trusted(event);if(typeof enabled!=='boolean')throw new Error('Cài đặt không hợp lệ');masking=enabled})
  ipcMain.handle('privacy:retention:get',event=>{trusted(event);return learning.getRetentionDays()})
  ipcMain.handle('privacy:retention:set',async(event,days:unknown)=>{
    trusted(event)
    if(typeof days!=='number'||![0,30,90,365].includes(days))throw new Error('Thời hạn lưu không hợp lệ.')
    if(days>0){
      const result=await dialog.showMessageBox(window,{type:'warning',title:'Áp dụng thời hạn lưu dữ liệu',message:`Xóa từ vựng và lịch học cũ hơn ${days} ngày?`,detail:'Chỉ dữ liệu học trên máy này bị xóa. Tin nhắn, tài khoản và phiên đăng nhập không bị ảnh hưởng.',buttons:['Hủy','Áp dụng'],defaultId:0,cancelId:0})
      if(result.response!==1)return false
    }
    await learning.setRetentionDays(days)
    return true
  })
  ipcMain.handle('privacy:clear-local-data',async event=>{
    trusted(event)
    const answer=await dialog.showMessageBox(window,{type:'warning',title:'Xóa toàn bộ dữ liệu LinguaHub trên máy này?',message:'Xóa tài khoản và dữ liệu đã lưu trong LinguaHub?',detail:'App sẽ thử thu hồi token ChatGPT, đăng xuất WhatsApp và Teams, rồi xóa từ vựng, tiến độ học, quyền thông báo và cài đặt. Anh sẽ cần đăng nhập lại. Không thể hoàn tác.',buttons:['Hủy','Xóa toàn bộ dữ liệu'],defaultId:0,cancelId:0})
    if(answer.response!==1)return false
    cloudConsent=false
    backgroundCloudConsent=false
    masking=true
    microphoneAllowed=false
    for(const controller of aiRequests.values())controller.abort(new DOMException('Dữ liệu ứng dụng đã được xóa.','AbortError'))
    aiRequests.clear()
    ocr.stop()
    for(const child of views.values()){
      const serviceSession=child.webContents.session
      window.contentView.removeChildView(child)
      if(!child.webContents.isDestroyed())child.webContents.close()
      await serviceSession.clearStorageData()
      await serviceSession.clearCache()
    }
    views.clear()
    view=undefined
    const chatgptResult=await chatgpt.clearLocalData()
    await learning.clearAll()
    notificationPermissions.whatsapp=false
    notificationPermissions.teams=false
    workspacePanelWidth=360
    workspacePanelCollapsed=false
    layoutWorkspaceViews()
    return {cleared:true,chatgptRevoked:chatgptResult.revoked}
  })
  ipcMain.handle('chatgpt:status',event=>{trusted(event);return chatgpt.status()})
  ipcMain.handle('chatgpt:cloud-consent',async event=>{
    trusted(event)
    const answer=await dialog.showMessageBox(window,{type:'question',title:'Xử lý nội dung bằng ChatGPT',message:'Cho phép gửi nội dung anh chủ động nhập đến OpenAI để xử lý?',detail:'Dùng quyền gói ChatGPT đã cấp. Quyền này chỉ áp dụng trong lần chạy app hiện tại và chỉ cho nội dung nhập tay; dịch OCR nền cần xác nhận riêng. Ảnh OCR không được gửi.',buttons:['Hủy','Cho phép'],defaultId:0,cancelId:0})
    cloudConsent=answer.response===1
    return cloudConsent
  })
  ipcMain.handle('chatgpt:background-cloud-consent',async event=>{
    trusted(event)
    if(backgroundCloudConsent)return true
    const answer=await dialog.showMessageBox(window,{type:'question',title:'Cho phép dịch OCR nền bằng ChatGPT?',message:'Gửi chữ nhận dạng trong vùng chat đang hiển thị đến OpenAI để dịch tự động?',detail:'Chỉ văn bản OCR được gửi khi dùng model ChatGPT. Ảnh chụp luôn xử lý cục bộ, không tải lên. Nếu bật che email/số điện thoại, app áp dụng trước khi gửi nhưng có thể bỏ sót. Dừng OCR để ngừng gửi chữ. Anh có thể từ chối và dùng Ollama trên máy.',buttons:['Không cho phép','Cho phép gửi chữ OCR'],defaultId:0,cancelId:0})
    backgroundCloudConsent=answer.response===1
    return backgroundCloudConsent
  })
  ipcMain.handle('chatgpt:disconnect',event=>{trusted(event);cloudConsent=false;backgroundCloudConsent=false;return chatgpt.disconnect()})
  ipcMain.handle('chatgpt:models',event=>{trusted(event);return chatgpt.listModels()})
  ipcMain.handle('chatgpt:usage-settings',event=>{trusted(event);return shell.openExternal('https://chatgpt.com/settings/usage')})
  ipcMain.handle('chatgpt:connect',event=>{trusted(event);return chatgpt.connect()})
  ipcMain.handle('preferences:get', event => { trusted(event); return learning.getPreferences() })
  ipcMain.handle('preferences:set', (event, input) => { trusted(event); return learning.setPreferences(input) })
  ipcMain.handle('vocabulary:clear', async event => {
    trusted(event)
    const answer = await dialog.showMessageBox(window, {type:'warning',message:'Xóa toàn bộ từ vựng và lịch ôn trên máy này?',detail:'Thao tác không thể hoàn tác.',buttons:['Hủy','Xóa dữ liệu'],defaultId:0,cancelId:0})
    if(answer.response !== 1) return false
    await learning.clearVocabulary()
    return true
  })
  ipcMain.handle('vocabulary:list', event => { trusted(event); return learning.list() })
  ipcMain.handle('learning:progress', event => { trusted(event); return learning.getLearningProgress() })
  ipcMain.handle('learning:complete-daily-lesson', event => { trusted(event); return learning.completeDailyLesson() })
  ipcMain.handle('vocabulary:add', (event, input) => { trusted(event); return learning.add(input) })
  ipcMain.handle('vocabulary:review', (event, id, remembered) => { trusted(event); return learning.review(id, remembered) })
  ipcMain.handle('ocr:authorize', event => { trusted(event); return ocr.authorize(window) })
  ipcMain.handle('ocr:assets', event => { trusted(event); return getOcrAssetPaths(app.isPackaged, app.getAppPath(), process.resourcesPath) })
  ipcMain.handle('ocr:stop', event => { trusted(event); ocr.stop(); backgroundCloudConsent=false })
  ipcMain.handle('ocr:read', (event, leftPercent: number) => { trusted(event); if (window.isMinimized() || !window.isVisible()) return null; return ocr.recognize(view, leftPercent) })
  ipcMain.handle('ai:models', (event) => { trusted(event); return listLocalModels() })
  ipcMain.handle('ai:run', async (event, task: AiTask, text: string, model: string, requestId?: unknown) => {
    trusted(event)
    if(typeof model!=='string'||typeof text!=='string'||(requestId!==undefined&&(typeof requestId!=='string'||requestId.length<1||requestId.length>100)))throw new Error('Nội dung không hợp lệ')
    if(masking)text=maskSensitive(text)
    if(model.startsWith('chatgpt:')&&!hasCloudConsentForTask(task,cloudConsent,backgroundCloudConsent))throw new Error(task==='translateMessages'?'Anh cần cho phép gửi chữ OCR nền đến ChatGPT trước.':'Anh cần cho phép xử lý cloud trước khi gửi nội dung.')
    const controller=new AbortController()
    const id=typeof requestId==='string'?requestId:null
    if(id && aiRequests.has(id))throw new Error('Mã yêu cầu AI đang được dùng.')
    if(id)aiRequests.set(id,controller)
    try {
      const result=model.startsWith('chatgpt:')
        ? await runLocalAi(task,text,model.slice(8),(provider,input,instructions,signal)=>chatgpt.respond(provider,input,instructions,signal),controller.signal)
        : await runLocalAi(task,text,model,undefined,controller.signal)
      await learning.recordAiUsage(model.startsWith('chatgpt:')?'chatgpt':'ollama',task).catch(()=>{})
      return result
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
    const notification = new Notification({ title: 'LinguaHub AI Pro', body: 'Thông báo thử nghiệm từ ứng dụng.' })
    notification.on('click', () => { window.restore(); window.show(); window.focus() })
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
    if ((service !== 'whatsapp' && service !== 'teams') || typeof enabled !== 'boolean') throw new Error('Cài đặt thông báo không hợp lệ')
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
  ipcMain.handle('workspace:open', (event, service: keyof typeof sites) => {
    trusted(event)
    if (!Object.hasOwn(sites, service)) throw new Error('Invalid service')
    ocr.invalidate()
    for (const existing of views.values()) existing.setVisible(false)
    const existing = views.get(service)
    if (existing) {
      view = existing
      view.setVisible(true)
      layoutWorkspaceViews()
      return { title: view.webContents.getTitle() }
    }
    view = new WebContentsView({ webPreferences: { partition: `persist:linguahub-${service}`, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } })
    views.set(service, view)
    const serviceContents=view.webContents
    serviceContents.session.setPermissionCheckHandler((contents,permission,origin)=>canShowWorkspaceNotification(service,permission,origin,notificationPermissions[service],contents===null || contents===serviceContents))
    serviceContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
      const origin=details.requestingUrl || contents?.getURL() || ''
      if ((contents!==null && contents!==serviceContents) || permission!=='notifications' || !isNotificationOrigin(service,origin)){callback(false);return}
      if(notificationPermissions[service]){callback(true);return}
      try{callback(await grantNotificationPermission(service))}catch{callback(false)}
    })
    // Keep the real Chromium version; remove application-specific product tokens
    // that legacy browser-version parsers can mistake for the browser version.
    const chromiumUserAgent = view.webContents.getUserAgent()
      .replace(/\sElectron\/[^\s]+/g, '')
      .replace(/\slinguahub-ai-pro\/[^\s]+/gi, '')
    view.webContents.setUserAgent(chromiumUserAgent)
    view.webContents.setWindowOpenHandler(({ url }) => {
      if(isSafeExternalWebUrl(url)){
        const hostname=new URL(url).hostname
        void dialog.showMessageBox(window,{type:'question',title:'Mở liên kết ngoài LinguaHub?',message:`Mở ${hostname} trong trình duyệt mặc định?`,detail:'Kiểm tra tên miền trước khi mở liên kết từ cuộc trò chuyện.',buttons:['Hủy','Mở liên kết'],defaultId:0,cancelId:0}).then(result=>{if(result.response===1)return shell.openExternal(url)}).catch(()=>{})
      }
      return { action: 'deny' }
    })
    view.webContents.on('will-navigate', (event,url)=>{if(!isWorkspaceUrl(service,url))event.preventDefault()})
    view.webContents.on('will-redirect', (event,url)=>{if(!isWorkspaceUrl(service,url))event.preventDefault()})
    window.contentView.addChildView(view)
    layoutWorkspaceViews()
    const openingView = view
    return openingView.webContents.loadURL(sites[service]).then(() => ({ title: openingView.webContents.getTitle() }))
  })
  ipcMain.handle('workspace:dashboard', event => {
    trusted(event)
    ocr.stop()
    backgroundCloudConsent=false
    for(const child of views.values())if(!child.webContents.isDestroyed())child.setVisible(false)
    view=undefined
    return true
  })
  window.on('resize', layoutWorkspaceViews)
  window.on('closed', () => { void ocr.dispose().catch(()=>{}); for (const child of views.values()) if (!child.webContents.isDestroyed()) child.webContents.close(); views.clear() })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('render-process-gone',()=>{void diagnostic('renderer-gone')})
  void diagnostic('application-ready')
  window.webContents.on('will-navigate',event=>event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
}).catch(() => {
  void diagnostic('startup-failed')
  dialog.showErrorBox('LinguaHub chưa khởi động được', 'Không mở được dữ liệu hoặc thành phần ứng dụng. Anh giữ nguyên thư mục dữ liệu để có thể khôi phục, rồi mở lại app. Chưa có dữ liệu nào bị tự động xóa.')
  app.quit()
})
app.on('window-all-closed', () => app.quit())
