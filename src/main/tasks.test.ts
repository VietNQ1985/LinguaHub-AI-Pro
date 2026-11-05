import {test,expect} from 'vitest'
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createTaskStore} from './tasks'
test('independent tasks persist Vietnamese fields and concurrent updates',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'linguahub-tasks-'))
 try{const store=createTaskStore(dir);const input={title:'Kiểm tra đơn hàng',description:'Đối chiếu số liệu',status:'todo',priority:'high',assignee:'Quốc Việt',dueDate:'2026-11-10',notes:''};const [a,b]=await Promise.all([store.save(input),store.save({...input,title:'Báo cáo'})]);expect((await createTaskStore(dir).list()).length).toBe(2);await store.save({...input,id:a.id,status:'done'});expect((await store.list()).find(t=>t.id===a.id)?.status).toBe('done');expect((await store.list()).find(t=>t.id===b.id)?.title).toBe('Báo cáo');await expect(store.save({...input,title:''})).rejects.toThrow();expect((await store.list()).length).toBe(2)}finally{await unlink(join(dir,'linguahub-tasks.json'));await rmdir(dir)}
})
