import { afterEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { runLocalAi } from '../main/ai'
import { buildVisibleChatReadScript } from '../main/chat-dom-reader'
import { observeVisibleChatChanges } from './chat-change-observer'
import { FALLBACK_TRANSLATION_SCAN_MS, IDLESS_MESSAGE_CONFIRMATION_MS, MAX_TRANSLATION_BATCH_MESSAGES, newestFirst, translationCacheScope } from './translation-policy'
import { TranslationCache } from './translation-cache'

type Message = { text: string; id?: string }
type Scenario = { name: string; messages: Message[]; service: 'whatsapp' | 'teams'; switchChat?: boolean; cancelStale?: boolean }
type Timing = { detect:number; confirm:number; queue:number; ai:number; ui:number; total:number; drain:number; requests:number; cancelled:number; scrollRequests:number }

// Worst-case waits reconstructed from the prior implementation's adaptive polling policy.
// Stable web message IDs were not used before the optimization, so every new item needed a second scan.
const oldWorstCase: Record<string,{detect:number;confirm:number}>={
  'Tin nhắn ngắn':{detect:10000,confirm:2200},
  'Tin dài':{detect:10000,confirm:2200},
  'Chat liên tục':{detect:2200,confirm:2200},
  'Chuyển hội thoại':{detect:10000,confirm:2200},
  'Cuộn lên xuống':{detect:10000,confirm:2200},
}

afterEach(()=>vi.unstubAllGlobals())

test('benchmarks visible translation stages against the prior polling policy',async()=>{
  const scenarios:Scenario[]=[
    {name:'Tin nhắn ngắn',service:'whatsapp',messages:[{text:'Please confirm.',id:'wa-short'}]},
    {name:'Tin dài',service:'teams',messages:[{text:'Could you please review the updated proposal and confirm whether the revised dates work for the regional team? '.repeat(22)}]},
    {name:'Chat liên tục',service:'teams',messages:Array.from({length:12},(_,index)=>({text:`Update ${index+1}: please review the latest action item and confirm the owner.`,id:`teams-${index+1}`}))},
    {name:'Chuyển hội thoại',service:'teams',messages:[{text:'Can we move our meeting to Friday?',id:'teams-switch'}],switchChat:true,cancelStale:true},
    {name:'Cuộn lên xuống',service:'whatsapp',messages:[{text:'Please share the latest status.',id:'wa-scroll'}]},
  ]
  const measured: Array<{name:string;timing:Timing}> = []
  for(const scenario of scenarios){
    const samples:Timing[]=[]
    for(let repetition=0;repetition<3;repetition++)samples.push(await benchmarkScenario(scenario))
    measured.push({name:scenario.name,timing:medianTiming(samples)})
  }
  const report=scenarios.map(scenario=>({name:scenario.name,before:oldWorstCase[scenario.name],after:measured.find(item=>item.name===scenario.name)!.timing}))
  console.info('BENCHMARK_LIVE_TRANSLATION '+JSON.stringify(report))
  expect(measured).toHaveLength(5)
  expect(measured.every(item=>item.timing.detect<FALLBACK_TRANSLATION_SCAN_MS)).toBe(true)
  expect(measured.find(item=>item.name==='Tin dài')?.timing.confirm).toBeGreaterThanOrEqual(IDLESS_MESSAGE_CONFIRMATION_MS)
  expect(Number.isFinite(measured.find(item=>item.name==='Chat liên tục')?.timing.queue)).toBe(true)
  expect(measured.find(item=>item.name==='Chat liên tục')?.timing.requests).toBe(3)
  expect(measured.find(item=>item.name==='Chuyển hội thoại')?.timing.cancelled).toBe(1)
  expect(measured.find(item=>item.name==='Cuộn lên xuống')?.timing.scrollRequests).toBe(0)
},30000)

async function benchmarkScenario(scenario:Scenario):Promise<Timing>{
  const messagesHtml=(messages:Message[])=>messages.map((message,index)=>scenario.service==='whatsapp'
    ? `<div data-pre-plain-text="[10:0${index}] Contact:" ${message.id?`data-id="${escapeHtml(message.id)}"`:''}><span class="selectable-text">${escapeHtml(message.text)}</span></div>`
    : `<div data-tid="message" ${message.id?`data-message-id="${escapeHtml(message.id)}"`:''}><span data-tid="messageBodyContent" dir="auto">${escapeHtml(message.text)}</span></div>`).join('')
  const alreadySeen:Message={text:'The earlier visible message is already translated.',id:'wa-seen'}
  const initialMessages=scenario.name==='Cuộn lên xuống'?[alreadySeen]:scenario.messages
  const messageRoot=scenario.service==='whatsapp'
    ? `<div data-testid="conversation-panel-messages" id="messages">${messagesHtml(initialMessages)}</div>`
    : `<div data-tid="chat-pane"><div id="messages">${messagesHtml(initialMessages)}</div></div>`
  const dom=new JSDOM(`<main id="main"><header><span>Chat A</span></header>${messageRoot}</main>`,{runScripts:'outside-only',pretendToBeVisual:true})
  dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:10,top:10,left:0,right:800,bottom:40,width:800,height:30,toJSON(){return this}}}
  vi.stubGlobal('document',dom.window.document)
  vi.stubGlobal('window',dom.window)
  vi.stubGlobal('Node',dom.window.Node)
  vi.stubGlobal('MutationObserver',dom.window.MutationObserver)

  const chat=dom.window.document.querySelector('#messages')!
  const cache=new TranslationCache<string>(300,600000)
  const model='bench-local'
  let conversation='chat-a'
  if(scenario.name==='Cuộn lên xuống')cache.set(model,alreadySeen.text,'VI: translated earlier',Date.now(),translationCacheScope(conversation,alreadySeen.id))
  let eventReadyAt=0
  let requests=0
  let cancelled=0
  let detect=0
  let confirm=0
  let queue=0
  let ai=0
  let ui=0
  let drain=0
  let scrollRequests=0
  const stop=observeVisibleChatChanges(()=>{eventReadyAt=Date.now()})
  const runMessages=async(batch:Array<{id:string;text:string}>,latency=120,signal?:AbortSignal)=>runLocalAi('translateMessages',JSON.stringify({messages:batch}),model,async(_model,input,_instructions,providerSignal)=>{
    requests++
    await mockLatency(latency,providerSignal)
    const parsed=JSON.parse(input) as {messages:Array<{id:string;text:string}>}
    return JSON.stringify({translations:parsed.messages.map(message=>({id:message.id,translation:`VI: ${message.text.slice(0,24)}`,explanation:''}))})
  },signal)

  const staleController=scenario.cancelStale?new AbortController():undefined
  const staleRequest=staleController?runMessages([{id:'old',text:'Old conversation pending request.'}],260,staleController.signal).catch(()=>{cancelled++}):undefined
  if(staleRequest)await new Promise(resolve=>setTimeout(resolve,8))
  const busyRequest=scenario.name==='Chat liên tục'?runMessages([{id:'busy',text:'Earlier messages still translating.'}],600):undefined
  if(busyRequest)await new Promise(resolve=>setTimeout(resolve,8))

  await new Promise(resolve=>setTimeout(resolve,5))
  const mutationAt=Date.now()
  if(scenario.switchChat)dom.window.document.querySelector('header span')!.textContent='Chat B'
  else if(scenario.name==='Cuộn lên xuống'){
    chat.innerHTML=messagesHtml([alreadySeen,...scenario.messages])
    chat.dispatchEvent(new dom.window.Event('scroll',{bubbles:true}))
  }
  else chat.innerHTML=messagesHtml(scenario.messages)
  await waitUntil(()=>eventReadyAt>0,1000)
  const page=()=>dom.window.eval(buildVisibleChatReadScript(scenario.service)) as {conversationHint:string;messages:Array<Message>}
  let snapshot=page()
  detect=Date.now()-mutationAt
  conversation=scenario.switchChat?'chat-b':'chat-a'

  if(staleController){staleController.abort(new DOMException('Conversation changed','AbortError'));await staleRequest}
  if(snapshot.messages.some(message=>!message.id)){
    const before=JSON.stringify(snapshot.messages)
    const firstReadAt=Date.now()
    await new Promise(resolve=>setTimeout(resolve,IDLESS_MESSAGE_CONFIRMATION_MS))
    snapshot=page()
    expect(JSON.stringify(snapshot.messages)).toBe(before)
    confirm=Date.now()-firstReadAt
  }
  const readyAt=Date.now()
  if(busyRequest)await busyRequest
  const pendingMessages=snapshot.messages.filter(message=>cache.get(model,message.text,Date.now(),translationCacheScope(conversation,message.id))===undefined)
  const ordered=newestFirst(pendingMessages,MAX_TRANSLATION_BATCH_MESSAGES*10)
  const batches:Array<Message[]>=[]
  for(let index=0;index<ordered.length;index+=MAX_TRANSLATION_BATCH_MESSAGES) batches.push(ordered.slice(index,index+MAX_TRANSLATION_BATCH_MESSAGES))
  let firstVisibleAt=0
  for(const batch of batches){
    const startedAt=Date.now()
    if(!firstVisibleAt)queue=Math.max(0,startedAt-readyAt)
    const requestMessages=batch.map((message,index)=>({id:`m${index}`,text:message.text.slice(0,4000)}))
    const response=await runMessages(requestMessages)
    const responseAt=Date.now()
    if(!firstVisibleAt)ai=responseAt-startedAt
    const translations=(response as {translations:Array<{id:string;translation:string}>}).translations
    for(const translation of translations){
      const source=requestMessages.find(message=>message.id===translation.id)
      if(!source)continue
      const original=batch[Number(translation.id.slice(1))]
      const scope=translationCacheScope(conversation,original.id)
      cache.set(model,source.text,translation.translation,Date.now(),scope)
    }
    if(!firstVisibleAt){
      const uiStartedAt=Date.now()
      const output=dom.window.document.createElement('p')
      output.textContent=translations[0]?.translation||''
      chat.append(output)
      await new Promise(resolve=>setTimeout(resolve,16))
      ui=Date.now()-uiStartedAt
      firstVisibleAt=Date.now()
    }
  }
  drain=Date.now()-readyAt
  const total=firstVisibleAt?firstVisibleAt-mutationAt:Date.now()-mutationAt

  if(scenario.name==='Cuộn lên xuống'){
    const beforeScroll=requests
    eventReadyAt=0
    chat.dispatchEvent(new dom.window.Event('scroll',{bubbles:true}))
    await waitUntil(()=>eventReadyAt>0,1000)
    const unchanged=page().messages
    const hits=unchanged.filter(message=>cache.get(model,message.text,Date.now(),translationCacheScope(conversation,message.id))!==undefined)
    scrollRequests=hits.length===unchanged.length?0:1
    expect(scenario.messages.every(message=>cache.get(model,message.text,Date.now(),translationCacheScope(conversation,message.id))!==undefined)).toBe(true)
    expect(requests).toBe(beforeScroll)
  }
  stop()
  dom.window.close()
  return {detect,confirm,queue,ai,ui,total,drain,requests,cancelled,scrollRequests}
}

function mockLatency(duration:number,signal?:AbortSignal){
  return new Promise<void>((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return}
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve()},duration)
    const onAbort=()=>{clearTimeout(timer);reject(signal?.reason||new DOMException('Aborted','AbortError'))}
    signal?.addEventListener('abort',onAbort,{once:true})
  })
}

function medianTiming(samples:Timing[]):Timing{
  const median=(values:number[])=>[...values].sort((left,right)=>left-right)[Math.floor(values.length/2)]
  return {
    detect:median(samples.map(item=>item.detect)),
    confirm:median(samples.map(item=>item.confirm)),
    queue:median(samples.map(item=>item.queue)),
    ai:median(samples.map(item=>item.ai)),
    ui:median(samples.map(item=>item.ui)),
    total:median(samples.map(item=>item.total)),
    drain:median(samples.map(item=>item.drain)),
    requests:median(samples.map(item=>item.requests)),
    cancelled:median(samples.map(item=>item.cancelled)),
    scrollRequests:median(samples.map(item=>item.scrollRequests)),
  }
}

function waitUntil(predicate:()=>boolean,timeoutMs:number){
  return new Promise<void>((resolve,reject)=>{
    const started=Date.now()
    const tick=()=>{
      if(predicate()){resolve();return}
      if(Date.now()-started>=timeoutMs){reject(new Error('Benchmark event timed out'));return}
      setTimeout(tick,5)
    }
    tick()
  })
}

function escapeHtml(value:string){
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
}
