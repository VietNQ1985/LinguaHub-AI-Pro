// Synthetic HTTPS fixtures in an isolated session. No real website or account data.
const {app,BrowserWindow,WebContentsView,session,ipcMain}=require('electron')
const {mkdtempSync}=require('node:fs'),{tmpdir}=require('node:os'),{join,resolve}=require('node:path')
app.setPath('userData',mkdtempSync(join(tmpdir(),'linguahub-unread-smoke-')))
let parent
app.whenReady().then(async()=>{
 parent=new BrowserWindow({show:false,width:1000,height:700})
 for(const [service,host,html] of [
  ['whatsapp','web.whatsapp.com','<span aria-label="2 unread messages">2</span>'],
  ['teams','teams.microsoft.com','<span data-tid="chat-badge">2</span>'],
  ['zalo','chat.zalo.me','<nav><span class="z-noti-badge">2</span></nav>'],
 ]){
  const received=[],partition=session.fromPartition('unread-smoke-'+service)
  await partition.protocol.handle('https',()=>new Response('<title>Chat</title>'+html,{headers:{'content-type':'text/html'}}))
  const view=new WebContentsView({webPreferences:{session:partition,preload:resolve('out/preload/chat-view.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}})
  parent.contentView.addChildView(view);view.setVisible(false)
  const collect=(event,value)=>{if(event.sender===view.webContents&&event.senderFrame===event.sender.mainFrame)received.push(value)}
  ipcMain.on('workspace:unread-dom',collect)
  const wait=async value=>{const deadline=Date.now()+4000;while(!received.includes(value)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));if(!received.includes(value))throw Error(service+' missing '+value+'; received '+JSON.stringify(received))}
  try{
   await view.webContents.loadURL('https://'+host+'/fixture');await wait(2)
   await view.webContents.executeJavaScript('document.querySelector("span").textContent="5";if(document.querySelector("span").hasAttribute("aria-label"))document.querySelector("span").setAttribute("aria-label","5 unread messages")');await wait(5)
   await view.webContents.executeJavaScript('document.querySelector("span").remove()');await wait(0)
   if(view.webContents.getTitle()!=='Chat')throw Error('Unexpected title mutation')
   console.log('UNREAD_PRELOAD_SMOKE '+service+' hidden view: 2 -> 5 -> 0; unchanged title; main-frame IPC verified')
  }finally{ipcMain.removeListener('workspace:unread-dom',collect);view.webContents.close()}
 }
 parent.destroy();app.quit()
}).catch(error=>{console.error(error.message);if(parent&&!parent.isDestroyed())parent.destroy();app.exit(1)})
