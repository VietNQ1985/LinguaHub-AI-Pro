import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { safeStorage, openExternal } = vi.hoisted(()=>({safeStorage:{
  isAsyncEncryptionAvailable:vi.fn(async()=>true),
  decryptStringAsync:vi.fn(async(data:Buffer)=>({result:data.toString('utf8'),shouldReEncrypt:false})),
  encryptStringAsync:vi.fn(async(value:string)=>Buffer.from(value,'utf8')),
},openExternal:vi.fn(async(_url:string)=>{})}))
vi.mock('electron',()=>({safeStorage,shell:{openExternal}}))

import { ChatGPTConnection } from './connection'
import { TOKEN_ENDPOINT } from './protocol'

const record={
  clientId:'oaiapp_issued',subject:'subject-1',email:'user@example.com',accessToken:'old-access',
  refreshToken:'old-refresh',idToken:'old-id',expiresAt:Date.now()-1000,scopes:['openid','chatgpt.tokens.use.direct'],
}
let directory=''

beforeEach(async()=>{
  directory=await mkdtemp(join(tmpdir(),'linguahub-connection-'))
  await writeFile(join(directory,'chatgpt.enc'),Buffer.from(JSON.stringify(record)))
})
afterEach(async()=>{await rm(directory,{recursive:true,force:true});vi.clearAllMocks();openExternal.mockReset()})

test('refreshes an expired access token, stores rotated credentials, then lists models',async()=>{
  const request=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input)===TOKEN_ENDPOINT)return new Response(JSON.stringify({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,scope:'openid chatgpt.tokens.use.direct'}),{status:200})
    if(String(input)==='https://api.openai.com/v1/models')return new Response(JSON.stringify({models:[{slug:'gpt-test',display_name:'Test',visibility:'list'},{slug:'hidden',display_name:'Hidden',visibility:'private'}]}),{status:200})
    throw new Error(`Unexpected request ${String(input)}`)
  })
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  await expect(connection.listModels()).resolves.toEqual([{slug:'gpt-test',name:'Test'}])
  const refresh=request.mock.calls.find(([url])=>String(url)===TOKEN_ENDPOINT)?.[1]
  expect(refresh?.method).toBe('POST')
  expect(new URLSearchParams(String(refresh?.body))).toEqual(new URLSearchParams({grant_type:'refresh_token',client_id:'oaiapp_issued',refresh_token:'old-refresh',resource:'https://api.openai.com/v1'}))
  const stored=JSON.parse((await safeStorage.decryptStringAsync(await readFile(join(directory,'chatgpt.enc')))).result)
  expect(stored).toMatchObject({accessToken:'new-access',refreshToken:'new-refresh',clientId:'oaiapp_issued'})
})

test('sends Responses API input as a user content list',async()=>{
  await writeFile(join(directory,'chatgpt.enc'),Buffer.from(JSON.stringify({...record,expiresAt:Date.now()+3600000})))
  let requestBody:Record<string,unknown>|undefined
  const request=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input)==='https://api.openai.com/v1/models')return new Response(JSON.stringify({models:[{slug:'gpt-test',display_name:'Test',visibility:'list',supported_reasoning_efforts:['low','none']}]}),{status:200})
    if(String(input)==='https://api.openai.com/v1/responses'){
      requestBody=JSON.parse(String(init?.body))
      return new Response('data: {"type":"response.output_text.delta","delta":"Chào buổi sáng."}\n\ndata: {"type":"response.completed"}\n\n',{status:200})
    }
    throw new Error(`Unexpected request ${String(input)}`)
  })
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  await expect(connection.respond('gpt-test','Good morning.','Translate this sentence.',undefined,'low')).resolves.toBe('Chào buổi sáng.')
  expect(requestBody).toMatchObject({model:'gpt-test',input:[{role:'user',content:'Good morning.'}],instructions:'Translate this sentence.',store:false,stream:true})
  expect(requestBody).toHaveProperty('reasoning',{effort:'low'})
})

test('blocks models outside the account list and rejects unadvertised None before inference',async()=>{
  await writeFile(join(directory,'chatgpt.enc'),Buffer.from(JSON.stringify({...record,expiresAt:Date.now()+3600000})))
  const request=vi.fn(async(input:RequestInfo|URL)=>{
    if(String(input)==='https://api.openai.com/v1/models')return new Response(JSON.stringify({models:[{slug:'gpt-listed',display_name:'Listed',visibility:'list',supported_reasoning_efforts:['low']}]}),{status:200})
    if(String(input)==='https://api.openai.com/v1/responses')return new Response('',{status:500})
    throw new Error(`Unexpected request ${String(input)}`)
  })
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  await expect(connection.respond('gpt-unlisted','Hello','Translate',undefined,'low')).rejects.toThrow('không nằm trong danh sách')
  await expect(connection.respond('gpt-listed','Hello','Translate',undefined,'none')).rejects.toThrow('chưa xác nhận')
  expect(request.mock.calls.filter(([url])=>String(url)==='https://api.openai.com/v1/responses')).toHaveLength(0)
})

test('serializes concurrent refreshes so rotating refresh tokens are used once',async()=>{
  let finishRefresh:(response:Response)=>void=()=>{}
  const pendingRefresh=new Promise<Response>(resolve=>{finishRefresh=resolve})
  const request=vi.fn(async(input:RequestInfo|URL)=>{
    if(String(input)===TOKEN_ENDPOINT)return pendingRefresh
    if(String(input)==='https://api.openai.com/v1/models')return new Response(JSON.stringify({models:[]}),{status:200})
    throw new Error(`Unexpected request ${String(input)}`)
  })
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  const pending=Promise.all([connection.listModels(),connection.listModels()])
  await vi.waitFor(()=>expect(request.mock.calls.filter(([url])=>String(url)===TOKEN_ENDPOINT)).toHaveLength(1))
  finishRefresh(new Response(JSON.stringify({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600}),{status:200}))
  await expect(pending).resolves.toEqual([[],[]])
  expect(request.mock.calls.filter(([url])=>String(url)===TOKEN_ENDPOINT)).toHaveLength(1)
})

test('keeps issued registration and encrypted credentials after a rejected refresh',async()=>{
  const connection=new ChatGPTConnection(directory,vi.fn(async()=>new Response(JSON.stringify({error:'invalid_grant'}),{status:400})) as typeof fetch)
  await connection.initialize()
  await expect(connection.listModels()).rejects.toThrow('đăng nhập lại')
  await expect(readFile(join(directory,'chatgpt.enc'))).resolves.toBeDefined()
  await expect(readFile(join(directory,'chatgpt-registration.json'),'utf8')).resolves.toContain('oaiapp_issued')
})

test('persists a newly issued client before code exchange and reuses it after invalid_grant',async()=>{
  const authUrls:URL[]=[]
  let loginCount=0
  openExternal.mockImplementation(async(href:string)=>{
    const authUrl=new URL(href)
    authUrls.push(authUrl)
    loginCount++
    const callback=new URL(authUrl.searchParams.get('redirect_uri')!)
    const params=new URLSearchParams({state:authUrl.searchParams.get('state')!,code:`expired-${loginCount}`})
    if(loginCount===1)params.set('client_id','oaiapp_issued')
    await fetch(`${callback}?${params}`)
  })
  const request=vi.fn(async()=>new Response(JSON.stringify({error:'invalid_grant'}),{status:400}))
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await expect(connection.connect()).rejects.toThrow('400')
  await expect(readFile(join(directory,'chatgpt-registration.json'),'utf8')).resolves.toContain('oaiapp_issued')
  await expect(connection.connect()).rejects.toThrow('400')
  expect(authUrls[0].searchParams.get('client_id')).toBe('dynamic_agent_client')
  expect(authUrls[0].searchParams.get('agent_name_hint')).toBe('LinguaHub AI Pro')
  expect(authUrls[1].searchParams.get('client_id')).toBe('oaiapp_issued')
  expect(authUrls[1].searchParams.has('agent_name_hint')).toBe(false)
})

test('disconnect retries a transient remote revocation failure before clearing local tokens',async()=>{
  let revocations=0
  const request=vi.fn(async(input:RequestInfo|URL)=>{
    if(String(input)==='https://auth.openai.com/.well-known/openid-configuration')return new Response(JSON.stringify({revocation_endpoint:'https://auth.openai.com/api/accounts/oauth/revoke'}),{status:200})
    if(String(input)==='https://auth.openai.com/api/accounts/oauth/revoke'){
      revocations++
      return new Response('',{status:revocations===1?503:200})
    }
    throw new Error(`Unexpected request ${String(input)}`)
  })
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  await expect(connection.disconnect()).resolves.toEqual({revoked:true})
  expect(revocations).toBe(2)
  await expect(readFile(join(directory,'chatgpt.enc'))).rejects.toMatchObject({code:'ENOENT'})
  await expect(readFile(join(directory,'chatgpt-registration.json'),'utf8')).resolves.toContain('oaiapp_issued')
})

test('clearLocalData revokes the session when possible and removes local registration state',async()=>{
  await writeFile(join(directory,'chatgpt-host.txt'),'urn:uuid:host-1')
  const request=vi.fn(async(input:RequestInfo|URL)=>{
    if(String(input)==='https://auth.openai.com/.well-known/openid-configuration')return new Response(JSON.stringify({revocation_endpoint:'https://auth.openai.com/api/accounts/oauth/revoke'}),{status:200})
    if(String(input)==='https://auth.openai.com/api/accounts/oauth/revoke')return new Response('',{status:200})
    throw new Error(`Unexpected request ${String(input)}`)
  })
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  await expect(connection.clearLocalData()).resolves.toEqual({revoked:true})
  expect(connection.status()).toMatchObject({connected:false,usageEnabled:false})
  await expect(readFile(join(directory,'chatgpt.enc'))).rejects.toMatchObject({code:'ENOENT'})
  await expect(readFile(join(directory,'chatgpt-registration.json'))).rejects.toMatchObject({code:'ENOENT'})
  await expect(readFile(join(directory,'chatgpt-host.txt'))).rejects.toMatchObject({code:'ENOENT'})
})

test('clearLocalData reports when remote revocation cannot be confirmed',async()=>{
  await writeFile(join(directory,'chatgpt.enc'),Buffer.from(JSON.stringify({...record,refreshToken:undefined})))
  const request=vi.fn()
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  await expect(connection.clearLocalData()).resolves.toEqual({revoked:false})
  expect(request).not.toHaveBeenCalled()
  await expect(readFile(join(directory,'chatgpt.enc'))).rejects.toMatchObject({code:'ENOENT'})
})


test('fresh workspace registration does not reuse an issued client and preserves the old ChatGPT session on failure',async()=>{
  const authorizeUrls:URL[]=[]
  openExternal.mockImplementation(async(href:string)=>{
    const authorizeUrl=new URL(href)
    authorizeUrls.push(authorizeUrl)
    const callback=new URL(authorizeUrl.searchParams.get('redirect_uri')!)
    const parameters=new URLSearchParams({
      code:'new-registration-code',
      client_id:'oaiapp_different_workspace',
      state:authorizeUrl.searchParams.get('state')!,
    })
    await fetch(callback.toString()+'?'+parameters.toString())
  })
  const request=vi.fn(async()=>new Response(JSON.stringify({error:'invalid_grant'}),{status:400}))
  const connection=new ChatGPTConnection(directory,request as typeof fetch)
  await connection.initialize()
  await expect(connection.connect(true)).rejects.toThrow('400')
  expect(authorizeUrls).toHaveLength(1)
  expect(authorizeUrls[0].searchParams.get('client_id')).toBe('dynamic_agent_client')
  expect(authorizeUrls[0].searchParams.get('agent_name_hint')).toBe('LinguaHub AI Pro')
  expect(authorizeUrls[0].searchParams.has('id_token_hint')).toBe(false)
  expect(authorizeUrls[0].searchParams.has('login_hint')).toBe(false)
  expect(connection.status()).toMatchObject({connected:true,email:'user@example.com',usageEnabled:true})
  const kept=JSON.parse((await readFile(join(directory,'chatgpt.enc'))).toString('utf8'))
  expect(kept.clientId).toBe('oaiapp_issued')
  expect(kept.accessToken).toBe('old-access')
  expect(await readFile(join(directory,'chatgpt-registration.json'),'utf8')).toContain('oaiapp_issued')
})

test('routine reauthorization reuses the saved account and its workspace registration',async()=>{
  let authorizeUrl:URL|undefined
  openExternal.mockImplementation(async(href:string)=>{
    authorizeUrl=new URL(href)
    const callback=new URL(authorizeUrl.searchParams.get('redirect_uri')!)
    const parameters=new URLSearchParams({
      code:'expired-code',
      state:authorizeUrl.searchParams.get('state')!,
    })
    await fetch(callback.toString()+'?'+parameters.toString())
  })
  const connection=new ChatGPTConnection(directory,vi.fn(async()=>new Response('',{status:400})) as typeof fetch)
  await connection.initialize()
  await expect(connection.connect()).rejects.toThrow('400')
  expect(authorizeUrl?.searchParams.get('client_id')).toBe('oaiapp_issued')
  expect(authorizeUrl?.searchParams.get('id_token_hint')).toBe('old-id')
  expect(authorizeUrl?.searchParams.get('login_hint')).toBe('user@example.com')
})
