import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
if(process.platform==='win32'){
 await mkdir(resolve('out/native'),{recursive:true})
 execFileSync(join(process.env.SystemRoot||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/optimize+','/reference:System.Web.Extensions.dll','/out:'+resolve('out/native/ZaloCompanion.exe'),resolve('native/ZaloCompanion.cs')],{stdio:'inherit',windowsHide:true})
}
