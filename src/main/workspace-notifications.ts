import type { Notification } from 'electron'
import type { UnreadValue } from '../shared/workspace-unread'
import type { WorkspaceService } from './notification-policy'

export const GENERIC_NOTIFICATION_TITLE = 'LinguaHub AI Pro'
export const GENERIC_NOTIFICATION_BODY = 'Có thông báo mới.'

const services: readonly WorkspaceService[] = ['whatsapp', 'teams', 'zalo', 'outlook']

export function unreadChangeNeedsNotification(previous: UnreadValue, next: UnreadValue, initialized: boolean) {
  if (!initialized) return false
  const hadUnread = previous === 'dot' || previous > 0
  const hasUnread = next === 'dot' || next > 0
  if (!hasUnread) return false
  if (!hadUnread) return true
  return typeof previous === 'number' && typeof next === 'number' && next > previous
}

export function workspaceNotificationActivationArguments(service: WorkspaceService) {
  return `linguahub:workspace:${service}`
}

export function workspaceFromNotificationActivation(type: string, args: string): WorkspaceService | null {
  if (type !== 'click') return null
  return services.find(service => args === workspaceNotificationActivationArguments(service)) ?? null
}

export function workspaceNotificationToastXml(service: WorkspaceService) {
  const activation = workspaceNotificationActivationArguments(service)
  return `<toast launch="${activation}"><visual><binding template="ToastGeneric"><text>${GENERIC_NOTIFICATION_TITLE}</text><text>${GENERIC_NOTIFICATION_BODY}</text></binding></visual></toast>`
}

export function genericWorkspaceNotificationOptions(service: WorkspaceService): Electron.NotificationConstructorOptions {
  return {
    title: GENERIC_NOTIFICATION_TITLE,
    body: GENERIC_NOTIFICATION_BODY,
    toastXml: workspaceNotificationToastXml(service),
  }
}

export function routeWorkspaceNotificationClick(notification: Pick<Notification, 'on'>, service: WorkspaceService, activate: (service: WorkspaceService) => void) {
  notification.on('click', () => activate(service))
}
