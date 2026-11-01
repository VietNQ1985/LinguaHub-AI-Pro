export async function readCompletedResponse(response: Response): Promise<string> {
  if(!response.ok || !response.body)throw new Error(`OpenAI không chấp nhận yêu cầu (${response.status}). Không chuyển sang API trả phí.`)
  const reader=response.body.getReader(), decoder=new TextDecoder()
  let buffer='',text='',completed=false
  try {
    while(true){
      const chunk=await reader.read()
      buffer+=decoder.decode(chunk.value,{stream:!chunk.done})
      if(buffer.length>2000000 || text.length>1000000)throw new Error('Kết quả AI vượt giới hạn an toàn.')
      let end:number
      while((end=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,end).trimEnd();buffer=buffer.slice(end+1)
        if(!line.startsWith('data:'))continue
        const data=line.slice(5).trim();if(!data || data==='[DONE]')continue
        const event=JSON.parse(data)
        if(event.type==='response.output_text.delta'){
          if(typeof event.delta!=='string')throw new Error('Dữ liệu streaming không hợp lệ.')
          text+=event.delta
        }
        if(event.type==='response.completed')completed=true
        if(['response.failed','response.incomplete','error'].includes(event.type)){
          const rawCode=event.response?.error?.code ?? event.error?.code ?? event.code
          const code=typeof rawCode==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(rawCode)?rawCode:null
          if(code==='subscription_sharing_usage_limit_exceeded')throw new Error('Đã chạm hạn mức ChatGPT dùng chung giữa các ứng dụng. Anh có thể chờ hạn mức làm mới hoặc chọn Ollama.')
          if(code==='subscription_sharing_usage_unavailable')throw new Error('Tài khoản hiện chưa được cấp quyền inference ChatGPT cho ứng dụng này. Kiểm tra quyền/điều kiện SIWC trong tài khoản.')
          throw new Error(`OpenAI chưa hoàn tất kết quả${code?` (${code})`:''}. Kiểm tra quyền và hạn mức gói ChatGPT.`)
        }
      }
      if(chunk.done)break
    }
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock()}
  if(!completed)throw new Error('Luồng AI bị ngắt trước khi hoàn tất.')
  return text
}
