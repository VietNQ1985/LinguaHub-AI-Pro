import { expect, test } from 'vitest'
import { APP_USER_MODEL_ID, TOAST_ACTIVATOR_CLSID, startMenuShortcutPath, toastShortcutDetails } from './windows-notifications'

test('Windows toast activation uses a stable matching application identity', () => {
  expect(APP_USER_MODEL_ID).toBe('com.linguahub.ai.pro')
  expect(TOAST_ACTIVATOR_CLSID).toMatch(/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i)
})

test('Start Menu shortcut carries the same AUMID and toast activator', () => {
  const executable = 'C:\\Program Files\\LinguaHub AI Pro\\LinguaHub AI Pro.exe'
  expect(startMenuShortcutPath('C:\\Users\\Viet\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'))
    .toBe('C:\\Users\\Viet\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\LinguaHub AI Pro.lnk')
  expect(toastShortcutDetails(executable)).toEqual({
    target: executable,
    cwd: 'C:\\Program Files\\LinguaHub AI Pro',
    description: 'LinguaHub AI Pro',
    appUserModelId: APP_USER_MODEL_ID,
    toastActivatorClsid: TOAST_ACTIVATOR_CLSID,
  })
})
