export function hasCloudConsentForTask(task: string, manualConsent: boolean, backgroundConsent: boolean) {
  return task === 'translateMessages' || task === 'replyFromChat' ? backgroundConsent : manualConsent
}
