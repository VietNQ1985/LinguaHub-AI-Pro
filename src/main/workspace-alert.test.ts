import {expect,test,vi} from 'vitest'
import {EventEmitter} from 'node:events'
const data=vi.hoisted(()=>({created:[] as any[]}))
vi.mock('electron',()=>({Notification:class extends EventEmitter{show=vi.fn();constructor(public options:unknown){super();data.created.push(this)}}}))
import {showWorkspaceAlert} from './workspace-alert'
test('each toast keeps its originating workspace even after another service notifies',()=>{
 const activate=vi.fn()
 const whatsapp=showWorkspaceAlert('whatsapp',1,activate),zalo=showWorkspaceAlert('zalo',2,activate),teams=showWorkspaceAlert('teams',3,activate)
 expect(data.created.map(n=>n.options.title)).toEqual(['WhatsApp','Zalo Web','Microsoft Teams'])
 for(const toast of data.created)expect(toast.show).toHaveBeenCalledTimes(1)
 ;(zalo as any).emit('click');(whatsapp as any).emit('click');(teams as any).emit('click')
 expect(activate.mock.calls).toEqual([['zalo'],['whatsapp'],['teams']])
})
