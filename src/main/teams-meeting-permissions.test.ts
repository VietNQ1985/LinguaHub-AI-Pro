import { expect,test } from 'vitest'
import { installTeamsMeetingPermissions,teamsDeviceRequest,trustedTeamsOrigin } from './teams-meeting-permissions'
import { vi } from 'vitest'
const {ask,sources}=vi.hoisted(()=>({ask:vi.fn(),sources:vi.fn()}))
vi.mock('electron',()=>({desktopCapturer:{getSources:sources},dialog:{showMessageBox:ask}}))
test('Teams device policy permits audio/video combinations only in owned trusted frames',()=>{
 for(const types of [['audio'],['video'],['audio','video']])expect(teamsDeviceRequest('https://teams.microsoft.com/v2','https://calling.teams.microsoft.com',true,types)).toBe(true)
 expect(teamsDeviceRequest('https://teams.microsoft.com','https://evil.test',true,['audio'])).toBe(false)
 expect(teamsDeviceRequest('https://evil.test','https://teams.microsoft.com',true,['audio'])).toBe(false)
 expect(teamsDeviceRequest('https://teams.microsoft.com','https://teams.microsoft.com',false,['audio'])).toBe(false)
 expect(teamsDeviceRequest('https://teams.microsoft.com','https://teams.microsoft.com',true,[])).toBe(false)
 expect(trustedTeamsOrigin('https://teams.microsoft.com.evil.test')).toBe(false)
})

test('permission handlers ask explicitly, keep grants scoped and deny foreign contents',async()=>{
 let check:any,request:any,display:any,navigation:any
 const contents:any={isDestroyed:()=>false,getURL:()=> 'https://teams.microsoft.com/v2',mainFrame:{},on:(_name:string,callback:any)=>{navigation=callback},session:{setPermissionCheckHandler:(fn:any)=>{check=fn},setPermissionRequestHandler:(fn:any)=>{request=fn},setDisplayMediaRequestHandler:(fn:any)=>{display=fn}}}
 installTeamsMeetingPermissions(contents,{} as any,()=>true,async()=>true)
 const origin='https://calling.teams.microsoft.com'
 expect(check(contents,'media',origin,{mediaType:'audio'})).toBe(false)
 ask.mockResolvedValueOnce({response:0})
 const invoke=(sender:any,permission:string,details:any)=>new Promise(resolve=>request(sender,permission,resolve,details))
 expect(await invoke(contents,'media',{securityOrigin:origin,mediaTypes:['audio','video']})).toBe(false)
 ask.mockResolvedValueOnce({response:1})
 expect(await invoke(contents,'media',{securityOrigin:origin,mediaTypes:['audio','video']})).toBe(true)
 expect(check(contents,'media',origin,{mediaType:'audio'})).toBe(true)
 expect(check(contents,'media',origin,{mediaType:'video'})).toBe(true)
 expect(await invoke({},'media',{securityOrigin:origin,mediaTypes:['audio']})).toBe(false)
 expect(await invoke(contents,'media',{securityOrigin:'https://evil.test',mediaTypes:['audio']})).toBe(false)
 expect(check(contents,'geolocation',origin,{})).toBe(false)
 navigation({},'',false,true);expect(check(contents,'media',origin,{mediaType:'audio'})).toBe(false)
 sources.mockResolvedValue([{id:'screen:1',name:'Screen'}]);ask.mockResolvedValueOnce({response:1})
 const shared:any=await new Promise(resolve=>display({frame:{top:contents.mainFrame,url:origin},securityOrigin:origin,userGesture:true,videoRequested:true,audioRequested:true},resolve))
 expect(shared.video.id).toBe('screen:1');expect(shared.audio).toBeUndefined()
 expect(await new Promise(resolve=>display({frame:null,securityOrigin:origin,userGesture:true,videoRequested:true},resolve))).toBe(null)
})
