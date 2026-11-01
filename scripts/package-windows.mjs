import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
const root=resolve(import.meta.dirname,'..')
const staging=await mkdtemp(join(root,'.package-'))
// Each packaging job owns its snapshot; later builds cannot replace these files.
await cp(join(root,'out'),join(staging,'out'),{recursive:true})
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
const outputDirectory=resolve(root,process.env.LINGUAHUB_PACKAGE_OUTPUT || manifest.build.directories.output)
const configuration={...manifest.build,
  directories:{...manifest.build.directories,output:outputDirectory},
  files:[{from:join(staging,'out'),to:'out',filter:['**/*']},'package.json'],
  nsis:{...manifest.build.nsis,artifactName:'LinguaHub-AI-Pro-Setup.exe'},
}
const configPath=join(staging,'builder.json')
await writeFile(configPath,JSON.stringify(configuration,null,2))
const child=spawn(process.execPath,[join(root,'node_modules/electron-builder/cli.js'),'--win','nsis','--config',configPath],{cwd:root,stdio:'inherit',windowsHide:true})
child.on('error',error=>{console.error(error.message);process.exitCode=1})
child.on('exit',async code=>{
  process.exitCode=code ?? 1
  if(code===0){
    try{
      const filename=join(outputDirectory,'LinguaHub-AI-Pro-Setup.exe')
      const bytes=await readFile(filename)
      const hash=createHash('sha256').update(bytes).digest('hex')
      await writeFile(`${filename}.sha256`,`${hash}  LinguaHub-AI-Pro-Setup.exe\n`)
      console.log(`Installer SHA-256: ${hash}`)
    }catch(error){console.error(error.message);process.exitCode=1}
  }
})
