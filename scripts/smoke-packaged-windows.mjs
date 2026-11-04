import { spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

if(process.platform!=='win32')throw new Error('Smoke test này chỉ chạy trên Windows.')

const root=resolve(import.meta.dirname,'..')
const executable=join(root,'release','win-unpacked','LinguaHub AI Pro.exe')
const temporaryRoot=resolve(tmpdir())
const isolatedRoot=await mkdtemp(join(temporaryRoot,'linguahub-startup-smoke-'))
const smokeMarker=join(isolatedRoot,'startup-smoke.status')
const safeRelative=relative(temporaryRoot,resolve(isolatedRoot))
if(!safeRelative||safeRelative.startsWith(`..${sep}`)||safeRelative==='..'||isAbsolute(safeRelative))throw new Error('Đường dẫn dữ liệu smoke test nằm ngoài thư mục tạm.')

function stopProcessTree(pid){
  if(!pid)return
  spawnSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{stdio:'ignore',windowsHide:true})
}

let child
let timeout
try{
  const env={...process.env,
    LINGUAHUB_STARTUP_SMOKE:'1',
    LINGUAHUB_SMOKE_MARKER:smokeMarker,
    APPDATA:join(isolatedRoot,'roaming'),
    LOCALAPPDATA:join(isolatedRoot,'local'),
    ProgramData:join(isolatedRoot,'program-data'),
    TEMP:join(isolatedRoot,'temp'),
    TMP:join(isolatedRoot,'temp'),
  }
  await Promise.all([env.APPDATA,env.LOCALAPPDATA,env.ProgramData,env.TEMP].map(directory=>mkdir(directory,{recursive:true})))
  for(const key of Object.keys(env))if(/(^|_)(?:API_KEY|KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?)(?:_|$)/i.test(key)||key==='CODEX_HOME')delete env[key]
  delete env.ELECTRON_RENDERER_URL
  delete env.ELECTRON_RUN_AS_NODE
  delete env.NODE_OPTIONS
  child=spawn(executable,[],{cwd:join(root,'release','win-unpacked'),env,stdio:'ignore',windowsHide:true})
  const exitPromise=new Promise((resolveExit,reject)=>{
    child.once('error',reject)
    child.once('exit',(code,signal)=>resolveExit({code,signal}))
  })
  timeout=setTimeout(()=>stopProcessTree(child.pid),45_000)
  const result=await exitPromise
  clearTimeout(timeout)
  timeout=undefined
  if(result.code!==0)throw new Error(`Ứng dụng đóng gói thoát với mã ${result.code??`tín hiệu ${result.signal}`} trong smoke test.`)
  const markerStatus=await readFile(smokeMarker,'utf8').catch(()=> '')
  if(markerStatus.trim()!=='renderer-ready')throw new Error(`Ứng dụng thoát nhưng không ghi nhận renderer đã tải xong (trạng thái: ${markerStatus.trim()||'không có dấu mốc'}).`)
  console.log('Smoke test Windows đạt: app.asar, preload và renderer khởi động được; hồ sơ dữ liệu tạm đã cách ly.')
}finally{
  if(timeout)clearTimeout(timeout)
  if(child?.exitCode===null)stopProcessTree(child.pid)
  const target=resolve(isolatedRoot)
  const relativeTarget=relative(temporaryRoot,target)
  if(relativeTarget&&!relativeTarget.startsWith(`..${sep}`)&&relativeTarget!=='..'&&!isAbsolute(relativeTarget))await rm(target,{recursive:true,force:true})
}
