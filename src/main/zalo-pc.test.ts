import {beforeEach,expect,test,vi} from 'vitest'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
const state=vi.hoisted(()=>({spawn:vi.fn(),area:{x:0,y:0,width:1920,height:1040},holdFind:false,place:true}))
vi.mock('electron',()=>({app:{isPackaged:false,getAppPath:()=>process.cwd()},dialog:{showOpenDialog:vi.fn()},screen:{getDisplayMatching:()=>({workArea:state.area}),dipToScreenRect:(_window:unknown,rect:unknown)=>rect}}))
vi.mock('node:child_process',()=>({spawn:state.spawn}))
vi.mock('node:fs',()=>({existsSync:()=>true}))
import {ZaloPcCompanion} from './zalo-pc'
class FakeHelper extends EventEmitter {
 stdin=new PassThrough();stdout=new PassThrough();stderr=new PassThrough();exitCode:number|null=null
 commands:any[]=[]
 kill=vi.fn(()=>{this.exitCode=0;this.emit('exit',0);return true})
 constructor(){super();this.stdin.on('data',data=>{const command=JSON.parse(String(data));this.commands.push(command);if(command.op==='find'&&state.holdFind)return;queueMicrotask(()=>this.stdout.write(JSON.stringify({id:command.id,ok:command.op==='place'?state.place:true})+'\n'))});this.stdin.on('finish',()=>{this.exitCode=0;this.emit('exit',0);this.stdout.end()})}
}
function windowMock(){return {isDestroyed:()=>false,getBounds:()=>({x:50,y:60,width:1200,height:800}),getNormalBounds:()=>({x:50,y:60,width:1200,height:800}),getMinimumSize:()=>[1000,600],isMaximized:()=>false,setMinimumSize:vi.fn(),setBounds:vi.fn(),maximize:vi.fn(),unmaximize:vi.fn(),show:vi.fn(),focus:vi.fn()}}
beforeEach(()=>{state.spawn.mockReset();state.holdFind=false;state.place=true;state.area={x:0,y:0,width:1920,height:1040}})
const windowsTest=test.skipIf(process.platform!=='win32')
windowsTest('arranges only after the native helper succeeds and restores on release',async()=>{
 const helper=new FakeHelper();state.spawn.mockReturnValue(helper);const window=windowMock(),save=vi.fn(),companion=new ZaloPcCompanion(window as any,save)
 expect(await companion.open()).toEqual({status:'ready',arranged:true})
 expect(save).toHaveBeenCalledTimes(1);expect(window.setBounds).toHaveBeenLastCalledWith({x:1440,y:0,width:480,height:1040})
 await companion.release()
 expect(window.setBounds).toHaveBeenLastCalledWith({x:50,y:60,width:1200,height:800});expect(window.setMinimumSize).toHaveBeenLastCalledWith(1000,600)
 expect(helper.commands.map(c=>c.op)).toEqual(['find','place','release']);expect(helper.kill).not.toHaveBeenCalled()
})
windowsTest('switching workspace while finding Zalo prevents launch and arrangement',async()=>{
 state.holdFind=true;const helper=new FakeHelper();state.spawn.mockReturnValue(helper);const window=windowMock(),companion=new ZaloPcCompanion(window as any,vi.fn())
 const pending=companion.open();expect(companion.open()).toBe(pending)
 await companion.release();expect(await pending).toEqual({status:'cancelled',arranged:false})
 expect(state.spawn).toHaveBeenCalledTimes(1);expect(window.setBounds).not.toHaveBeenCalled();expect(helper.commands.some(c=>c.op==='place')).toBe(false)
})
windowsTest('small screens and native placement failures leave LinguaHub geometry unchanged',async()=>{
 for(const small of [true,false]){
  state.area.width=small?1024:1920;state.place=false
  const helper=new FakeHelper();state.spawn.mockReturnValue(helper);const window=windowMock(),companion=new ZaloPcCompanion(window as any,vi.fn())
  expect(await companion.open()).toEqual({status:'opened',arranged:false});expect(window.setBounds).not.toHaveBeenCalled();expect(companion.active).toBe(false)
  await companion.release()
 }
})
