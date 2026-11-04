import { app } from 'electron'
import { appendFile, mkdir, rename, stat, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
type DiagnosticEvent='startup-failed'|'renderer-gone'|'workspace-load-failed'|'application-ready'|'startup-smoke-renderer-ready'|'startup-smoke-load-failed'|'notification-shortcut-ready'|'notification-shortcut-failed'|'zalo-network-failed'|'zalo-navigation-blocked'|'zalo-loaded'|'zalo-renderer-gone'|'workspace-unread'
let queue=Promise.resolve()
export function diagnostic(event:DiagnosticEvent, metadata?:{host:string;code?:string;status?:number}){
  // Callers provide sanitized host/codes only; no raw page errors or URLs.
  const suffix=metadata?` ${JSON.stringify(metadata)}`:''
  queue=queue.catch(()=>{}).then(async()=>{
    const directory=join(app.getPath('userData'),'logs')
    await mkdir(directory,{recursive:true})
    const backups=(await readdir(directory)).filter(name=>/^previous-\d+\.log$/.test(name)).sort().reverse()
    for(const name of backups.slice(2))await unlink(join(directory,name))
    for(const name of backups.slice(0,2)){const info=await stat(join(directory,name));if(Date.now()-info.mtimeMs>30*86400000)await unlink(join(directory,name))}
    const path=join(directory,'application.log')
    try{if((await stat(path)).size>262144)await rename(path,join(directory,`previous-${Date.now()}.log`))}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
    // Fixed event codes only: no URLs, error messages, text, account IDs or tokens.
    await appendFile(path,`${new Date().toISOString()} ${event}${suffix}\n`,'utf8')
  })
  return queue.catch(()=>{})
}
