import { access, readFile, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'

const root=resolve(import.meta.dirname,'..')
const release=resolve(root,process.env.LINGUAHUB_PACKAGE_OUTPUT||'release')
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
const asarPath=join(release,'win-unpacked','resources','app.asar')
const require=createRequire(import.meta.url)
const {listPackage,extractFile}=require('@electron/asar')
const requiredFiles=['package.json','out/main/index.js','out/preload/index.cjs','out/preload/chat-view.cjs','out/renderer/index.html']
const packagedPaths=new Set(listPackage(asarPath).map(path=>path.replaceAll('\\','/').replace(/^\/+/,'')))

for(const name of requiredFiles){
  if(!packagedPaths.has(name))throw new Error(`Thiếu tài nguyên trong app.asar: ${name}`)
}
if(![...packagedPaths].some(path=>path.startsWith('out/renderer/assets/')))throw new Error('Thiếu tài nguyên giao diện trong app.asar.')

const packagedManifest=JSON.parse(extractFile(asarPath,'package.json').toString('utf8'))
if(packagedManifest.main!=='./out/main/index.js')throw new Error('Điểm khởi động trong package.json của app.asar không đúng.')
const mainBundle=extractFile(asarPath,join('out','main','index.js')).toString('utf8')
if(!mainBundle.includes('sql-wasm.wasm'))throw new Error('Bundle main không trỏ đến tài nguyên SQL đã đóng gói.')

const icon=join(root,'assets','linguahub.ico')
const iconInfo=await stat(icon)
if(iconInfo.size<1000)throw new Error('Không tìm thấy icon ứng dụng hợp lệ.')
await access(join(release,'win-unpacked','LinguaHub AI Pro.exe'),constants.R_OK)
await access(join(release,'win-unpacked','resources','sql-wasm.wasm'),constants.R_OK)

const artifacts=[
  `LinguaHub-AI-Pro-Setup-${manifest.version}.exe`,
  `LinguaHub-AI-Pro-Portable-${manifest.version}.exe`,
]
for(const name of artifacts){
  const path=join(release,name)
  const info=await stat(path)
  if(info.size<20*1024*1024)throw new Error(`${name} quá nhỏ (${info.size} byte), có thể gói bị thiếu.`)
  if(info.size>1024*1024*1024)throw new Error(`${name} vượt giới hạn kích thước dự kiến.`)
  console.log(`Đã xác minh ${name} (${(info.size/1024/1024).toFixed(1)} MiB).`)
}
console.log(`Đã xác minh icon, app.asar, main, preload, giao diện, sql-wasm.wasm và win-unpacked.`)
