import { desktopCapturer, dialog, type BrowserWindow, type WebContents } from 'electron'

export type MeetingService = 'teams'

const meetingHosts: Record<MeetingService, readonly string[]> = {
 teams: ['teams.microsoft.com', 'teams.cloud.microsoft'],
}
const meetingLabel: Record<MeetingService, string> = { teams: 'Teams' }

export function trustedMeetingOrigin(service: MeetingService, value: string) {
 try {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password && meetingHosts[service].some(host => url.hostname === host || url.hostname.endsWith('.' + host))
 } catch {
  return false
 }
}

export function trustedTeamsOrigin(value: string) {
 return trustedMeetingOrigin('teams', value)
}

export function meetingDeviceRequest(service: MeetingService, top: string, origin: string, owned: boolean, types: readonly string[]) {
 return owned && trustedMeetingOrigin(service, top) && trustedMeetingOrigin(service, origin) && types.length > 0 && types.every(type => type === 'audio' || type === 'video')
}

export function teamsDeviceRequest(top: string, origin: string, owned: boolean, types: readonly string[]) {
 return meetingDeviceRequest('teams', top, origin, owned, types)
}

export type MeetingRemember = { get: () => Promise<boolean>; set: (enabled: boolean) => Promise<void> }

export function installMeetingPermissions(service: MeetingService, contents: WebContents, parent: BrowserWindow, remember?: MeetingRemember) {
 const grants = new Map<string, Set<string>>()
 const label = meetingLabel[service]
 const trusted = (origin: string) => !contents.isDestroyed() && trustedMeetingOrigin(service, contents.getURL()) && trustedMeetingOrigin(service, origin)
 contents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) grants.clear() })
 contents.session.setPermissionCheckHandler((sender, permission, origin, details) => {
  if (permission === 'notifications') return false
  if (sender !== contents || !trusted(origin) || details.embeddingOrigin && !trustedMeetingOrigin(service, details.embeddingOrigin)) return false
  if (permission === 'display-capture') return true
  if (permission === 'media') { const allowed = grants.get(new URL(origin).origin); return details.mediaType === 'audio' || details.mediaType === 'video' ? !!allowed?.has(details.mediaType) : !!allowed?.has('audio') && !!allowed?.has('video') }
  return permission === 'speaker-selection' && !!grants.get(new URL(origin).origin)?.has('speaker-selection')
 })
 contents.session.setPermissionRequestHandler(async (sender, permission, callback, details) => {
  let accepted = false
  try {
   const origin = ('securityOrigin' in details ? details.securityOrigin : undefined) || details.requestingUrl
   if (permission === 'notifications') return
   if (sender !== contents || !trusted(origin)) return
   if (permission === 'display-capture') { accepted = true; return }
   const types = permission === 'media' && 'mediaTypes' in details ? details.mediaTypes || [] : permission === 'speaker-selection' ? ['speaker-selection'] : []
   if (permission !== 'speaker-selection' && !meetingDeviceRequest(service, contents.getURL(), origin, true, types)) return
   if (!types.length) return
   const key = new URL(origin).origin, known = grants.get(key) || new Set<string>()
   if (types.every(type => known.has(type))) { accepted = true; return }
   if (remember && await remember.get()) { types.forEach(type => known.add(type)); grants.set(key, known); accepted = true; return }
   const answer = await dialog.showMessageBox(parent, { type: 'question', checkboxLabel: 'Ghi nhớ cho ứng dụng này (không hỏi lại)', checkboxChecked: false, title: `Quyền thiết bị cuộc họp ${label}`, message: `Cho phép ${label} dùng ${types.map(type => type === 'audio' ? 'microphone' : type === 'video' ? 'camera' : 'lựa chọn loa').join(' và ')}?`, detail: `Chỉ dành cho cuộc gọi ${label} trên trang đã xác minh. Windows vẫn có thể chặn thiết bị trong Cài đặt quyền riêng tư.`, buttons: ['Hủy', 'Cho phép'], defaultId: 0, cancelId: 0 })
   if (answer.response === 1 && trusted(origin)) { types.forEach(type => known.add(type)); grants.set(key, known); accepted = true; if (remember && answer.checkboxChecked) await remember.set(true) }
  } catch {} finally { callback(accepted) }
 })
 contents.session.setDisplayMediaRequestHandler((request, callback) => {
  void (async () => {
   try {
    if (!request.frame || request.frame.top !== contents.mainFrame || !trusted(request.securityOrigin) || !trustedMeetingOrigin(service, request.frame.url) || !request.userGesture || !request.videoRequested) { callback(null); return }
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
    const answer = await dialog.showMessageBox(parent, { type: 'question', title: `Chia sẻ màn hình trong ${label}`, message: 'Chọn màn hình/cửa sổ để chia sẻ với cuộc họp.', detail: 'Chỉ chia sẻ hình ảnh; chưa hỗ trợ chia sẻ âm thanh hệ thống. Kiểm tra nội dung nhạy cảm trước khi chọn.', buttons: ['Hủy', ...sources.slice(0, 20).map(source => source.name)], defaultId: 0, cancelId: 0 })
    const source = sources[answer.response - 1]
    if (!source || !request.frame || request.frame.top !== contents.mainFrame || !trusted(request.securityOrigin)) { callback(null); return }
    callback({ video: source })
   } catch { callback(null) }
  })()
 })
}

export function installTeamsMeetingPermissions(contents: WebContents, parent: BrowserWindow, _notificationAllowed: () => boolean, _grantNotification: () => Promise<boolean>) {
 installMeetingPermissions('teams', contents, parent)
}
