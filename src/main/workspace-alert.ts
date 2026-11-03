import {Notification} from 'electron'
import type {WorkspaceService} from './notification-policy'

export function showWorkspaceAlert(service:WorkspaceService,count:number,activate:(service:WorkspaceService)=>void){
 const notification=new Notification({title:service==='whatsapp'?'WhatsApp':service==='teams'?'Microsoft Teams':'Zalo Web',body:`Có thông báo chưa đọc mới (${count}). Bấm để mở ứng dụng chat.`})
 notification.on('click',()=>activate(service))
 notification.show()
 return notification
}
