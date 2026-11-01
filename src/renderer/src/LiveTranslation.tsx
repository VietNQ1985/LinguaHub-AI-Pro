import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TranslationCache } from '../../shared/translation-cache'
import { messageIdentityKeys } from '../../shared/message-identity'
import { FALLBACK_TRANSLATION_SCAN_MS, IDLESS_MESSAGE_CONFIRMATION_MS, MAX_TRANSLATION_BATCH_MESSAGES, newestFirst, translationCacheScope } from '../../shared/translation-policy'

type MessageStatus = 'confirming' | 'waiting-model' | 'waiting-consent' | 'translating' | 'translated' | 'not-english' | 'needs-review' | 'failed'
type TranslationValue = { translation: string; explanation: string }
type VisibleMessage = { key: string; id?: string; text: string; side: 'left' | 'right' | 'center'; status: MessageStatus; value?: TranslationValue; timing?: { detectedMs: number; confirmationMs: number; readyAt: number; source: 'event' | 'poll' | 'initial' } }
type TranslationBatch = { translations: Array<{ id: string; translation: string; explanation: string }> }
type ScanTrigger = { source: 'event' | 'poll' | 'initial' | 'confirmation' | 'completion' | 'retry'; observedAt?: number }
type TimingSample = { detectedMs: number; confirmationMs: number; aiWaitMs: number; aiProcessMs: number; uiUpdateMs: number; source: 'event' | 'poll' | 'initial'; messageCount: number; responseAt: number }
type ChatSnapshot = { conversationId: string; text: string; messages: Array<{ text: string; side: 'left' | 'right' | 'center'; id?: string }> }

export function LiveTranslation({ model }: { model: string }) {
  const [enabled, setEnabled] = useState(false)
  const [backgroundCloudAccess, setBackgroundCloudAccess] = useState<{ model: string; allowed: boolean } | null>(null)
  const [status, setStatus] = useState('Đang tắt đọc tin nhắn')
  const [messages, setMessages] = useState<VisibleMessage[]>([])
  const [timings, setTimings] = useState<TimingSample[]>([])
  const cache = useRef(new TranslationCache<TranslationValue>(300, 600000))
  const workspaceVersion = useRef(0)
  const conversationVersion = useRef(0)
  const conversationId = useRef<string | null>(null)
  const currentBatch = useRef<string | null>(null)
  const failed = useRef(new Set<string>())
  const latestSnapshot = useRef<{ version: number; messages: VisibleMessage[] } | null>(null)
  const pendingUiTiming = useRef<Omit<TimingSample, 'uiUpdateMs'> | null>(null)
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
    setStatus('Chờ anh xác nhận gửi chữ tin nhắn hiển thị đến ChatGPT…')
    void window.lingua.allowBackgroundCloud().then(allowed => {
      if (cancelled) return
      setBackgroundCloudAccess({ model, allowed })
      setStatus(allowed ? 'Đã cho phép dịch chữ tin nhắn hiển thị bằng ChatGPT' : 'Chưa cho phép gửi chữ tin nhắn hiển thị đến ChatGPT')
    }).catch(error => {
      if (cancelled) return
      setBackgroundCloudAccess({ model, allowed: false })
      setStatus(error instanceof Error ? error.message : 'Không xác nhận được quyền dịch ChatGPT.')
    })
    return () => { cancelled = true }
  }, [enabled, model, backgroundCloudAccess?.model])

  const cancelBatch = () => {
    const id = currentBatch.current
    currentBatch.current = null
    if (id) void window.lingua.cancelAi(id).catch(() => {})
  }

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let scanning = false
    let rescanRequested = false
    let pendingTrigger: ScanTrigger = { source: 'event' }
    let scanTimer: ReturnType<typeof setTimeout> | undefined
    let scanDueAt = Number.POSITIVE_INFINITY
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    let lastScanCompletedAt = 0
    let lastSnapshotSignature = ''
    let latestObservedAt: number | undefined
    const observations = new Map<string, { firstSeenAt: number; detectedMs: number; source: 'event' | 'poll' | 'initial' }>()

    const cacheScope = (item: Pick<VisibleMessage, 'id' | 'key'>) => translationCacheScope(conversationId.current || '', item.id)
    const failureKey = (item: Pick<VisibleMessage, 'id' | 'key' | 'text'>) => JSON.stringify([activeModel, cacheScope(item), item.text])
    const commitMessages = (next: VisibleMessage[]) => {
      setMessages(current => sameMessages(current, next) ? current : next)
    }
    const scheduleScan = (delay: number, trigger: ScanTrigger) => {
      if (cancelled) return
      pendingTrigger = trigger
      const dueAt = Date.now() + delay
      if (scanTimer !== undefined && scanDueAt <= dueAt) return
      if (scanTimer !== undefined) clearTimeout(scanTimer)
      scanDueAt = dueAt
      scanTimer = setTimeout(() => {
        scanTimer = undefined
        scanDueAt = Number.POSITIVE_INFINITY
        const next = pendingTrigger
        pendingTrigger = { source: 'event' }
        void scan(next)
      }, Math.max(0, delay))
    }

    const translatePending = (items: VisibleMessage[], version: number) => {
      if (cancelled || currentBatch.current || !activeModel) return
      // The newest confirmed bubble is sent first; a small batch bounds the
      // first visible result while keeping old visible messages in the queue.
      const pending = newestFirst(items.filter(item => item.status === 'translating'), MAX_TRANSLATION_BATCH_MESSAGES)
      if (!pending.length) return

      const requestMessages: Array<{ id: string; text: string }> = []
      const sourceById = new Map<string, VisibleMessage>()
      for (const item of pending) {
        const id = `m${requestMessages.length}`
        const candidate = [...requestMessages, { id, text: item.text.slice(0, 4000) }]
        if (JSON.stringify({ messages: candidate }).length > 11000) break
        requestMessages.push(candidate.at(-1)!)
        sourceById.set(id, item)
      }
      if (!requestMessages.length) return
      const requestId = crypto.randomUUID()
      const requestStartedAt = Date.now()
      const primary = sourceById.get('m0')!
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
            cache.current.set(activeModel, source.text, translated, Date.now(), cacheScope(source))
          }
          if (values.size !== sourceById.size) throw new Error('AI không trả đủ bản dịch cho các tin mới.')
          const responseAt = Date.now()
          pendingUiTiming.current = {
            detectedMs: primary.timing?.detectedMs ?? 0,
            confirmationMs: primary.timing?.confirmationMs ?? 0,
            aiWaitMs: Math.max(0, requestStartedAt - (primary.timing?.readyAt ?? requestStartedAt)),
            aiProcessMs: Math.max(0, responseAt - requestStartedAt),
            source: primary.timing?.source ?? 'poll',
            messageCount: values.size,
            responseAt,
          }
          const updated = itemsWithTranslations(latestSnapshot.current?.messages || [], values)
          latestSnapshot.current = { version, messages: updated }
          commitMessages(updated)
          setStatus('Đang theo dõi tin nhắn hiển thị')
        })
        .catch(error => {
          if (cancelled || currentBatch.current !== requestId || version !== conversationVersion.current) return
          for (const source of sourceById.values()) failed.current.add(failureKey(source))
          const updated = (latestSnapshot.current?.messages || []).map(item => sourceByIdHasItem(sourceById, item) ? { ...item, status: 'failed' as const } : item)
          latestSnapshot.current = { version, messages: updated }
          commitMessages(updated)
          setStatus(error instanceof Error ? `Dịch chưa thành công: ${error.message}` : 'Dịch chưa thành công.')
        })
        .finally(() => {
          if (currentBatch.current !== requestId) return
          currentBatch.current = null
          const latest = latestSnapshot.current
          if (latest && latest.version === conversationVersion.current) {
            const refreshed = latest.messages.map(item => {
              const cached = cache.current.get(activeModel, item.text, Date.now(), cacheScope(item))
              if (cached) return { ...item, status: cached.translation.trim() ? 'translated' as const : 'not-english' as const, value: cached }
              if (failed.current.has(failureKey(item))) return { ...item, status: 'failed' as const }
              return item
            })
            latestSnapshot.current = { ...latest, messages: refreshed }
            commitMessages(refreshed)
            translatePending(refreshed, latest.version)
          }
        })
    }

    async function scan(trigger: ScanTrigger) {
      if (cancelled) return
      if (scanning) {
        rescanRequested = true
        pendingTrigger = trigger
        return
      }
      scanning = true
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
      const scanStartedAt = Date.now()
      const version = workspaceVersion.current
      try {
        const result = await window.lingua.readVisibleChat() as ChatSnapshot | null
        if (cancelled) return
        if (version !== workspaceVersion.current) {
          scheduleScan(0, { source: 'event', observedAt: latestObservedAt })
          return
        }
        if (!result) {
          setStatus('Chờ mở WhatsApp hoặc Teams')
          return
        }
        if (result.conversationId && conversationId.current && result.conversationId !== conversationId.current) {
          conversationVersion.current++
          cancelBatch()
          failed.current.clear()
          observations.clear()
          lastSnapshotSignature = ''
          latestSnapshot.current = null
          commitMessages([])
          setStatus('Đã đổi cuộc trò chuyện, cập nhật bản dịch…')
        }
        if (result.conversationId) conversationId.current = result.conversationId
        const currentVersion = conversationVersion.current
        const keys = messageIdentityKeys(result.messages)
        const signature = JSON.stringify([result.conversationId, keys])
        const capturedAt = Date.now()
        const changed = signature !== lastSnapshotSignature
        const triggerAt = trigger.source === 'event' ? trigger.observedAt : undefined
        const estimatedDetectionMs = trigger.source === 'initial' ? 0 : triggerAt !== undefined
          ? Math.max(0, capturedAt - triggerAt)
          : Math.max(0, capturedAt - (lastScanCompletedAt || scanStartedAt))
        const observedKeys = new Set(keys)
        for (const key of observations.keys()) if (!observedKeys.has(key)) observations.delete(key)

        let nextConfirmDelay = Number.POSITIVE_INFINITY
        const visible = result.messages.map((item, index): VisibleMessage => {
          const key = keys[index]
          const candidate = { key, id: item.id, text: item.text, side: item.side }
          const cached = activeModel ? cache.current.get(activeModel, item.text, capturedAt, cacheScope(candidate)) : undefined
          const failedKey = failureKey(candidate)
          if (cached) return { ...candidate, status: cached.translation.trim() ? 'translated' : 'not-english', value: cached }
          if (!activeModel) return { ...candidate, status: model.startsWith('chatgpt:') ? 'waiting-consent' : 'waiting-model' }
          if (failed.current.has(failedKey)) return { ...candidate, status: 'failed' }
          if (item.id) return { ...candidate, status: 'translating', timing: { detectedMs: estimatedDetectionMs, confirmationMs: 0, readyAt: capturedAt, source: trigger.source === 'event' ? 'event' : trigger.source === 'initial' ? 'initial' : 'poll' } }

          const observation = observations.get(key)
          if (observation && capturedAt - observation.firstSeenAt >= IDLESS_MESSAGE_CONFIRMATION_MS) {
            observations.delete(key)
            return { ...candidate, status: 'translating', timing: { detectedMs: observation.detectedMs, confirmationMs: capturedAt - observation.firstSeenAt, readyAt: capturedAt, source: observation.source } }
          }
          if (observation) nextConfirmDelay = Math.min(nextConfirmDelay, IDLESS_MESSAGE_CONFIRMATION_MS - (capturedAt - observation.firstSeenAt))
          else {
            observations.set(key, { firstSeenAt: capturedAt, detectedMs: estimatedDetectionMs, source: trigger.source === 'event' ? 'event' : trigger.source === 'initial' ? 'initial' : 'poll' })
            nextConfirmDelay = Math.min(nextConfirmDelay, IDLESS_MESSAGE_CONFIRMATION_MS)
          }
          return { ...candidate, status: 'confirming' }
        })
        lastSnapshotSignature = signature
        latestSnapshot.current = { version: currentVersion, messages: visible }
        commitMessages(visible)
        if (!visible.length) setStatus('Chưa thấy tin nhắn trong vùng chat đang mở')
        else if (!activeModel) setStatus(model.startsWith('chatgpt:') ? 'Cần cho phép gửi chữ tin nhắn hiển thị đến ChatGPT để tự dịch' : 'Đã đọc tin nhắn. Chọn ChatGPT hoặc kết nối Ollama để tự dịch')
        else {
          if (visible.some(item => item.status === 'confirming')) setStatus('Đang kiểm tra tin mới…')
          else if (!currentBatch.current) setStatus('Đang theo dõi tin nhắn hiển thị')
          translatePending(visible, currentVersion)
        }
        if (nextConfirmDelay !== Number.POSITIVE_INFINITY) scheduleScan(Math.max(0, nextConfirmDelay), { source: 'confirmation' })
        if (changed) lastScanCompletedAt = capturedAt
      } catch (error) {
        if (!cancelled) setStatus(getChatReadFailureMessage(error))
      } finally {
        scanning = false
        if (cancelled) return
        lastScanCompletedAt = Date.now()
        if (rescanRequested) {
          rescanRequested = false
          scheduleScan(0, pendingTrigger)
        } else {
          if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
          fallbackTimer = setTimeout(() => {
            fallbackTimer = undefined
            void scan({ source: 'poll' })
          }, FALLBACK_TRANSLATION_SCAN_MS)
        }
      }
    }

    const changed = window.lingua.onVisibleChatChanged(change => {
      latestObservedAt = change.observedAt
      scheduleScan(0, { source: 'event', observedAt: change.observedAt })
    })
    const workspaceReset = () => {
      workspaceVersion.current++
      conversationVersion.current++
      conversationId.current = null
      latestSnapshot.current = null
      lastSnapshotSignature = ''
      observations.clear()
      failed.current.clear()
      cancelBatch()
      commitMessages([])
      setStatus('Đã đổi dịch vụ, chờ khung chat mới')
      scheduleScan(0, { source: 'event', observedAt: latestObservedAt })
    }
    const stopForDashboard = () => {
      workspaceVersion.current++
      conversationVersion.current++
      conversationId.current = null
      latestSnapshot.current = null
      lastSnapshotSignature = ''
      observations.clear()
      failed.current.clear()
      cache.current.clear()
      cancelBatch()
      setEnabled(false)
      setBackgroundCloudAccess(null)
      commitMessages([])
      setStatus('Đã về tổng quan; đọc tin nhắn đã dừng')
      void window.lingua.stopVisibleChatRead()
    }
    const retry = () => {
      failed.current.clear()
      scheduleScan(0, { source: 'retry' })
    }
    window.addEventListener('linguahub:workspace', workspaceReset)
    window.addEventListener('linguahub:dashboard', stopForDashboard)
    window.addEventListener('linguahub:retry-translation', retry)
    void scan({ source: 'initial' })
    return () => {
      cancelled = true
      changed()
      window.removeEventListener('linguahub:workspace', workspaceReset)
      window.removeEventListener('linguahub:dashboard', stopForDashboard)
      window.removeEventListener('linguahub:retry-translation', retry)
      if (scanTimer !== undefined) clearTimeout(scanTimer)
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
      cancelBatch()
      failed.current.clear()
    }
  }, [enabled, activeModel, model])

  useLayoutEffect(() => {
    const pending = pendingUiTiming.current
    if (!pending) return
    pendingUiTiming.current = null
    setTimings(current => [...current, { ...pending, uiUpdateMs: Math.max(0, Date.now() - pending.responseAt) }].slice(-40))
  }, [messages])

  useEffect(() => () => { void window.lingua.stopVisibleChatRead() }, [])

  const toggle = async () => {
    if (enabled) {
      setEnabled(false)
      cache.current.clear()
      failed.current.clear()
      latestSnapshot.current = null
      setMessages([])
      await window.lingua.stopVisibleChatRead()
      setBackgroundCloudAccess(null)
      setStatus('Đọc tin nhắn đã dừng')
      return
    }
    if (await window.lingua.authorizeVisibleChatRead()) { conversationId.current = null; setMessages([]); setEnabled(true) }
  }

  const hasFailures = messages.some(item => item.status === 'failed')
  const skippedCount = messages.filter(item => item.status === 'not-english').length
  const translatableMessages = messages.filter(item => item.status !== 'not-english')
  const lastTiming = timings.at(-1)
  return <div className="live-translation">
    <div className="live-control">
      <span className={enabled ? 'live-dot live-dot-on' : 'live-dot'} aria-hidden="true" />
      <span className="live-state">{enabled ? 'Đang bật dịch tự động' : 'Đã tắt dịch tự động'}</span>
      <button type="button" className={enabled ? 'secondary-button' : 'primary-button'} onClick={() => void toggle().catch(() => setStatus('Không thay đổi được trạng thái dịch.'))}>{enabled ? 'Tạm dừng' : 'Bật dịch'}</button>
    </div>

    <p role="status" className="translation-status">{status}</p>
    {!model && <div className="translation-empty">Anh hãy chọn dịch vụ AI trong <button type="button" className="text-button" onClick={() => window.dispatchEvent(new Event('linguahub:settings'))}>Cài đặt</button> để bắt đầu.</div>}
    {enabled && messages.length === 0 && <div className="translation-empty">Anh mở một cuộc trò chuyện trên WhatsApp hoặc Teams. Bản dịch sẽ xuất hiện ở đây khi ứng dụng nhận diện được tin nhắn.</div>}
    {!enabled && <div className="translation-empty">Sau khi bật dịch, ứng dụng đọc chữ của tin nhắn đang hiển thị ngay trong giao diện chat. Không chụp màn hình.</div>}

    {hasFailures && <button type="button" className="retry-button" onClick={() => { failed.current.clear(); setStatus('Đang thử dịch lại các tin chưa thành công…'); window.dispatchEvent(new Event('linguahub:retry-translation')) }}>↻ Thử dịch lại các tin chưa thành công</button>}

    <div className="translation-list" aria-label="Danh sách bản dịch">
      {skippedCount > 0 && <p className="translation-skipped">Đã bỏ qua {skippedCount} tin không phải tiếng Anh</p>}
      {translatableMessages.map(item => <article className="translation-message" key={item.key}>
        {item.value?.translation.trim()
          ? <>
              <p className="translation-vietnamese" lang="vi">{item.value.translation}</p>
              <details className="translation-details">
                <summary>Xem câu gốc{item.value.explanation ? ' và giải thích' : ''}</summary>
                <p className="translation-source">{item.text}</p>
                {item.value.explanation && <p>{item.value.explanation}</p>}
              </details>
            </>
          : <>
              <p className="translation-original">{item.text}</p>
              <p className="translation-wait">{item.status === 'needs-review' ? 'Chưa đọc rõ — kiểm tra lại' : item.status === 'waiting-consent' ? 'Chờ cho phép ChatGPT' : item.status === 'waiting-model' ? 'Chọn dịch vụ AI' : item.status === 'failed' ? 'Dịch chưa thành công' : item.status === 'confirming' ? 'Đang kiểm tra tin mới…' : 'Đang dịch…'}</p>
            </>}
      </article>)}
      {messages.length > 0 && translatableMessages.length === 0 && <p className="translation-skipped">Chưa có tin tiếng Anh cần dịch.</p>}
    </div>

    <details className="visible-chat-settings">
      <summary>Cách đọc tin nhắn</summary>
      <p>LinguaHub lấy chữ trực tiếp từ DOM của tin nhắn đang hiển thị trên WhatsApp hoặc Teams. Không chụp màn hình; bộ theo dõi DOM chỉ báo khi chat thay đổi, còn adapter cục bộ vẫn kiểm tra vùng hiển thị trước khi đọc.</p>
      {messages.length > 0 && <details><summary>Xem chữ đã đọc</summary><pre>{messages.map(item => item.text).join('\n')}</pre></details>}
      <details>
        <summary>Chẩn đoán tốc độ ({timings.length} mẫu)</summary>
        {lastTiming ? <>
          <p>Tin mới nhất: phát hiện {formatMs(lastTiming.detectedMs)}; xác nhận {formatMs(lastTiming.confirmationMs)}; chờ hàng đợi AI {formatMs(lastTiming.aiWaitMs)}; AI xử lý và trả kết quả {formatMs(lastTiming.aiProcessMs)}; cập nhật giao diện {formatMs(lastTiming.uiUpdateMs)}.</p>
          <p>Trung vị {timings.length} mẫu: phát hiện {formatMs(median(timings.map(item => item.detectedMs)))}; xác nhận {formatMs(median(timings.map(item => item.confirmationMs)))}; chờ AI {formatMs(median(timings.map(item => item.aiWaitMs)))}; xử lý AI {formatMs(median(timings.map(item => item.aiProcessMs)))}; giao diện {formatMs(median(timings.map(item => item.uiUpdateMs)))}.</p>
          <p>Nguồn phát hiện gần nhất: {lastTiming.source === 'event' ? 'sự kiện DOM' : lastTiming.source === 'initial' ? 'mở chat' : 'quét dự phòng'}; một yêu cầu gồm {lastTiming.messageCount} tin.</p>
        </> : <p>Chưa có bản dịch hoàn tất để đo.</p>}
      </details>
    </details>
  </div>
}

function sameMessages(left: VisibleMessage[], right: VisibleMessage[]) {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index]
    return item.key === other.key && item.status === other.status && item.value?.translation === other.value?.translation && item.value?.explanation === other.value?.explanation
  })
}

function itemsWithTranslations(items: VisibleMessage[], values: Map<string, TranslationValue>) {
  return items.map(item => {
    const value = values.get(item.key)
    return value ? { ...item, status: value.translation.trim() ? 'translated' as const : 'not-english' as const, value } : item
  })
}

function sourceByIdHasItem(sourceById: Map<string, VisibleMessage>, item: VisibleMessage) {
  for (const source of sourceById.values()) if (source.key === item.key) return true
  return false
}

function getChatReadFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/not authorized|chưa cho phép/i.test(message)) return 'Anh cần bật quyền đọc chữ tin nhắn hiển thị trước.'
  return 'Chưa đọc được tin nhắn từ trang chat. Anh thử lại hoặc tải lại trang.'
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} giây` : `${Math.round(value)} ms`
}
