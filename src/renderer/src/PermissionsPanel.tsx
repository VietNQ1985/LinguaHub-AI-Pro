import { useEffect, useState } from 'react'

type Key = 'chat' | 'mic' | 'teams' | 'zalo'
type Grants = Record<Key, boolean>

const ITEMS: Array<{ key: Key; label: string; hint: string }> = [
 { key: 'chat', label: 'Đọc tin nhắn đang hiển thị', hint: 'WhatsApp, Teams, Zalo — để dịch và gợi ý trả lời. Outlook xin quyền đọc email riêng.' },
 { key: 'mic', label: 'Microphone luyện nói', hint: 'Chỉ ghi âm bài luyện nói để nghe lại trên máy; không nhận dạng giọng nói hoặc tải model' },
 { key: 'teams', label: 'Cuộc họp Teams', hint: 'Micro, camera và đọc phụ đề trong Teams' },
 { key: 'zalo', label: 'Cuộc gọi Zalo', hint: 'Micro, camera khi gọi thoại/video trên Zalo Web' },
]
// Pre-ticked on first run: what the main features need. Meeting devices stay opt-in.
const RECOMMENDED: Grants = { chat: true, mic: false, teams: false, zalo: false }

/** One checklist instead of a prompt per permission. `firstRun` shows it only until saved once. */
export function PermissionsPanel({ firstRun = false, onSaved }: { firstRun?: boolean; onSaved?: (grants: Grants) => void }) {
 const [grants, setGrants] = useState<Grants | null>(null)
 const [reviewed, setReviewed] = useState(true)
 const [message, setMessage] = useState('')

 useEffect(() => {
  void Promise.resolve().then(() => window.lingua.getPermissions()).then(value => {
   setReviewed(value.reviewed)
   setGrants(value.reviewed ? { chat: value.chat, mic: value.mic, teams: value.teams, zalo: value.zalo } : RECOMMENDED)
  }).catch(() => {})
 }, [])

 if (!grants || (firstRun && reviewed)) return null
 const save = async () => {
  try {
   await window.lingua.setPermissions(grants)
   setReviewed(true)
   setMessage('Đã lưu quyền.')
   onSaved?.(grants)
  } catch {
   setMessage('Chưa lưu được quyền. Anh thử lại.')
  }
 }

 const granted = ITEMS.filter(item => grants[item.key]).length
 // Collapsed to one line until needed, like the provider cards; the pill says whether it was saved.
 return <details className={firstRun ? 'notice provider-card permissions-panel permissions-first-run' : 'notice provider-card permissions-panel'}>
  <summary>{firstRun ? 'Chọn quyền cho LinguaHub' : 'Quyền'} <span className={reviewed ? 'provider-pill provider-pill-on' : 'provider-pill'}>{reviewed ? `Đã cấp ${granted}/${ITEMS.length}` : 'Chưa lưu'}</span></summary>
  <p className="helper-text">Tick quyền muốn cấp một lần, app sẽ không hỏi lại.{firstRun ? ' Đổi lại sau trong Cài đặt.' : ''}</p>
  <div className="permissions-list">
   {ITEMS.map(item => <label key={item.key} className="checkbox-label permissions-item">
    <input type="checkbox" checked={grants[item.key]} onChange={event => { const checked = event.target.checked; setMessage(''); setGrants(previous => previous && { ...previous, [item.key]: checked }) }} />
    <span><strong>{item.label}</strong><small>{item.hint}</small></span>
   </label>)}
  </div>
  <div className="settings-actions"><button type="button" className="primary-button" onClick={() => void save()}>{firstRun ? 'Lưu và bắt đầu' : 'Lưu quyền'}</button></div>
  {message && <p className="helper-text" role="status">{message}</p>}
  <p className="helper-text">ChatGPT và các dịch vụ AI bên ngoài vẫn cần anh đồng ý riêng trước khi gửi chữ.</p>
 </details>
}
