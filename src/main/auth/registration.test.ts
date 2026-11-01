import { afterEach, expect, test } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readIssuedClientId, saveIssuedClientId } from './registration'

const directories: string[] = []
afterEach(async()=>{await Promise.all(directories.splice(0).map(directory=>rm(directory,{recursive:true,force:true})))})

test('keeps the issued client id before and after authorization-code exchange retries', async()=>{
  const directory=await mkdtemp(join(tmpdir(),'linguahub-registration-'))
  directories.push(directory)
  await expect(readIssuedClientId(directory)).resolves.toBeNull()
  await saveIssuedClientId(directory,'oaiapp_issued')
  await saveIssuedClientId(directory,'oaiapp_issued')
  await expect(readIssuedClientId(directory)).resolves.toBe('oaiapp_issued')
  await expect(readFile(join(directory,'chatgpt-registration.json'),'utf8')).resolves.toContain('oaiapp_issued')
})

test('rejects a malformed saved client registration without deleting it', async()=>{
  const directory=await mkdtemp(join(tmpdir(),'linguahub-registration-'))
  directories.push(directory)
  const path=join(directory,'chatgpt-registration.json')
  const original='{"clientId":42}'
  await (await import('node:fs/promises')).writeFile(path,original)
  await expect(readIssuedClientId(directory)).rejects.toThrow('Không đọc được mã đăng ký')
  await expect(readFile(path,'utf8')).resolves.toBe(original)
})
