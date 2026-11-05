import { win32 } from 'node:path'

export const APP_USER_MODEL_ID = 'com.linguahub.ai.pro'
export const TOAST_ACTIVATOR_CLSID = '{3F24A61B-89D1-4C51-A167-B0D7E42099C2}'

export function startMenuShortcutPath(programsDirectory: string) {
  return win32.join(programsDirectory, 'LinguaHub AI Pro.lnk')
}

export function toastShortcutDetails(executablePath: string) {
  return {
    target: executablePath,
    cwd: win32.dirname(executablePath),
    description: 'LinguaHub AI Pro',
    appUserModelId: APP_USER_MODEL_ID,
  }
}
