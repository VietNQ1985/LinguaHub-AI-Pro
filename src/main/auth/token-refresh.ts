import { z } from 'zod'

export type RefreshableRecord = {
  clientId: string
  subject: string
  email: string
  accessToken: string
  refreshToken?: string
  idToken: string
  expiresAt: number
  scopes: string[]
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
})

export function createRefreshRequest(record: Pick<RefreshableRecord, 'clientId' | 'refreshToken'>) {
  if (!record.refreshToken || record.clientId === 'dynamic_agent_client') throw new Error('Không có phiên ChatGPT có thể làm mới.')
  return new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: record.clientId,
    refresh_token: record.refreshToken,
    resource: 'https://api.openai.com/v1',
  })
}

export function mergeRefreshedToken(value: unknown, previous: RefreshableRecord, now = Date.now()) {
  const token = tokenResponseSchema.parse(value)
  return {
    ...previous,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || previous.refreshToken,
    idToken: token.id_token || previous.idToken,
    expiresAt: now + token.expires_in * 1000,
    scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : previous.scopes,
  }
}
