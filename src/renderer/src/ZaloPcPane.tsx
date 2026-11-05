import { useCallback, useEffect, useState } from 'react'

type Status = { installed: boolean; running: boolean; connected: boolean; embedded?: boolean }

// Left-hand pane for the Zalo PC tab: Zalo PC keeps its own window (and its call window);
// LinguaHub connects to it, translates the open chat in the right panel and can press its call buttons.
export function ZaloPcPane({ initial }: { initial: Status | null }) {
 const [status, setStatus] = useState<Status | null>(initial)
 const [busy, setBusy] = useState(false)
 const [message, setMessage] = useState('')
 const [embedded, setEmbedded] = useState(initial?.embedded ?? false)
 useEffect(() => { if (initial?.embedded !== undefined) setEmbedded(initial.embedded) }, [initial])
 const toggleEmbed = async () => {
  try { setEmbedded(await window.lingua.embedZaloPc(!embedded)) } catch (failure) { setMessage(clean(failure)) }
 }

 const refresh = useCallback(() => { void window.lingua.zaloPcStatus().then(setStatus).catch(() => {}) }, [])
 useEffect(() => { setStatus(initial) }, [initial])
 useEffect(() => { const timer = setInterval(refresh, 3000); return () => clearInterval(timer) }, [refresh])

 const clean = (failure: unknown) => failure instanceof Error ? failure.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Chưa làm được.'
 const connect = async () => {
  setBusy(true); setMessage('Đang mở Zalo PC…')
  try { const ok = await window.lingua.connectZaloPc(); setMessage(ok ? 'Đã kết nối Zalo PC.' : 'Đã huỷ.') }
  catch (failure) { setMessage(clean(failure)) }
  finally { setBusy(false); refresh() }
 }
 const call = async (kind: 'voice' | 'video') => {
  setMessage('')
  try { await window.lingua.callZaloPc(kind); setMessage(kind === 'voice' ? 'Đã bấm gọi thoại trong Zalo PC.' : 'Đã bấm gọi video trong Zalo PC.') }
  catch (failure) { setMessage(clean(failure)) }
 }

 const connected = !!status?.connected
 // Embedded: Zalo PC's own window fills the area under this strip (calls included).
 if (connected && embedded) return <div className="zalopc-strip">
  <span className="zalopc-state zalopc-state-on">● Zalo PC</span>
  <button type="button" className="secondary-button" onClick={() => void call('voice')}>📞 Gọi thoại</button>
  <button type="button" className="secondary-button" onClick={() => void call('video')}>🎥 Gọi video</button>
  <button type="button" className="text-button" onClick={() => void toggleEmbed()}>Tách ra cửa sổ riêng</button>
  {message && <span className="helper-text" role="status">{message}</span>}
 </div>
 return <div className="zalopc-pane">
  <div className="zalopc-card">
   <h2>Zalo PC</h2>
   <p className="helper-text">Dùng ứng dụng Zalo PC chính thức trên máy. Nhắn tin và gọi trong cửa sổ Zalo PC; LinguaHub dịch cuộc trò chuyện đang mở ở khung bên phải.</p>
   <p className={connected ? 'zalopc-state zalopc-state-on' : 'zalopc-state'} role="status">
    {!status ? 'Đang kiểm tra…' : connected ? '● Đã kết nối Zalo PC' : !status.installed ? 'Chưa thấy Zalo PC trên máy' : status.running ? 'Zalo PC đang chạy nhưng chưa kết nối' : 'Zalo PC chưa mở'}
   </p>
   {!connected && <button type="button" className="primary-button" disabled={busy || !status?.installed} onClick={() => void connect()}>{busy ? 'Đang kết nối…' : status?.running ? 'Mở lại Zalo PC để kết nối' : 'Mở Zalo PC'}</button>}
   {connected && <div className="zalopc-calls">
    <button type="button" className="secondary-button" onClick={() => void call('voice')}>📞 Gọi thoại</button>
    <button type="button" className="secondary-button" onClick={() => void call('video')}>🎥 Gọi video</button>
   </div>}
   {connected && <p className="helper-text">Gọi cho cuộc trò chuyện 1-1 đang mở trong Zalo PC. Bật "Phụ đề" ở khung bên phải để dịch lời nói trong cuộc gọi.</p>}
   {message && <p className="helper-text" role="status">{message}</p>}
   <p className="helper-text">Kết nối chỉ trên máy này (127.0.0.1) và chỉ khi Zalo PC được mở từ LinguaHub.</p>
  </div>
 </div>
}
