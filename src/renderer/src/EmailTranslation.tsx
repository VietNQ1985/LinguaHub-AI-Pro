import { useEffect, useRef, useState } from 'react'

/** Email is intentionally user-initiated: never scrape the mailbox in the background. */
export function EmailTranslation({ model }: { model: string }) {
  const [source, setSource] = useState('')
  const [translation, setTranslation] = useState('')
  const [explanation, setExplanation] = useState('')
  const [draft, setDraft] = useState('')
  const [english, setEnglish] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<string | null>(null)
  const generation = useRef(0)

  const cancel = () => {
    generation.current++
    if (request.current) void window.lingua.cancelAi(request.current).catch(() => {})
    request.current = null
    setBusy(false)
  }
  useEffect(() => () => {
    generation.current++
    if (request.current) void window.lingua.cancelAi(request.current).catch(() => {})
  }, [])

  const run = async (kind: 'incoming' | 'outgoing') => {
    const input = (kind === 'incoming' ? source : draft).trim()
    if (!model || input.length < 2 || busy) return
    const id = 'email-' + crypto.randomUUID()
    const current = ++generation.current
    request.current = id
    setBusy(true)
    setError('')
    if (kind === 'incoming') { setTranslation(''); setExplanation('') }
    else setEnglish('')
    try {
      // The existing translate task provides a bilingual result with a short explanation.
      // User-provided email text is data, not instructions to the application.
      const result = await window.lingua.runAi('translate', input, model, id) as { translation?: string; explanation?: string }
      if (current !== generation.current) return
      if (!result?.translation?.trim()) throw new Error('AI chưa trả bản dịch hợp lệ.')
      if (kind === 'incoming') {
        setTranslation(result.translation)
        setExplanation(result.explanation ?? '')
      } else setEnglish(result.translation)
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      if (current === generation.current) { request.current = null; setBusy(false) }
    }
  }

  const copy = async (text: string) => {
    try { await window.lingua.writeClipboardText(text); setError('Đã sao chép. Hãy kiểm tra lại nội dung và người nhận trước khi gửi.') }
    catch { setError('Không thể sao chép nội dung.') }
  }

  return <section className="reply-composer" aria-label="Dịch email Outlook">
    <h3>Dịch email Outlook</h3>
    <p className="helper-text">Chỉ xử lý email anh chủ động dán vào đây. Không đọc hộp thư tự động và không gửi email thay anh.</p>
    <label htmlFor="email-source">Email tiếng Anh</label>
    <textarea id="email-source" value={source} maxLength={11000} onChange={event => { cancel(); setSource(event.target.value); setTranslation(''); setExplanation('') }} placeholder="Dán nội dung email cần dịch…" />
    <div className="composer-actions">
      <button type="button" className="primary-button" disabled={busy || !model || source.trim().length < 2} onClick={() => void run('incoming')}>Dịch sang tiếng Việt</button>
      {translation && <button type="button" className="secondary-button" onClick={() => void copy(translation)}>Sao chép</button>}
    </div>
    {translation && <><label htmlFor="email-vietnamese">Bản dịch tiếng Việt</label><textarea id="email-vietnamese" readOnly value={translation} /></>}
    {explanation && <p className="helper-text">{explanation}</p>}
    <h3>Soạn email trả lời</h3>
    <label htmlFor="email-draft">Nội dung tiếng Việt</label>
    <textarea id="email-draft" maxLength={11000} value={draft} onChange={event => { cancel(); setDraft(event.target.value); setEnglish('') }} placeholder="Viết ý trả lời bằng tiếng Việt…" />
    <div className="composer-actions">
      <button type="button" className="primary-button" disabled={busy || !model || draft.trim().length < 2} onClick={() => void run('outgoing')}>Dịch sang tiếng Anh</button>
      {english && <button type="button" className="secondary-button" onClick={() => void copy(english)}>Sao chép email</button>}
    </div>
    {english && <><label htmlFor="email-english">Email tiếng Anh · có thể chỉnh sửa</label><textarea id="email-english" value={english} onChange={event => setEnglish(event.target.value)} /></>}
    {busy && <button type="button" className="secondary-button" onClick={cancel}>Hủy dịch</button>}
    {!model && <p className="helper-text">Hãy chọn mô hình AI trong Cài đặt.</p>}
    {error && <p className="composer-status" role="status">{error}</p>}
  </section>
}
