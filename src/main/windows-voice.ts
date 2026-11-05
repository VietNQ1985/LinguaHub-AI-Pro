import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {join} from 'node:path'
const run=promisify(execFile)
// Fixed Windows shortcut only. No user text, command interpolation or audio recording.
const script=String.raw`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class LhVoice { [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra); }'; [LhVoice]::keybd_event(0x5B,0,0,[UIntPtr]::Zero); try { [LhVoice]::keybd_event(0x48,0,0,[UIntPtr]::Zero); [LhVoice]::keybd_event(0x48,0,2,[UIntPtr]::Zero) } finally { [LhVoice]::keybd_event(0x5B,0,2,[UIntPtr]::Zero) }`
export async function openWindowsVoiceTyping(){
 if(process.platform!=='win32')throw new Error('Chỉ hỗ trợ Windows.')
 const executable=join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe')
 await run(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:10000})
 return true
}
