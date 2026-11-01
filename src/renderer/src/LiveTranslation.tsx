import { useEffect, useRef, useState } from 'react'
import { BrowserOcr } from './browser-ocr'
import { TranslationCache } from '../../shared/translation-cache'

type MessageStatus = 'confirming' | 'waiting-model' | 'waiting-consent' | 'translating' | 'translated' | 'needs-review' | 'failed'
type TranslationValue = { translation: string; explanation: string }
type VisibleMessage = { key: string; text: string; confidence: number; side: 'left' | 'right' | 'center'; status: MessageStatus; value?: TranslationValue }
type TranslationBatch = { translations: Array<{ id: string; translation: string; explanation: string }> }

function messageKey(text: string) { return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }

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
          const observedThisScan = new Set<string>()
          for (const item of result.messages) {
            const key = messageKey(item.text)
            if (observedThisScan.has(key)) continue
            observedThisScan.add(key)
            observations.set(key, (observations.get(key) || 0) + 1)
          }
          for (const key of observations.keys()) if (!observedThisScan.has(key)) observations.delete(key)
          const signature = JSON.stringify([result.conversationId, result.messages.map(item => messageKey(item.text))])
          if (signature === lastSnapshot) unchangedScans++
          else { unchangedScans = 0; lastSnapshot = signature }
          nextDelay = unchangedScans >= 6 ? 10000 : unchangedScans >= 3 ? 6000 : 2200

          const visible = result.messages.map((item, index): VisibleMessage => {
            const key = messageKey(item.text)
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

  return <div className="notice live-translation">
    <b>Dịch tin nhắn đang hiển thị</b>
    <p role="status">{enabled ? '● ' : ''}{status}</p>
    <label>Bỏ phần bên trái website: {left}%<input type="range" min="0" max="80" value={left} disabled={enabled} onChange={event => setLeft(Number(event.target.value))}/></label>
    <p>{model.startsWith('chatgpt:') ? 'Ảnh OCR luôn xử lý cục bộ và không gửi lên cloud. Nếu anh cho phép riêng, chữ nhận dạng sẽ được gửi đến OpenAI để dịch tự động; dừng OCR để ngừng gửi.' : model ? 'Ảnh OCR luôn xử lý cục bộ. Chữ nhận dạng được dịch trên máy bằng Ollama.' : 'OCR chỉ nhận dạng vùng chat đang hiển thị; chọn ChatGPT hoặc kết nối Ollama để tự dịch.'} Tin dưới 65% độ tin cậy không gửi đi dịch. Người gửi được ước lượng theo vị trí bong bóng.</p>
    <button onClick={() => void toggle().catch(() => setStatus('Không bật được OCR.'))}>{enabled ? 'Dừng OCR' : 'Cho phép và bật OCR'}</button>
    {messages.map((item,index) => <article className="translation-message" key={`${index}:${item.key}`}>
      <small>{item.side === 'left' ? 'Bên trái' : item.side === 'right' ? 'Bên phải' : 'Ở giữa'} · OCR {Math.round(item.confidence)}%</small>
      <p className="translation-original">{item.text}</p>
      <button disabled={item.status === 'needs-review' || item.status === 'confirming'} onClick={() => window.dispatchEvent(new CustomEvent('linguahub:coach-text', { detail: item.text }))}>Học câu này</button>
      {item.value ? <p className="translation-vietnamese">{item.value.translation}</p> : <small>{item.status === 'needs-review' ? 'Cần kiểm tra OCR' : item.status === 'waiting-consent' ? 'Chờ quyền gửi chữ OCR đến ChatGPT' : item.status === 'waiting-model' ? 'Chờ chọn model' : item.status === 'failed' ? 'Dịch lỗi' : item.status === 'confirming' ? 'Xác nhận nội dung tin' : 'Đang chờ dịch'}</small>}
      {item.value?.explanation ? <details><summary>Giải thích</summary><p>{item.value.explanation}</p></details> : null}
    </article>)}
    {messages.length ? <details><summary>Văn bản OCR gốc</summary><pre className="ai-result">{messages.map(item=>item.text).join('\n')}</pre></details> : null}
  </div>
}

function sourceByIdHasText(sourceById: Map<string, VisibleMessage>, item: VisibleMessage) {
  for (const source of sourceById.values()) if (source.key === item.key || source.text === item.text) return true
  return false
}
