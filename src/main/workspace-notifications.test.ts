import { expect, test, vi } from 'vitest'
import type { Notification } from 'electron'
import { genericWorkspaceNotificationOptions, routeWorkspaceNotificationClick, unreadChangeNeedsNotification, workspaceFromNotificationActivation } from './workspace-notifications'

test('initial unread state is quiet and only a new increase triggers a generic toast', () => {
  expect(unreadChangeNeedsNotification(0, 3, false)).toBe(false)
  expect(unreadChangeNeedsNotification(0, 1, true)).toBe(true)
  expect(unreadChangeNeedsNotification(3, 4, true)).toBe(true)
  expect(unreadChangeNeedsNotification(3, 2, true)).toBe(false)
  expect(unreadChangeNeedsNotification('dot', 'dot', true)).toBe(false)
  expect(unreadChangeNeedsNotification(0, 'dot', true)).toBe(true)
})

test('notification body and Windows toast XML contain only generic text', () => {
  const options = genericWorkspaceNotificationOptions('teams')
  expect(options.title).toBe('LinguaHub AI Pro')
  expect(options.body).toBe('Có thông báo mới.')
  expect(options.toastXml).toContain('linguahub:workspace:teams')
  expect(options.toastXml).not.toContain('Tina')
  expect(options.toastXml).not.toContain('message text')
})

test('a click routes to the workspace captured when its notification was created', () => {
  const handler = vi.fn()
  const on = vi.fn((_event: string, listener: () => void) => { listener() })
  routeWorkspaceNotificationClick({ on } as unknown as Pick<Notification, 'on'>, 'zalo', handler)
  expect(handler).toHaveBeenCalledExactlyOnceWith('zalo')
})

test('Windows activation accepts only a known workspace click argument', () => {
  expect(workspaceFromNotificationActivation('click', 'linguahub:workspace:whatsapp')).toBe('whatsapp')
  expect(workspaceFromNotificationActivation('click', 'linguahub:workspace:teams')).toBe('teams')
  expect(workspaceFromNotificationActivation('click', 'linguahub:workspace:zalo')).toBe('zalo')
  expect(workspaceFromNotificationActivation('action', 'linguahub:workspace:zalo')).toBeNull()
  expect(workspaceFromNotificationActivation('click', 'linguahub:workspace:zalo-attacker')).toBeNull()
})
