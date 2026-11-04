export function hasCloudConsentForTask(task: string, manualConsent: boolean, backgroundConsent: boolean) {
  return task === 'translateLatest' || task === 'translateMessages' || task === 'replyFromChat' || task === 'replyTranslationFromChat' ? backgroundConsent : manualConsent
}
