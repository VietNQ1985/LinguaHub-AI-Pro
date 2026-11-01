import { test,expect } from 'vitest'
import { createHash } from 'node:crypto'
import { createAuthorization,validateCallback } from './protocol'
test('PKCE uses S256 and each login gets independent state',()=>{
  const a=createAuthorization('urn:uuid:test','http://127.0.0.1:1455/auth/callback')
  const b=createAuthorization('urn:uuid:test','http://127.0.0.1:1455/auth/callback')
  expect(a.state).not.toBe(b.state)
  expect(new URL(a.url).searchParams.get('code_challenge')).toBe(createHash('sha256').update(a.verifier).digest('base64url'))
})
test('rejects mismatched state and registration replacement',()=>{
  const pending=createAuthorization('urn:uuid:test','http://127.0.0.1:1455/auth/callback','oaiapp_original')
  expect(()=>validateCallback(new URL(`${pending.redirectUri}?state=wrong&code=x`),pending)).toThrow()
  expect(()=>validateCallback(new URL(`${pending.redirectUri}?state=${pending.state}&code=x&client_id=oaiapp_other`),pending)).toThrow()
})
test('rejects non-loopback redirect and accepts issued client ID',()=>{
  expect(()=>createAuthorization('host','https://example.com/auth/callback')).toThrow()
  const pending=createAuthorization('host','http://127.0.0.1:1455/auth/callback')
  expect(validateCallback(new URL(`${pending.redirectUri}?state=${pending.state}&code=x&client_id=oaiapp_issued`),pending)).toEqual({clientId:'oaiapp_issued',code:'x'})
})

test('reauthorization uses saved account hints and omits first-registration metadata',()=>{
  const pending=createAuthorization('urn:uuid:test','http://127.0.0.1:1455/auth/callback','oaiapp_issued',{idTokenHint:'saved-id-token',loginHint:'user@example.com'})
  const url=new URL(pending.url)
  expect(url.searchParams.get('id_token_hint')).toBe('saved-id-token')
  expect(url.searchParams.get('login_hint')).toBe('user@example.com')
  expect(url.searchParams.has('agent_name_hint')).toBe(false)
})
