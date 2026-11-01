export type WorkspaceService = 'whatsapp' | 'teams'

const notificationHosts: Record<WorkspaceService, ReadonlySet<string>> = {
  whatsapp: new Set(['web.whatsapp.com']),
  teams: new Set(['teams.microsoft.com', 'teams.cloud.microsoft']),
}

export function isNotificationOrigin(service: WorkspaceService, value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && notificationHosts[service].has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function canShowWorkspaceNotification(service: WorkspaceService, permission: string, origin: string, enabled: boolean, isOwnedContents: boolean) {
  return permission === 'notifications' && enabled && isOwnedContents && isNotificationOrigin(service, origin)
}
