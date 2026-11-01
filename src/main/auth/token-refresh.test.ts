import { expect, test } from 'vitest'
import { createRefreshRequest, mergeRefreshedToken, type RefreshableRecord } from './token-refresh'

const previous: RefreshableRecord = {
  clientId: 'oaiapp_issued', subject: 'subject-1', email: 'user@example.com',
  accessToken: 'old-access', refreshToken: 'old-refresh', idToken: 'old-id',
  expiresAt: 1, scopes: ['openid', 'chatgpt.tokens.use.direct'],
}

test('refresh request uses the issued client id and omits scope',()=>{
  expect(createRefreshRequest(previous)).toEqual(new URLSearchParams({
    grant_type:'refresh_token',client_id:'oaiapp_issued',refresh_token:'old-refresh',resource:'https://api.openai.com/v1',
  }))
  expect(()=>createRefreshRequest({...previous,clientId:'dynamic_agent_client'})).toThrow()
})

test('rotates tokens, preserves an omitted refresh token, and keeps the existing grant',()=>{
  expect(mergeRefreshedToken({access_token:'new-access',expires_in:3600},previous,1000)).toEqual({
    ...previous,accessToken:'new-access',expiresAt:3601000,
  })
  expect(mergeRefreshedToken({access_token:'next-access',refresh_token:'new-refresh',id_token:'new-id',expires_in:60,scope:'openid chatgpt.tokens.use.direct'},previous,1000)).toMatchObject({
    accessToken:'next-access',refreshToken:'new-refresh',idToken:'new-id',expiresAt:61000,scopes:['openid','chatgpt.tokens.use.direct'],
  })
})

test('rejects malformed or empty refresh grants',()=>{
  expect(()=>mergeRefreshedToken({access_token:'',expires_in:60},previous)).toThrow()
  expect(()=>mergeRefreshedToken({access_token:'new-access',expires_in:0},previous)).toThrow()
})
