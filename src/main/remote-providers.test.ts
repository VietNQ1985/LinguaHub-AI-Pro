import { expect, test, vi } from 'vitest'
vi.mock('electron', () => ({ safeStorage: {} }))
import { validRemoteUrl } from './remote-providers'

test('remote AI endpoint must be public HTTPS without credentials or private hosts',()=>{
 expect(validRemoteUrl('https://abc-123.ngrok-free.app')).toBe(true)
 for(const url of ['http://abc.ngrok-free.app','https://user:pass@abc.ngrok-free.app','https://localhost','https://127.0.0.1','https://192.168.1.10','https://abc.ngrok-free.app:8443','javascript:alert(1)'])
  expect(validRemoteUrl(url)).toBe(false)
})
