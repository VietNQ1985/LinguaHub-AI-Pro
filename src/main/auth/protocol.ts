import { createHash, randomBytes } from 'node:crypto'

export const RESOURCE = 'https://api.openai.com/v1'
export const AUTHORIZATION_ENDPOINT = 'https://auth.openai.com/api/accounts/authorize'
export const TOKEN_ENDPOINT = 'https://auth.openai.com/api/accounts/oauth/token'
export const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
export function createAuthorization(hostId: string, redirectUri: string, clientId?: string, hints?: { idTokenHint?: string; loginHint?: string }) {
  const redirect = new URL(redirectUri)
  if (redirect.protocol !== 'http:' || redirect.hostname !== '127.0.0.1' || redirect.pathname !== '/auth/callback' || redirect.search || redirect.hash || redirect.username || redirect.password) throw new Error('Invalid loopback callback')
  const state = randomBytes(32).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const url = new URL(AUTHORIZATION_ENDPOINT)
  const params: Record<string,string> = { client_id: clientId || 'dynamic_agent_client', ext_agent_host_id:hostId, response_type:'code',redirect_uri:redirectUri,scope:SCOPES,resource:RESOURCE,state,nonce,code_challenge_method:'S256',code_challenge:challenge }
  if(!clientId) params.agent_name_hint='LinguaHub AI Pro'
  else {
    if (hints?.idTokenHint) params.id_token_hint = hints.idTokenHint
    if (hints?.loginHint) params.login_hint = hints.loginHint
  }
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value)
  return { url:url.toString(),state,nonce,verifier,redirectUri,clientId }
}
export function validateCallback(url: URL, pending: ReturnType<typeof createAuthorization>) {
  const expected = new URL(pending.redirectUri)
  if(url.origin !== expected.origin || url.pathname !== expected.pathname || url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== pending.state) throw new Error('Invalid OAuth callback')
  if(url.searchParams.has('error'))throw new Error('Đăng nhập chưa được cấp quyền.')
  const clientId=url.searchParams.get('client_id') || pending.clientId
  const code=url.searchParams.get('code')
  if(!code || !clientId || clientId === 'dynamic_agent_client' || (pending.clientId && pending.clientId !== clientId))throw new Error('Invalid OAuth registration')
  return {clientId,code}
}
