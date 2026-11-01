import {test,expect} from 'vitest'
import {isSafeExternalWebUrl, isWorkspaceUrl} from './navigation'
test('workspace navigation rejects lookalike hosts, insecure schemes and credentials',()=>{
  expect(isWorkspaceUrl('whatsapp','https://web.whatsapp.com/')).toBe(true)
  expect(isWorkspaceUrl('teams','https://login.microsoftonline.com/')).toBe(true)
  for(const url of ['https://web.whatsapp.com.evil.test','http://web.whatsapp.com','https://user:pass@web.whatsapp.com','javascript:alert(1)'])expect(isWorkspaceUrl('whatsapp',url)).toBe(false)
})
test('external links must use public HTTPS hosts without embedded credentials',()=>{
  expect(isSafeExternalWebUrl('https://example.com/file')).toBe(true)
  for(const url of ['http://example.com','javascript:alert(1)','https://user:pass@example.com','https://localhost','https://192.168.1.20','https://[::1]'])expect(isSafeExternalWebUrl(url)).toBe(false)
})
