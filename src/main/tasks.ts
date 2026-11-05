import {readFile,writeFile,rename,mkdir,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {z} from 'zod'
export const taskSourceServices=['whatsapp','teams','zalo','outlook'] as const
export type TaskSourceService=typeof taskSourceServices[number]
export type TaskCaptureSuggestion={title:string;description:string;assignee:string;dueDate:string;priority:'low'|'normal'|'high';evidence:string}
export type TaskCaptureResult={source:{service:TaskSourceService;label:string};tasks:TaskCaptureSuggestion[]}
const fields=z.object({title:z.string().trim().min(1).max(200),description:z.string().max(10000),status:z.enum(['todo','doing','done']),priority:z.enum(['low','normal','high']),assignee:z.string().max(200),dueDate:z.string().refine(v=>v===''||/^\d{4}-\d{2}-\d{2}$/.test(v)),notes:z.string().max(10000),sourceService:z.enum(taskSourceServices).optional(),sourceLabel:z.string().max(200).optional(),sourceEvidence:z.string().max(1000).optional()})
const task=fields.extend({id:z.string().uuid(),createdAt:z.number(),updatedAt:z.number()})
export type WorkTask=z.infer<typeof task>
export function createTaskStore(directory:string){
 const filename=join(directory,'linguahub-tasks.json');let queue=Promise.resolve()
 const read=async()=>{try{return z.array(task).max(5000).parse(JSON.parse(await readFile(filename,'utf8')))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw new Error('Không đọc được dữ liệu công việc. File gốc được giữ nguyên.')}}
 return {list:read,save(input:unknown){const next=queue.then(async()=>{const data=fields.extend({id:z.string().uuid().optional()}).strict().parse(input);const rows=await read();const index=data.id?rows.findIndex(row=>row.id===data.id):-1;if(data.id&&index<0)throw new Error('Công việc không còn tồn tại.');const now=Date.now();const value=task.parse({...data,id:data.id||randomUUID(),createdAt:index>=0?rows[index].createdAt:now,updatedAt:now});if(index>=0)rows[index]=value;else{if(rows.length>=5000)throw new Error('Đạt giới hạn 5000 công việc.');rows.push(value)}await mkdir(directory,{recursive:true});const temp=filename+'.tmp';await writeFile(temp,JSON.stringify(rows,null,2),'utf8');await rename(temp,filename);return value});queue=next.then(()=>{},()=>{});return next},clear(){const next=queue.then(async()=>{for(const path of [filename,filename+'.tmp'])await unlink(path).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error})});queue=next.then(()=>{},()=>{});return next}}
}
