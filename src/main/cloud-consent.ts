export function hasCloudConsentForTask(task: string, manualConsent: boolean, backgroundConsent: boolean) {
  return task === 'translateMessages' ? backgroundConsent : manualConsent
}
