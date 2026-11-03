import {app,BrowserWindow,dialog,screen} from 'electron'
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process'
import {existsSync} from 'node:fs'
import {basename,join,isAbsolute} from 'node:path'
import {createInterface} from 'node:readline'
import {companionLayout,type WindowRect} from './zalo-pc-layout'

export type ZaloPcResult={status:'ready'|'opened'|'cancelled';arranged:boolean}
class NativeClient {
 alive=true
 private child:ChildProcessWithoutNullStreams
 private id=0
 private pending=new Map<number,{resolve:(ok:boolean)=>void;timer:ReturnType<typeof setTimeout>}>()
 constructor(executable:string){
  const helper=app.isPackaged?join(process.resourcesPath,'ZaloCompanion.exe'):join(app.getAppPath(),'out/native/ZaloCompanion.exe')
  if(!existsSync(helper))throw new Error('Thiếu thành phần sắp xếp cửa sổ Zalo PC. Anh cài lại bản LinguaHub mới.')
  this.child=spawn(helper,[executable],{windowsHide:true,stdio:'pipe'})
  const lines=createInterface({input:this.child.stdout})
  lines.on('line',line=>{try{const result=JSON.parse(line);const entry=this.pending.get(result.id);if(entry){clearTimeout(entry.timer);this.pending.delete(result.id);entry.resolve(result.ok===true)}}catch{}})
  this.child.stderr.resume()
  const finish=()=>{this.alive=false;lines.close();for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.resolve(false)}this.pending.clear()}
  this.child.on('error',finish);this.child.on('exit',finish)
  this.child.stdin.on('error',finish)
 }
 request(op:'find'|'place'|'release',rect?:WindowRect){return new Promise<boolean>(resolve=>{
  if(!this.alive||this.child.exitCode!==null||this.child.stdin.destroyed){resolve(false);return}
  const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);resolve(false)},3000)
  this.pending.set(id,{resolve,timer});this.child.stdin.write(JSON.stringify({id,op,...rect})+'\n')
 })}
 async close(){
  await this.request('release').catch(()=>false)
  if(!this.child.stdin.destroyed)this.child.stdin.end()
  if(this.child.exitCode===null){const timer=setTimeout(()=>{if(this.child.exitCode===null)this.child.kill()},1500);timer.unref();this.child.once('exit',()=>clearTimeout(timer))}
 }
}

export class ZaloPcCompanion {
 private client:NativeClient|undefined
 private generation=0
 private pending:Promise<ZaloPcResult>|undefined
 private snapshot:{bounds:WindowRect;minimum:[number,number];maximized:boolean}|undefined
 constructor(private window:BrowserWindow,private save:()=>void){}
 get active(){return !!this.snapshot}
 private restoreWindow(){
  const previous=this.snapshot;this.snapshot=undefined
  if(previous&&!this.window.isDestroyed()){this.window.setMinimumSize(...previous.minimum);this.window.setBounds(previous.bounds);if(previous.maximized)this.window.maximize()}
 }
 async release(){
  this.generation++;this.pending=undefined
  const client=this.client;this.client=undefined
  this.restoreWindow();if(client)await client.close()
 }
 open():Promise<ZaloPcResult>{
  if(this.pending)return this.pending
  const generation=++this.generation
  const run=this.start(generation).catch(async error=>{if(generation===this.generation)await this.release();throw error});this.pending=run
  void run.finally(()=>{if(this.pending===run)this.pending=undefined}).catch(()=>{})
  return run
 }
 private async start(generation:number):Promise<ZaloPcResult>{
  if(process.platform!=='win32')throw new Error('Chế độ Zalo PC hiện chỉ hỗ trợ Windows.')
  if(this.client){
   const previous=this.client,found=await previous.request('find')
   if(generation!==this.generation)return {status:'cancelled',arranged:false}
   if(found)return this.arrange()
   this.client=undefined;await previous.close()
   if(generation!==this.generation)return {status:'cancelled',arranged:false}
  }
  const locations=[join(process.env.LOCALAPPDATA||'','Programs','Zalo','Zalo.exe'),join(process.env.LOCALAPPDATA||'','Zalo','Zalo.exe'),join(process.env.ProgramFiles||'','Zalo','Zalo.exe'),join(process.env['ProgramFiles(x86)']||'','Zalo','Zalo.exe')]
  let executable=locations.find(path=>isAbsolute(path)&&existsSync(path))
  if(!executable){const selected=await dialog.showOpenDialog(this.window,{title:'Chọn Zalo PC đã cài trên máy',properties:['openFile'],filters:[{name:'Zalo.exe',extensions:['exe']}]});if(generation!==this.generation||selected.canceled)return {status:'cancelled',arranged:false};executable=selected.filePaths[0]}
  if(!executable||!isAbsolute(executable)||basename(executable).toLowerCase()!=='zalo.exe'||!existsSync(executable))throw new Error('Anh chọn đúng file Zalo.exe của ứng dụng Zalo PC đã cài.')
  if(generation!==this.generation)return {status:'cancelled',arranged:false}
  const client=new NativeClient(executable);this.client=client
  try{
   if(!await client.request('find')){
    if(generation!==this.generation)return {status:'cancelled',arranged:false}
    await new Promise<void>((resolve,reject)=>{const child=spawn(executable!,[],{stdio:'ignore',windowsHide:false});child.once('spawn',()=>resolve());child.once('error',()=>reject(new Error('Không mở được Zalo PC. Anh thử mở Zalo PC từ Start rồi bấm lại.')))})
    const deadline=Date.now()+8000
    while(Date.now()<deadline&&client.alive){
     if(generation!==this.generation)return {status:'cancelled',arranged:false}
     if(await client.request('find'))break
     await new Promise(resolve=>setTimeout(resolve,400))
    }
   }
   if(generation!==this.generation)return {status:'cancelled',arranged:false}
   return await this.arrange()
  }catch(error){if(this.client===client){this.client=undefined;await client.close()}throw error}
 }
 async arrange():Promise<ZaloPcResult>{
  const client=this.client,generation=this.generation
  if(!client)return {status:'opened',arranged:false}
  const layout=companionLayout(screen.getDisplayMatching(this.window.getBounds()).workArea)
  if(!layout){this.restoreWindow();return {status:'opened',arranged:false}}
  if(!await client.request('place',screen.dipToScreenRect(this.window,layout.zalo))){if(generation===this.generation)this.restoreWindow();return {status:'opened',arranged:false}}
  if(generation!==this.generation||client!==this.client||this.window.isDestroyed()){await client.close();return {status:'cancelled',arranged:false}}
  if(!this.snapshot){this.save();const minimum=this.window.getMinimumSize();this.snapshot={bounds:this.window.getNormalBounds(),minimum:[minimum[0],minimum[1]],maximized:this.window.isMaximized()}}
  this.window.unmaximize();this.window.setMinimumSize(380,500);this.window.setBounds(layout.assistant);this.window.show();this.window.focus()
  return {status:'ready',arranged:true}
 }
}
