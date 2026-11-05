import { expect, test } from 'vitest'
import { canShowWorkspaceNotification, isNotificationOrigin } from './notification-policy'

test('notifications are limited to the signed-in service origin', () => {
  expect(isNotificationOrigin('zalo','https://chat.zalo.me')).toBe(true)
  expect(isNotificationOrigin('zalo','https://id.zalo.me')).toBe(false)
  expect(isNotificationOrigin('zalo','https://chat.zalo.me.attacker.test')).toBe(false)
  expect(isNotificationOrigin('whatsapp', 'https://web.whatsapp.com')).toBe(true)
  expect(isNotificationOrigin('teams', 'https://teams.microsoft.com')).toBe(true)
  expect(isNotificationOrigin('teams', 'https://teams.cloud.microsoft')).toBe(true)
  expect(isNotificationOrigin('whatsapp', 'https://attacker.whatsapp.com')).toBe(false)
  expect(isNotificationOrigin('teams', 'http://teams.microsoft.com')).toBe(false)
  expect(isNotificationOrigin('teams', 'https://teams.microsoft.com.attacker.example')).toBe(false)
  expect(isNotificationOrigin('teams', 'https://user@teams.microsoft.com')).toBe(false)
})

test('worker notifications are accepted only after the user grants the service permission', () => {
  expect(canShowWorkspaceNotification('whatsapp', 'notifications', 'https://web.whatsapp.com', true, true)).toBe(true)
  expect(canShowWorkspaceNotification('whatsapp', 'notifications', 'https://web.whatsapp.com', false, true)).toBe(false)
  expect(canShowWorkspaceNotification('whatsapp', 'notifications', 'https://web.whatsapp.com', true, false)).toBe(false)
  expect(canShowWorkspaceNotification('whatsapp', 'media', 'https://web.whatsapp.com', true, true)).toBe(false)
  expect(canShowWorkspaceNotification('teams', 'notifications', 'https://evil.example', true, true)).toBe(false)
})

test('Outlook notifications require the owned mail view and real mail origin',()=>{
 expect(canShowWorkspaceNotification('outlook','notifications','https://outlook.office.com',true,true)).toBe(true)
 expect(canShowWorkspaceNotification('outlook','notifications','https://login.microsoftonline.com',true,true)).toBe(false)
 expect(canShowWorkspaceNotification('outlook','notifications','https://outlook.office.com.evil.invalid',true,true)).toBe(false)
 expect(canShowWorkspaceNotification('outlook','notifications','https://outlook.office.com',true,false)).toBe(false)
})
