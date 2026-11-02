import { afterEach, expect, test, vi } from 'vitest'
import { reasoningEffortForTask, runLocalAi } from './ai'
afterEach(()=>vi.unstubAllGlobals())
test('translation reasoning is configurable without changing other tasks',()=>{
  expect(reasoningEffortForTask('translateMessages','max','low',false)).toBe('low')
  expect(reasoningEffortForTask('translateLatest','max','low',false)).toBe('low')
  expect(reasoningEffortForTask('translate','max','high',false)).toBe('high')
  expect(reasoningEffortForTask('translateMessages','max','high',true)).toBe('low')
  expect(reasoningEffortForTask('reply','max','low',true)).toBe('max')
  expect(reasoningEffortForTask('summary','high','low',true)).toBe('high')
})
test('coach requires pronunciation guidance and learning explanations',async()=>{
  const complete={meaning:'Vui lòng kiểm tra',grammar:'Câu yêu cầu',ipa:'/pliːz/',pronunciationHint:'Gợi ý tham khảo',stress:'Nhấn vào review',alternatives:['Could you review this?'],commonMistakes:['Không bỏ động từ chính'],vocabulary:[{term:'review',meaning:'Kiểm tra'}]}
  await expect(runLocalAi('coach','Please review this.','test',async()=>JSON.stringify(complete))).resolves.toMatchObject({stress:'Nhấn vào review'})
  await expect(runLocalAi('coach','Please review this.','test',async()=>JSON.stringify({meaning:'Thiếu giải thích'}))).rejects.toThrow()
})
test('communication warnings reject invented evidence',async()=>{
  const responder=async()=>JSON.stringify({risks:[{level:'high',text:'Cam kết',evidence:'I guarantee delivery',suggestion:'Kiểm tra lại'}]})
  await expect(runLocalAi('risks','Could you review this?','test',responder)).rejects.toThrow('Dẫn chứng')
})
test('rejects invented source evidence in conversation analysis',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({message:{content:JSON.stringify({summary:'Tóm tắt',actions:[{text:'Gửi báo cáo',evidence:'I promise to send it tomorrow',deadline:null}],decisions:[],questions:[]})}})}))
  await expect(runLocalAi('summary','Please review the report.','local')).rejects.toThrow('dẫn chứng')
})
test('accepts grounded follow-up suggestions and rejects invented evidence',async()=>{
  const response={summary:'Cần xác nhận thời gian họp.',actions:[],decisions:[],questions:[{text:'Chưa có câu trả lời về thời gian họp.',evidence:'Could you confirm the meeting time?'}],followUps:[{text:'Hỏi lại thời gian họp nếu chưa nhận được phản hồi.',evidence:'Could you confirm the meeting time?'}]}
  await expect(runLocalAi('summary','Could you confirm the meeting time?','test',async()=>JSON.stringify(response))).resolves.toMatchObject({followUps:response.followUps})
  await expect(runLocalAi('summary','Could you confirm the meeting time?','test',async()=>JSON.stringify({...response,followUps:[{text:'Nhắc hạn đã chốt.',evidence:'The report is due Friday.'}]}))).rejects.toThrow('dẫn chứng')
})
test('rejects oversized content before any request', async()=>{
  const fetch = vi.fn(); vi.stubGlobal('fetch',fetch)
  await expect(runLocalAi('translate','a'.repeat(12001),'local')).rejects.toThrow()
  expect(fetch).not.toHaveBeenCalled()
})
test('rejects malformed translation instead of presenting it as valid',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({message:{content:'{"translation":12}'}})}))
  await expect(runLocalAi('translate','Hello','local')).rejects.toThrow()
})
test('only sends text to the fixed local endpoint',async()=>{
  const fetch = vi.fn().mockResolvedValue(new Response('{"message":{"content":"{\\"translation\\":\\"Xin chào\\",\\"explanation\\":\\"Lời chào\\"}"},"done":true}\n'))
  vi.stubGlobal('fetch',fetch)
  await expect(runLocalAi('translate','Hello','local')).resolves.toMatchObject({translation:'Xin chào'})
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat')
})
test('translates a batch using exactly the requested message ids',async()=>{
  const input=JSON.stringify({messages:[{id:'m0',text:'Please send the report.'},{id:'m1',text:'I will review it.'}]})
  const result=await runLocalAi('translateMessages',input,'local',async()=>JSON.stringify({translations:[{id:'m1',translation:'Tôi sẽ xem lại.',explanation:''},{id:'m0',translation:'Vui lòng gửi báo cáo.',explanation:''}]})) as {translations:Array<{id:string;translation:string}>}
  expect(result.translations).toHaveLength(2)
  expect(result.translations.find(message=>message.id==='m0')?.translation).toBe('Vui lòng gửi báo cáo.')
})
test('automatic translation prompts are concise and include only matching ERP terms',async()=>{
  const input=JSON.stringify({messages:[{id:'m0',text:'Please confirm the purchase order.'}]})
  let instructions=''
  await runLocalAi('translateMessages',input,'local',async(_model,_input,prompt)=>{instructions=prompt;return JSON.stringify({translations:[{id:'m0',translation:'Vui lòng xác nhận đơn mua hàng.'}]})})
  expect(instructions).toContain('purchase order: đơn mua hàng')
  expect(instructions).not.toContain('financial dimensions:')
  expect(instructions).not.toContain('explanation')
  expect(instructions.length).toBeLessThan(900)
})
test('streams the newest message as plain Vietnamese without an explanation',async()=>{
  const deltas:string[]=[]
  let providerInput=''
  let instructions=''
  const result=await runLocalAi('translateLatest',JSON.stringify({text:'Please confirm the purchase order.'}),'local',async(_model,input,prompt,_signal,_timing,onText)=>{
    providerInput=input
    instructions=prompt
    onText?.('Vui lòng xác nhận ')
    onText?.('đơn mua hàng.')
    return 'Vui lòng xác nhận đơn mua hàng.'
  },undefined,undefined,delta=>deltas.push(delta)) as {translation:string;explanation:string}
  expect(providerInput).toBe('Please confirm the purchase order.')
  expect(instructions).toContain('purchase order: đơn mua hàng')
  expect(instructions).toContain('Output only the Vietnamese translation')
  expect(instructions).not.toContain('explanation')
  expect(deltas).toEqual(['Vui lòng xác nhận ','đơn mua hàng.'])
  expect(result).toEqual({translation:'Vui lòng xác nhận đơn mua hàng.',explanation:''})
})
test('streams local Ollama output for the latest message without JSON mode',async()=>{
  const deltas:string[]=[]
  const fetch=vi.fn().mockResolvedValue(new Response('{"message":{"content":"Xin "},"done":false}\n{"message":{"content":"chào."},"done":true}\n'))
  vi.stubGlobal('fetch',fetch)
  const result=await runLocalAi('translateLatest',JSON.stringify({text:'Good morning.'}),'local',undefined,undefined,undefined,delta=>deltas.push(delta)) as {translation:string}
  expect(result.translation).toBe('Xin chào.')
  expect(deltas).toEqual(['Xin ','chào.'])
  const body=JSON.parse(String(fetch.mock.calls[0][1]?.body))
  expect(body).toMatchObject({stream:true})
  expect(body).not.toHaveProperty('format')
})
test('marks non-English visible chat messages for the renderer to skip',async()=>{
  const input=JSON.stringify({messages:[{id:'m0',text:'Please send the report.'},{id:'m1',text:'Vui lòng gửi báo cáo.'}]})
  const result=await runLocalAi('translateMessages',input,'local',async()=>JSON.stringify({translations:[{id:'m0',translation:'Vui lòng gửi báo cáo.',explanation:'Câu yêu cầu lịch sự.'},{id:'m1',translation:'',explanation:''}]})) as {translations:Array<{id:string;translation:string}>}
  expect(result.translations.find(message=>message.id==='m1')?.translation).toBe('')
})
test('rejects missing, duplicate, and invented ids from batched translation',async()=>{
  const input=JSON.stringify({messages:[{id:'m0',text:'Hello there.'},{id:'m1',text:'Thank you.'}]})
  await expect(runLocalAi('translateMessages',input,'local',async()=>JSON.stringify({translations:[{id:'m0',translation:'Xin chào.',explanation:''}]}))).rejects.toThrow('đúng mã')
  await expect(runLocalAi('translateMessages',input,'local',async()=>JSON.stringify({translations:[{id:'m0',translation:'Xin chào.',explanation:''},{id:'m0',translation:'Cảm ơn.',explanation:''}]}))).rejects.toThrow('đúng mã')
  await expect(runLocalAi('translateMessages',JSON.stringify({messages:[{id:'m0',text:'Hello.'},{id:'m0',text:'Again.'}]}),'local',async()=>'' )).rejects.toThrow('trùng')
})
test('passes capture cancellation through to the AI provider',async()=>{
  const controller=new AbortController()
  const pending=runLocalAi('translate','Hello','local',async(_model,_input,_instructions,signal)=>new Promise<string>((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(signal.reason),{once:true})),controller.signal)
  controller.abort(new DOMException('Capture changed','AbortError'))
  await expect(pending).rejects.toThrow('Capture changed')
})

test('reply copilot requires all three distinct styles with explanations',async()=>{
  const valid={replies:[
    {style:'friendly',english:'Thanks for the update!',vietnamese:'Cảm ơn anh đã cập nhật!',explanation:'Thân thiện, ngắn gọn.'},
    {style:'professional',english:'Thank you for the update.',vietnamese:'Cảm ơn anh đã cập nhật.',explanation:'Lịch sự và phù hợp công việc.'},
    {style:'simple',english:'Thanks for letting me know.',vietnamese:'Cảm ơn anh đã cho tôi biết.',explanation:'Tự nhiên, đơn giản.'},
  ]}
  const result=await runLocalAi('reply','Cảm ơn anh đã cập nhật cho em.','local',async()=>JSON.stringify(valid)) as typeof valid
  expect(result.replies).toHaveLength(3)
  await expect(runLocalAi('reply','Cảm ơn anh.','local',async()=>JSON.stringify({...valid,replies:[valid.replies[0],valid.replies[1],valid.replies[1]]}))).rejects.toThrow()
  await expect(runLocalAi('reply','Cảm ơn anh.','local',async()=>JSON.stringify({...valid,replies:valid.replies.map(({explanation,...reply})=>reply)}))).rejects.toThrow()
})

test('chat reply copilot accepts visible conversation context and an optional intent',async()=>{
  const valid={replies:[
    {style:'simple',english:'Yes, that is the form I meant. Thank you!',vietnamese:'Đúng rồi, đó là biểu mẫu tôi muốn nói đến. Cảm ơn bạn!',explanation:'Xác nhận trực tiếp và lịch sự.'},
    {style:'professional',english:'Yes, this is the form I was referring to. Thank you for checking.',vietnamese:'Đúng vậy, đây là biểu mẫu tôi đang nhắc đến. Cảm ơn bạn đã kiểm tra.',explanation:'Lịch sự, rõ ràng trong môi trường công việc.'},
    {style:'friendly',english:'Yes, that’s the one! Thanks for checking.',vietnamese:'Đúng rồi, chính là biểu mẫu đó! Cảm ơn bạn đã kiểm tra nhé.',explanation:'Thân thiện và tự nhiên.'},
  ]}
  const input=JSON.stringify({messages:[{side:'left',text:'Is this the form you mean?'}],intent:'Xác nhận đúng rồi'})
  let instructions=''
  await expect(runLocalAi('replyFromChat',input,'local',async(_model,_input,prompt)=>{instructions=prompt;return JSON.stringify(valid)})).resolves.toMatchObject({replies:valid.replies})
  expect(instructions).toContain('most recent visible chat context')
  await expect(runLocalAi('replyFromChat',JSON.stringify({messages:[]}), 'local',async()=>JSON.stringify(valid))).rejects.toThrow()
})
