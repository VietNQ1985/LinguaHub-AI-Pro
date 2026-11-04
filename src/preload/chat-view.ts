import { ipcRenderer } from 'electron'
import { observeVisibleChatChanges } from '../shared/chat-change-observer'
import {observeWorkspaceUnread} from '../shared/workspace-unread-dom'

const unreadService=location.hostname==='web.whatsapp.com'?'whatsapp':location.hostname==='chat.zalo.me'?'zalo': ['teams.microsoft.com','teams.cloud.microsoft'].includes(location.hostname)?'teams':null
if(unreadService){
 const start=()=>{const stop=observeWorkspaceUnread(document,unreadService,count=>ipcRenderer.send('workspace:unread-dom',count));window.addEventListener('pagehide',stop,{once:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()
}

let stopObserving: (() => void) | undefined

ipcRenderer.on('chat:observer-control', (_event, enabled: unknown) => {
  if (enabled === true && !stopObserving) {
    stopObserving = observeVisibleChatChanges(observedAt => {
      ipcRenderer.send('chat:visible-dom-change', observedAt)
    })
  } else if (enabled !== true && stopObserving) {
    stopObserving()
    stopObserving = undefined
  }
})
