import { safeStorage, shell } from 'electron'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { z } from 'zod'
import { createAuthorization, validateCallback, TOKEN_ENDPOINT, RESOURCE } from './protocol'
import { readCompletedResponse } from './responses'
import { readIssuedClientId, saveIssuedClientId } from './registration'
import { createRefreshRequest, mergeRefreshedToken } from './token-refresh'

const recordSchema = z.object({clientId:z.string(),subject:z.string(),email:z.string(),accessToken:z.string(),refreshToken:z.string().optional(),idToken:z.string(),expiresAt:z.number(),scopes:z.array(z.string())})
type RecordData = z.infer<typeof recordSchema>
export class ChatGPTConnection {
  private record: RecordData | null = null
  private registeredClientId: string | null = null
  private connecting = false
  private sessionVersion = 0
  private refreshPromise: Promise<string> | null = null
  private refreshController: AbortController | null = null
  constructor(private directory: string, private request: typeof fetch = fetch) {}
  private async save(record: RecordData) {
    if(!await safeStorage.isAsyncEncryptionAvailable())throw new Error('Windows chưa cung cấp mã hóa an toàn.')
    const data=await safeStorage.encryptStringAsync(JSON.stringify(record))
    const path=join(this.directory,'chatgpt.enc')
    await writeFile(`${path}.tmp`,data);await rename(`${path}.tmp`,path)
    this.record=record
  }
  async initialize() {
    this.registeredClientId = await readIssuedClientId(this.directory)
    try {
      const data=await readFile(join(this.directory,'chatgpt.enc'))
      const decoded=await safeStorage.decryptStringAsync(data)
      this.record=recordSchema.parse(JSON.parse(decoded.result))
      if(this.registeredClientId && this.registeredClientId!==this.record.clientId)throw new Error('Mã đăng ký không khớp tài khoản đã mã hóa.')
      this.registeredClientId=this.record.clientId
      if(decoded.shouldReEncrypt)await this.save(this.record)
      await saveIssuedClientId(this.directory, this.record.clientId)
    } catch(error) {
      if((error as NodeJS.ErrnoException).code !== 'ENOENT')throw new Error('Không đọc được kết nối ChatGPT đã mã hóa. Dữ liệu gốc được giữ nguyên.')
    }
  }
  status(){return {connected:!!this.record,email:this.record?.email || null,usageEnabled:this.record?.scopes.includes('chatgpt.tokens.use.direct') || false}}
  async disconnect(){
    if(this.connecting)throw new Error('Anh chờ phiên đăng nhập kết thúc trước khi ngắt kết nối.')
    const record=this.record
    this.record=null
    this.sessionVersion++
    this.refreshController?.abort(new DOMException('Đã ngắt kết nối ChatGPT.','AbortError'))
    let revoked=false
    if(record?.refreshToken){
      for(let attempt=0;attempt<3;attempt++){
        try {
          const response=await this.request('https://auth.openai.com/.well-known/openid-configuration',{signal:AbortSignal.timeout(10000)})
          if(!response.ok){if(response.status<500)break;throw new Error(`OpenID discovery failed (${response.status})`)}
          const metadata=z.object({revocation_endpoint:z.string().url()}).parse(await response.json())
          if(new URL(metadata.revocation_endpoint).origin!=='https://auth.openai.com')throw new Error('Invalid revocation endpoint')
          const result=await this.request(metadata.revocation_endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:record.refreshToken,token_type_hint:'refresh_token',client_id:record.clientId}),signal:AbortSignal.timeout(10000)})
          if(result.ok){revoked=true;break}
          if(result.status<500)break
          throw new Error(`Revocation failed (${result.status})`)
        } catch {
          if(attempt===2)break
        }
        await new Promise(resolve=>setTimeout(resolve,300*(2**attempt)))
      }
    }
    this.refreshPromise=null
    this.refreshController=null
    await unlink(join(this.directory,'chatgpt.enc')).catch(error=>{if(error.code!=='ENOENT')throw error})
    return {revoked}
  }
  async clearLocalData(){
    const result=await this.disconnect()
    this.registeredClientId=null
    for(const filename of ['chatgpt-registration.json','chatgpt-host.txt']){
      await unlink(join(this.directory,filename)).catch(error=>{if(error.code!=='ENOENT')throw error})
    }
    return result
  }
  private accessToken():Promise<string>{
    if(!this.record?.scopes.includes('chatgpt.tokens.use.direct'))throw new Error('Anh chưa cấp quyền dùng gói ChatGPT.')
    const current=this.record
    if(current.expiresAt>Date.now()+60000)return Promise.resolve(current.accessToken)
    if(!current.refreshToken)throw new Error('Phiên ChatGPT hết hạn. Anh cần đăng nhập lại.')
    if(!this.refreshPromise){
      const sessionVersion=this.sessionVersion
      const controller=new AbortController()
      this.refreshController=controller
      this.refreshPromise=(async()=>{
        const body=createRefreshRequest(current)
        const response=await this.request(TOKEN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
        if(!response.ok){
          const detail=await response.text().catch(()=> '')
          if(response.status===400||response.status===401)throw new Error('Phiên ChatGPT hết hạn hoặc bị thu hồi. Anh đăng nhập lại để tiếp tục.')
          throw new Error(`OpenAI chưa làm mới được phiên ChatGPT (${response.status}). ${detail.slice(0,200)}`)
        }
        let next=mergeRefreshedToken(await response.json(),current)
        if(next.idToken!==current.idToken){
          const metadataResponse=await this.request('https://auth.openai.com/.well-known/openid-configuration',{signal:AbortSignal.timeout(15000)})
          if(!metadataResponse.ok)throw new Error('Không xác minh được danh tính khi làm mới phiên ChatGPT.')
          const metadata=z.object({jwks_uri:z.string().url()}).parse(await metadataResponse.json())
          if(new URL(metadata.jwks_uri).origin!=='https://auth.openai.com')throw new Error('Không chấp nhận nguồn khóa xác thực.')
          const {payload}=await jwtVerify(next.idToken,createRemoteJWKSet(new URL(metadata.jwks_uri)),{issuer:'https://auth.openai.com',audience:current.clientId})
          if(payload.sub!==current.subject)throw new Error('Danh tính ChatGPT không khớp khi làm mới phiên.')
          if(typeof payload.email==='string')next={...next,email:payload.email}
        }
        if(!next.scopes.includes('chatgpt.tokens.use.direct'))throw new Error('Quyền dùng gói ChatGPT không còn hiệu lực. Anh đăng nhập lại để cấp quyền.')
        if(sessionVersion!==this.sessionVersion||this.record!==current)throw new Error('Phiên ChatGPT đã thay đổi trong khi làm mới token.')
        await this.save(next)
        return next.accessToken
      })().finally(()=>{this.refreshPromise=null;this.refreshController=null})
    }
    return this.refreshPromise
  }
  async listModels(){
    const response=await this.request(`${RESOURCE}/models`,{headers:{Authorization:`Bearer ${await this.accessToken()}`},signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw new Error(`Không lấy được model ChatGPT (${response.status}).`)
    const data=z.object({models:z.array(z.object({slug:z.string(),display_name:z.string(),visibility:z.string()}))}).parse(await response.json())
    return data.models.filter(model=>model.visibility==='list').map(model=>({slug:model.slug,name:model.display_name}))
  }
  async respond(model:string,input:string,instructions:string,signal?:AbortSignal){
    const requestSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)
    return readCompletedResponse(await this.request(`${RESOURCE}/responses`,{method:'POST',headers:{Authorization:`Bearer ${await this.accessToken()}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'user',content:input}],instructions,store:false,stream:true}),signal:requestSignal}))
  }
  async connect(newRegistration = false) {
    if(this.connecting)throw new Error('Đang có phiên đăng nhập chờ hoàn tất.')
    this.connecting=true
    const server=createServer()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      if(!await safeStorage.isAsyncEncryptionAvailable())throw new Error('Không có mã hóa an toàn cho token.')
      let host:string
      const hostPath=join(this.directory,'chatgpt-host.txt')
      try{host=await readFile(hostPath,'utf8')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;host=`urn:uuid:${randomUUID()}`;await writeFile(hostPath,host,{flag:'wx'})}
      await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
      const address=server.address();if(!address || typeof address==='string')throw new Error('Không mở được callback cục bộ.')
      const previousRecord=this.record
      // A new workspace or ChatGPT account needs a new dynamic registration;
      // an issued client ID is bound to its original account/workspace.
      const clientId=newRegistration?undefined:(this.registeredClientId || previousRecord?.clientId || undefined)
      const useSavedAccount=clientId!==undefined && clientId===previousRecord?.clientId
      const pending=createAuthorization(host,`http://127.0.0.1:${address.port}/auth/callback`,clientId,{idTokenHint:useSavedAccount?previousRecord.idToken:undefined,loginHint:useSavedAccount?previousRecord.email:undefined})
      const callback=new Promise<{clientId:string;code:string}>((resolve,reject)=>{
        timeout=setTimeout(()=>reject(new Error('Đăng nhập hết thời gian chờ.')),300000)
        server.on('request',(request,response)=>{
          if(request.method!=='GET' || request.headers.host!==`127.0.0.1:${address.port}`){response.writeHead(400).end();return}
          try{const url=new URL(request.url || '',pending.redirectUri);if(url.pathname!=='/auth/callback'){response.writeHead(404).end();return}const result=validateCallback(url,pending);response.setHeader('Content-Type','text/plain; charset=utf-8');response.end('Đã nhận kết quả. Anh quay lại LinguaHub.');resolve(result)}catch{response.writeHead(400).end('Invalid callback')}
        })
      })
      await shell.openExternal(pending.url)
      const result=await callback
      // Preserve the previous registration until a new workspace has been validated.
      // The ordinary returning sign-in flow still saves the issued ID early for invalid_grant recovery.
      if(!newRegistration)this.registeredClientId=await saveIssuedClientId(this.directory,result.clientId)
      const response=await this.request(TOKEN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:result.clientId,code:result.code,code_verifier:pending.verifier,redirect_uri:pending.redirectUri,resource:RESOURCE}),signal:AbortSignal.timeout(30000)})
      if(!response.ok)throw new Error(`OpenAI chưa hoàn tất trao đổi quyền (${response.status}).`)
      const token=z.object({id_token:z.string(),access_token:z.string(),refresh_token:z.string().optional(),expires_in:z.number(),scope:z.string()}).parse(await response.json())
      const metadataResponse=await this.request('https://auth.openai.com/.well-known/openid-configuration',{signal:AbortSignal.timeout(15000)})
      const metadata=z.object({jwks_uri:z.string().url()}).parse(await metadataResponse.json())
      if(new URL(metadata.jwks_uri).origin!=='https://auth.openai.com')throw new Error('Không chấp nhận nguồn khóa xác thực.')
      const {payload}=await jwtVerify(token.id_token,createRemoteJWKSet(new URL(metadata.jwks_uri)),{issuer:'https://auth.openai.com',audience:result.clientId})
      if(payload.nonce!==pending.nonce || !payload.sub || (!newRegistration && this.record && payload.sub!==this.record.subject))throw new Error('Danh tính đăng nhập không khớp.')
      if(!token.scope.split(/\s+/).includes('chatgpt.tokens.use.direct'))throw new Error('Đăng nhập xong nhưng tài khoản chưa cấp quyền dùng gói ChatGPT.')
      this.sessionVersion++
      await this.save({clientId:result.clientId,subject:payload.sub,email:typeof payload.email==='string'?payload.email:'',accessToken:token.access_token,refreshToken:token.refresh_token,idToken:token.id_token,expiresAt:Date.now()+token.expires_in*1000,scopes:token.scope.split(/\s+/).filter(Boolean)})
      // Only replace the saved registration after successful account/workspace authorization.
      if(newRegistration)this.registeredClientId=await saveIssuedClientId(this.directory,result.clientId)
      return this.status()
    } finally {if(timeout)clearTimeout(timeout);server.close();this.connecting=false}
  }
}
