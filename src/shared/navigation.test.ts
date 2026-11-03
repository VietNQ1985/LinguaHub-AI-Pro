import { isZaloStorageRequest } from './navigation'
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

test('Zalo navigation is limited to chat and login origins',()=>{
 expect(isWorkspaceUrl('zalo','https://chat.zalo.me/')).toBe(true)
 expect(isWorkspaceUrl('zalo','https://id.zalo.me/account')).toBe(true)
 for(const url of ['https://chat.zalo.me.evil.test','https://evil.zalo.me','http://chat.zalo.me','https://user:pass@chat.zalo.me'])expect(isWorkspaceUrl('zalo',url)).toBe(false)
})

test('Zalo storage handoff does not grant device permissions or foreign origins',()=>{
 expect(isZaloStorageRequest('storage-access','https://chat.zalo.me','https://id.zalo.me',true)).toBe(true)
 expect(isZaloStorageRequest('media','https://chat.zalo.me','https://id.zalo.me',true)).toBe(false)
 expect(isZaloStorageRequest('storage-access','https://chat.zalo.me','https://evil.test',true)).toBe(false)
 expect(isZaloStorageRequest('storage-access','https://chat.zalo.me','https://id.zalo.me',false)).toBe(false)
})
