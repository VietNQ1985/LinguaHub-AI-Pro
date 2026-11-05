import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep, join } from 'node:path'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

const root=resolve(import.meta.dirname,'..')
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
const outputDirectory=resolve(root,process.env.LINGUAHUB_PACKAGE_OUTPUT||manifest.build.directories.output)
const outputRelative=relative(root,outputDirectory)
if(!outputRelative||outputRelative==='..'||outputRelative.startsWith(`..${sep}`)||isAbsolute(outputRelative))throw new Error('Thư mục đóng gói phải nằm bên trong thư mục dự án.')
const staging=await mkdtemp(join(root,'.package-'))
const setupName=`LinguaHub-AI-Pro-Setup-${manifest.version}.exe`
const portableName=`LinguaHub-AI-Pro-Portable-${manifest.version}.exe`
const targets=[['nsis',setupName],['portable',portableName]]

function runBuilder(target,configPath){
  return new Promise((resolvePromise,reject)=>{
    const child=spawn(process.execPath,[join(root,'node_modules/electron-builder/cli.js'),'--win',target,'--x64','--config',configPath],{cwd:root,stdio:'inherit',windowsHide:true})
    child.once('error',reject)
    child.once('exit',code=>code===0?resolvePromise():reject(new Error(`electron-builder ${target} завершився з кодом ${code??'невідомо'}`)))
  })
}

try{
  await cp(join(root,'out'),join(staging,'out'),{recursive:true})
  const configuration={...manifest.build,
    directories:{...manifest.build.directories,output:outputDirectory},
    files:[{from:join(staging,'out'),to:'out',filter:['main/**/*','preload/**/*','renderer/**/*']},'package.json'],
  }
  const configPath=join(staging,'builder.json')
  await writeFile(configPath,JSON.stringify(configuration,null,2))
  await mkdir(outputDirectory,{recursive:true})
  for(const [,name] of targets)await rm(join(outputDirectory,name),{force:true})
  for(const [target] of targets)await runBuilder(target,configPath)

  for(const [,name] of targets){
    const path=join(outputDirectory,name)
    const bytes=await readFile(path)
    const hash=createHash('sha256').update(bytes).digest('hex')
    console.log(`${name} SHA-256: ${hash}`)
  }
}finally{
  await rm(staging,{recursive:true,force:true})
}
