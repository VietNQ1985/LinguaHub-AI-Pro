import { useEffect, useRef, useState } from 'react'
import { BrowserOcr } from './browser-ocr'
import { TranslationCache } from '../../shared/translation-cache'
import { messageIdentityKeys } from '../../shared/message-identity'

type MessageStatus = 'confirming' | 'waiting-model' | 'waiting-consent' | 'translating' | 'translated' | 'needs-review' | 'failed'
type TranslationValue = { translation: string; explanation: string }
type VisibleMessage = { key: string; text: string; confidence: number; side: 'left' | 'right' | 'center'; status: MessageStatus; value?: TranslationValue }
type TranslationBatch = { translations: Array<{ id: string; translation: string; explanation: string }> }

export function LiveTranslation({ model }: { model: string }) {
  const [enabled, setEnabled] = useState(false)
  const [backgroundCloudAccess, setBackgroundCloudAccess] = useState<{ model: string; allowed: boolean } | null>(null)
  const [left, setLeft] = useState(40)
  const [status, setStatus] = useState('OCR đang dừng')
  const [messages, setMessages] = useState<VisibleMessage[]>([])
  const cache = useRef(new TranslationCache<TranslationValue>())
  const ocrEngine = useRef<BrowserOcr | null>(null)
  const ocrAssets = useRef<{ workerUrl: string; corePath: string } | null>(null)
  if (!ocrEngine.current) ocrEngine.current = new BrowserOcr()
  const workspaceVersion = useRef(0)
  const conversationVersion = useRef(0)
  const conversationId = useRef<string | null>(null)
  const currentBatch = useRef<string | null>(null)
  const failed = useRef(new Set<string>())
  const latestSnapshot = useRef<{ version: number; messages: VisibleMessage[] } | null>(null)
  const activeModel = model.startsWith('chatgpt:')
    ? backgroundCloudAccess?.model === model && backgroundCloudAccess.allowed ? model : ''
    : model

  useEffect(() => {
    if (!model.startsWith('chatgpt:')) {
      if (backgroundCloudAccess) setBackgroundCloudAccess(null)
      return
    }
    if (!enabled || backgroundCloudAccess?.model === model) return
    let cancelled = false
    setStatus('Chờ anh xác nhận gửi chữ OCR đến ChatGPT…')
    void window.lingua.allowBackgroundCloud().then(allowed => {
      if (cancelled) return
      setBackgroundCloudAccess({ model, allowed })
      setStatus(allowed ? 'Đã cho phép dịch chữ OCR bằng ChatGPT' : 'Chưa cho phép gửi chữ OCR đến ChatGPT')
    }).catch(error => {
      if (cancelled) return
      setBackgroundCloudAccess({ model, allowed: false })
      setStatus(error instanceof Error ? error.message : 'Không xác nhận được quyền dịch OCR cloud.')
    })
    return () => { cancelled = true }
  }, [enabled, model, backgroundCloudAccess?.model])

  const cancelBatch = () => {
    const id = currentBatch.current
    currentBatch.current = null
    if (id) void window.lingua.cancelAi(id).catch(() => {})
  }

  useEffect(() => {
    const reset = () => {
      workspaceVersion.current++
      conversationVersion.current++
      conversationId.current = null
      latestSnapshot.current = null
      failed.current.clear()
      cache.current.clear()
      cancelBatch()
      setMessages([])
      setStatus('Đã đổi dịch vụ, chờ khung chat mới')
    }
    window.addEventListener('linguahub:workspace', reset)
    return () => window.removeEventListener('linguahub:workspace', reset)
  }, [])

  useEffect(() => {
    const stopForDashboard = () => {
      workspaceVersion.current++
      conversationVersion.current++
      conversationId.current = null
      latestSnapshot.current = null
      failed.current.clear()
      cache.current.clear()
      cancelBatch()
      setEnabled(false)
      setBackgroundCloudAccess(null)
      setMessages([])
      setStatus('Đã về tổng quan; OCR đã dừng')
      void window.lingua.stopOcr()
    }
    window.addEventListener('linguahub:dashboard', stopForDashboard)
    return () => window.removeEventListener('linguahub:dashboard', stopForDashboard)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let lastSnapshot = ''
    let unchangedScans = 0
    let nextDelay = 2200
    const observations = new Map<string, number>()

    const translatePending = (items: VisibleMessage[], version: number) => {
      if (cancelled || currentBatch.current || !activeModel) return
      const pending = items.filter(item => item.status === 'translating' && item.confidence >= 65)
      if (!pending.length) return

      const requestMessages: Array<{ id: string; text: string }> = []
      const sourceById = new Map<string, VisibleMessage>()
      for (const item of pending.slice(0, 40)) {
        const id = `m${requestMessages.length}`
        const candidate = [...requestMessages, { id, text: item.text.slice(0, 4000) }]
        if (JSON.stringify({ messages: candidate }).length > 11000) break
        requestMessages.push(candidate.at(-1)!)
        sourceById.set(id, item)
      }
      if (!requestMessages.length) return
      const requestId = crypto.randomUUID()
      currentBatch.current = requestId
      setStatus(`Đang dịch ${requestMessages.length} tin nhắn…`)
      void window.lingua.runAi('translateMessages', JSON.stringify({ messages: requestMessages }), activeModel, requestId)
        .then(value => {
          if (cancelled || currentBatch.current !== requestId || version !== conversationVersion.current) return
          const result = value as TranslationBatch
          if (!result || !Array.isArray(result.translations)) throw new Error('Kết quả dịch theo từng tin không hợp lệ.')
          const values = new Map<string, TranslationValue>()
          for (const item of result.translations) {
            const source = sourceById.get(item.id)
            if (!source || typeof item.translation !== 'string' || typeof item.explanation !== 'string') throw new Error('Kết quả dịch không khớp tin nhắn gốc.')
            const translated = { translation: item.translation, explanation: item.explanation }
            values.set(source.key, translated)
            cache.current.set(activeModel, source.text, translated)
          }
          setMessages(current => current.map(item => values.has(item.key) ? { ...item, status: 'translated', value: values.get(item.key) } : item))
          setStatus('Đang theo dõi tin nhắn hiển thị')
        })
        .catch(error => {
          if (cancelled || currentBatch.current !== requestId || version !== conversationVersion.current) return
          for (const source of sourceById.values()) failed.current.add(JSON.stringify([activeModel, source.key]))
          setMessages(current => current.map(item => sourceByIdHasText(sourceById, item) ? { ...item, status: 'failed' } : item))
          setStatus(error instanceof Error ? `Dịch chưa thành công: ${error.message}` : 'Dịch chưa thành công.')
        })
        .finally(() => {
          if (currentBatch.current !== requestId) return
          currentBatch.current = null
          const latest = latestSnapshot.current
          if (latest && latest.version === conversationVersion.current) {
            const refreshed=latest.messages.map(item=>{
              const value=cache.current.get(activeModel,item.text)
              const failedKey=JSON.stringify([activeModel,item.key])
              return {...item,value,status:item.confidence<65?'needs-review':!activeModel?(model.startsWith('chatgpt:')?'waiting-consent':'waiting-model'):value?'translated':failed.current.has(failedKey)?'failed':(observations.get(item.key)||0)<2?'confirming':'translating'} as VisibleMessage
            })
            latestSnapshot.current={...latest,messages:refreshed}
            setMessages(refreshed)
            translatePending(refreshed,latest.version)
          }
        })
    }

    const tick = async () => {
      const version = workspaceVersion.current
      try {
        setStatus('Đang nhận dạng khung chat hiển thị…')
        const capture = await window.lingua.readOcr(left)
        if (cancelled) return
        if (version !== workspaceVersion.current) {
          timer = setTimeout(tick, 250)
          return
        }
        if (!capture) {
          setStatus('Chờ mở WhatsApp hoặc Teams')
          nextDelay = 3500
        } else {
          if (!ocrAssets.current) ocrAssets.current = await window.lingua.getOcrAssetPaths()
          const result = await ocrEngine.current!.recognize(capture, ocrAssets.current)
          if (cancelled) return
          if (result.conversationId && conversationId.current && result.conversationId !== conversationId.current) {
            conversationVersion.current++
            cancelBatch()
            failed.current.clear()
            observations.clear()
            setMessages([])
            setStatus('Đã đổi cuộc trò chuyện, cập nhật bản dịch…')
          }
          if (result.conversationId) conversationId.current = result.conversationId
          const currentVersion = conversationVersion.current
          const keys = messageIdentityKeys(result.messages)
          const observedThisScan = new Set<string>()
          for (const key of keys) {
            observedThisScan.add(key)
            observations.set(key, (observations.get(key) || 0) + 1)
          }
          for (const key of observations.keys()) if (!observedThisScan.has(key)) observations.delete(key)
          const signature = JSON.stringify([result.conversationId, keys])
          if (signature === lastSnapshot) unchangedScans++
          else { unchangedScans = 0; lastSnapshot = signature }
          nextDelay = unchangedScans >= 6 ? 10000 : unchangedScans >= 3 ? 6000 : 2200

          const visible = result.messages.map((item, index): VisibleMessage => {
            const key = keys[index]
            const cached = activeModel ? cache.current.get(activeModel, item.text) : undefined
            const failureKey = JSON.stringify([activeModel, key])
            const messageStatus: MessageStatus = item.confidence < 65 ? 'needs-review' : !activeModel ? model.startsWith('chatgpt:') ? 'waiting-consent' : 'waiting-model' : cached ? 'translated' : failed.current.has(failureKey) ? 'failed' : (observations.get(key) || 0) < 2 ? 'confirming' : 'translating'
            return { key, text: item.text, confidence: item.confidence, side: item.side, status: messageStatus, value: cached }
          })
          latestSnapshot.current = { version: currentVersion, messages: visible }
          setMessages(visible)
          if (!visible.length) setStatus(result.text ? 'Chưa tách được tin nhắn; điều chỉnh khung OCR rồi thử lại' : 'Đang theo dõi, chưa thấy tin nhắn trong khung')
          else if (visible.some(item => item.status === 'needs-review')) setStatus('Có tin OCR độ tin cậy thấp; các tin đó chưa gửi đi dịch')
          else if (visible.some(item => item.status === 'confirming')) setStatus('Đang xác nhận các tin mới qua lần đọc OCR tiếp theo…')
          else if (!activeModel) setStatus(model.startsWith('chatgpt:') ? 'OCR đang chạy; cần cho phép gửi chữ OCR đến ChatGPT để tự dịch' : 'Đã nhận dạng. Chọn ChatGPT hoặc kết nối Ollama để tự dịch')
          else {
            const todo = visible.filter(item => item.status === 'translating')
            if (todo.length) translatePending(visible, currentVersion)
            else setStatus('Đang theo dõi tin nhắn hiển thị')
          }
        }
      } catch (error) {
        if (!cancelled) { setStatus(error instanceof Error ? error.message : 'OCR gặp lỗi'); nextDelay = 6000 }
      }
      if (!cancelled) timer = setTimeout(tick, nextDelay)
    }
    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
      cancelBatch()
      failed.current.clear()
      void ocrEngine.current?.terminate()
    }
  }, [enabled, left, activeModel, model])

  useEffect(() => () => { void window.lingua.stopOcr() }, [])

  const toggle = async () => {
    if (enabled) {
      setEnabled(false)
      cache.current.clear()
      failed.current.clear()
      latestSnapshot.current = null
      setMessages([])
      await window.lingua.stopOcr()
      setBackgroundCloudAccess(null)
      setStatus('OCR đã dừng')
      return
    }
    if (await window.lingua.authorizeOcr()) { conversationId.current = null; setMessages([]); setEnabled(true) }
  }

  const hasFailures = messages.some(item => item.status === 'failed')
  return <div className="live-translation">
    <div className="live-control">
      <span className={enabled ? 'live-dot live-dot-on' : 'live-dot'} aria-hidden="true" />
      <span className="live-state">{enabled ? 'Đang bật dịch tự động' : 'Đã tắt dịch tự động'}</span>
      <button type="button" className={enabled ? 'secondary-button' : 'primary-button'} onClick={() => void toggle().catch(() => setStatus('Không thay đổi được trạng thái dịch.'))}>{enabled ? 'Tạm dừng' : 'Bật dịch'}</button>
    </div>

    <p role="status" className="translation-status">{status.replaceAll('OCR', 'nhận diện chữ')}</p>
    {!model && <div className="translation-empty">Anh hãy chọn dịch vụ AI trong <button type="button" className="text-button" onClick={() => window.dispatchEvent(new Event('linguahub:settings'))}>Cài đặt</button> để bắt đầu.</div>}
    {enabled && messages.length === 0 && <div className="translation-empty">Anh mở một cuộc trò chuyện trên WhatsApp hoặc Teams. Bản dịch sẽ xuất hiện ở đây khi ứng dụng nhận diện được tin nhắn.</div>}
    {!enabled && <div className="translation-empty">Sau khi bật dịch và cấp quyền, ứng dụng sẽ đọc nội dung đang hiển thị trong cửa sổ trò chuyện và dịch sang tiếng Việt.</div>}

    {hasFailures && <button type="button" className="retry-button" onClick={() => { failed.current.clear(); setStatus('Đang thử dịch lại…') }}>↻ Thử dịch lại các tin chưa thành công</button>}

    <div className="translation-list" aria-label="Danh sách bản dịch">
      {messages.map(item => <article className="translation-message" key={item.key}>
        <p className="translation-original">{item.text}</p>
        {item.value
          ? <p className="translation-vietnamese" lang="vi">{item.value.translation}</p>
          : <p className="translation-wait">{item.status === 'needs-review' ? 'Nhận diện chưa rõ, cần kiểm tra' : item.status === 'waiting-consent' ? 'Chờ anh cho phép dịch bằng ChatGPT' : item.status === 'waiting-model' ? 'Chưa chọn dịch vụ AI' : item.status === 'failed' ? 'Chưa dịch được' : item.status === 'confirming' ? 'Đang nhận diện tin nhắn…' : 'Đang dịch…'}</p>}
        {item.value?.explanation && <details className="translation-details"><summary>Xem giải thích</summary><p>{item.value.explanation}</p></details>}
      </article>)}
    </div>

    <details className="ocr-settings">
      <summary>Tùy chỉnh vùng nhận diện</summary>
      <p>Ứng dụng chỉ nhận diện vùng chat đang hiển thị. Nếu bản dịch chứa tên liên hệ hoặc nút điều hướng, anh điều chỉnh vùng bên trái ở đây.</p>
      <label>Ẩn phần bên trái trang: {left}%
        <input type="range" min="0" max="80" value={left} disabled={enabled} onChange={event => setLeft(Number(event.target.value))} />
      </label>
      {enabled && <p>Tạm dừng dịch để điều chỉnh vùng nhận diện.</p>}
      {messages.length > 0 && <details><summary>Xem văn bản đã nhận diện</summary><pre>{messages.map(item => item.text).join('\n')}</pre></details>}
    </details>
  </div>
}

function sourceByIdHasText(sourceById: Map<string, VisibleMessage>, item: VisibleMessage) {
  for (const source of sourceById.values()) if (source.key === item.key) return true
  return false
}
