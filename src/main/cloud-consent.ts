export function hasCloudConsentForTask(task: string, manualConsent: boolean, backgroundConsent: boolean) {
  if(task==='extractTasks')return false
  return task === 'translateLatest' || task === 'translateMessages' || task === 'replyFromChat' || task === 'replyTranslationFromChat' ? backgroundConsent : manualConsent
}
