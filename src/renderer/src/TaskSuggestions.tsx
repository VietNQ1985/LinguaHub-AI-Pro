import { useEffect, useRef, useState } from 'react'
import { Sparkles, Calendar, Plus, Check, ExternalLink, X, ListTodo } from 'lucide-react'
import type { WorkTask } from './WorkTasks'

type Service = 'whatsapp' | 'teams' | 'outlook' | 'zalo' | 'telegram' | 'zoom' | 'meet'
type Suggestion = WorkTask & { source: NonNullable<WorkTask['source']> }
type Action = { text?: unknown; evidence?: unknown; deadline?: unknown }
type Summary = { actions?: Action[] }

const serviceName = (service: string) =>
  ({
    whatsapp: 'WhatsApp',
    teams: 'Microsoft Teams',
    outlook: 'Outlook',
    zalo: 'Zalo Web',
    telegram: 'Telegram',
    zoom: 'Zoom',
    meet: 'Google Meet'
  }[service] || service)

export function TaskSuggestions({
  service,
  model,
  active = true
}: {
  service: Service | string
  model: string
  active?: boolean
}) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const generation = useRef(0)
  const request = useRef<string | null>(null)
  const lastSourceKey = useRef('')
  const saving = useRef(false)
  const config = useRef({ service, model, active })
  config.current = { service, model, active }

  const invalidate = (reason: string) => {
    generation.current++
    const id = request.current
    request.current = null
    if (id) void window.lingua.cancelAi(id).catch(() => {})
    lastSourceKey.current = ''
    setItems([])
    setBusy(false)
    setSearched(false)
    setMessage(reason)
  }

  useEffect(() => {
    const onVisibleChange = ({ service: changedService }: { service: Service }) => {
      if (changedService === config.current.service) {
        invalidate('Chat/email vừa thay đổi. Anh có thể tạo gợi ý mới từ nội dung hiện tại.')
      }
    }
    const onService = (event: Event) => {
      const next = (event as CustomEvent<string>).detail
      if (next !== config.current.service) {
        invalidate('Đã chuyển ứng dụng. Mở chat/email cần xử lý rồi tạo gợi ý mới.')
      }
    }
    const onWorkspace = () => invalidate('Nội dung chat/email đã tải lại. Hãy tạo gợi ý từ nội dung mới.')
    const stop = window.lingua.onVisibleChatChanged(onVisibleChange)
    window.addEventListener('linguahub:service', onService)
    window.addEventListener('linguahub:workspace', onWorkspace)
    return () => {
      stop()
      window.removeEventListener('linguahub:service', onService)
      window.removeEventListener('linguahub:workspace', onWorkspace)
      generation.current++
      const id = request.current
      request.current = null
      if (id) void window.lingua.cancelAi(id).catch(() => {})
    }
  }, [])

  const previousConfig = useRef({ service, model, active })
  useEffect(() => {
    const previous = previousConfig.current
    previousConfig.current = { service, model, active }
    if (previous.service !== service || previous.model !== model) {
      invalidate('Ứng dụng hoặc mô hình đã đổi. Tạo lại gợi ý trong chat/email hiện tại.')
    } else if (previous.active && !active) {
      invalidate('Đã tạm dừng đọc chat khi anh mở tab Công việc.')
    }
  }, [service, model, active])

  const suggest = async () => {
    if (busy || !model || !active) return
    const version = ++generation.current
    const valid = () =>
      generation.current === version &&
      config.current.active &&
      config.current.service === service &&
      config.current.model === model
    let requestId: string | null = null
    setBusy(true)
    setMessage('')
    try {
      let authorized = await window.lingua.hasVisibleChatReadAuthorization()
      if (!valid()) return
      if (!authorized) {
        authorized = await window.lingua.authorizeVisibleChatRead()
        if (!valid()) return
      }
      if (!authorized) throw new Error('Chưa được cấp quyền đọc chữ chat/email đang hiển thị.')

      const source = await window.lingua.readVisibleChat()
      if (!valid()) return
      if (!source?.conversationId || !source.text.trim()) {
        throw new Error('Chưa đọc được nội dung. Mở một cuộc trò chuyện hoặc email trước.')
      }

      const input = source.text.slice(0, 11000)
      const sourceKey = JSON.stringify([service, model, source.conversationId, input])
      if (lastSourceKey.current === sourceKey) {
        setMessage('Nội dung này đã được gợi ý. Tin nhắn mới sẽ mở lượt gợi ý tiếp theo.')
        return
      }

      if (model.startsWith('chatgpt:')) {
        const cloudAllowed = await window.lingua.allowCloud()
        if (!valid()) return
        if (!cloudAllowed) throw new Error('Chưa cho phép ChatGPT xử lý nội dung này.')
      }

      // Re-read after permission dialogs so a stale conversation is never sent to the model.
      const confirmed = await window.lingua.readVisibleChat()
      if (!valid()) return
      if (!confirmed || confirmed.conversationId !== source.conversationId || confirmed.text !== source.text) {
        throw new Error('Nội dung đã đổi trước khi phân tích. Anh bấm gợi ý lại để dùng nội dung mới nhất.')
      }

      requestId = `tasks-panel-${crypto.randomUUID()}`
      request.current = requestId
      if (!valid() || request.current !== requestId) return
      const result = (await window.lingua.runAi('summary', input, model, requestId)) as Summary
      if (!valid() || request.current !== requestId) return
      request.current = null

      const latest = await window.lingua.readVisibleChat()
      if (!valid()) return
      if (!latest || latest.conversationId !== source.conversationId || latest.text !== source.text) {
        throw new Error('Chat/email đã đổi trong lúc phân tích. Đề xuất cũ đã bị bỏ.')
      }

      const seen = new Set<string>()
      const proposals = (Array.isArray(result?.actions) ? result.actions : [])
        .filter(
          (action): action is { text: string; evidence: string; deadline?: string | null } =>
            typeof action.text === 'string' &&
            !!action.text.trim() &&
            typeof action.evidence === 'string' &&
            !!action.evidence.trim() &&
            input.includes(action.evidence)
        )
        .filter(action => {
          const key = action.text.trim().toLocaleLowerCase('vi')
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, 8)
        .map(action => ({
          title: action.text.trim().slice(0, 200),
          description:
            typeof action.deadline === 'string' && action.deadline.trim()
              ? `Hạn được nhắc trong nội dung: ${action.deadline.trim()}. Anh xác nhận ngày giờ trong chi tiết công việc.`
              : '',
          status: 'todo' as const,
          remindAt: null,
          dueAt: null,
          important: false,
          steps: [],
          source: { service, conversationId: source.conversationId, evidence: action.evidence }
        }))

      lastSourceKey.current = sourceKey
      setSearched(true)
      setItems(proposals)
      setMessage(
        proposals.length
          ? `Có ${proposals.length} gợi ý từ ${serviceName(service)}. Chọn Thêm để lưu vào Công việc.`
          : 'Chưa thấy việc cần làm được nói rõ trong nội dung này.'
      )
    } catch (failure) {
      if (valid()) setMessage(failure instanceof Error ? failure.message : 'Chưa tạo được gợi ý công việc.')
    } finally {
      if (valid()) {
        if (request.current === requestId) request.current = null
        setBusy(false)
      }
    }
  }

  const add = async (item: Suggestion) => {
    if (saving.current || !active) return
    const version = generation.current
    saving.current = true
    setSavingId(item.title)
    try {
      const tasks = await window.lingua.listTasks()
      if (generation.current !== version || !config.current.active) return
      const duplicate = tasks.some(
        task =>
          task.status !== 'done' &&
          task.title.trim().toLocaleLowerCase('vi') === item.title.trim().toLocaleLowerCase('vi')
      )
      if (duplicate) {
        setItems(current => current.filter(candidate => candidate !== item))
        setMessage('Việc này đã có trong danh sách Công việc.')
        return
      }
      await window.lingua.saveTask(item)
      setItems(current => current.filter(candidate => candidate !== item))
      setMessage('Đã thêm vào Công việc. Anh có thể đặt hạn và giờ nhắc ở tab Công việc.')
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : 'Chưa lưu được công việc.')
    } finally {
      saving.current = false
      if (generation.current === version) setSavingId(null)
    }
  }

  const addAll = async () => {
    if (saving.current || !active || items.length === 0) return
    saving.current = true
    setSavingId('all')
    try {
      const tasks = await window.lingua.listTasks()
      let count = 0
      for (const item of items) {
        const isDuplicate = tasks.some(
          t => t.status !== 'done' && t.title.trim().toLocaleLowerCase('vi') === item.title.trim().toLocaleLowerCase('vi')
        )
        if (!isDuplicate) {
          await window.lingua.saveTask(item)
          count++
        }
      }
      setItems([])
      setMessage(`Đã thêm nhanh ${count} công việc vào danh sách.`)
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : 'Chưa lưu được toàn bộ công việc.')
    } finally {
      saving.current = false
      setSavingId(null)
    }
  }

  if (!active) return null

  return (
    <section className="task-panel" aria-label={`Gợi ý công việc từ ${serviceName(service)}`}>
      <header className="task-panel-heading">
        <div className="task-panel-heading-left">
          <Sparkles size={16} className="task-sparkle-icon" />
          <div>
            <h3>Việc cần làm</h3>
            <p>Gợi ý thông minh từ {serviceName(service)}</p>
          </div>
        </div>
        <button
          type="button"
          className="task-panel-manage"
          onClick={() => window.dispatchEvent(new Event('linguahub:open-tasks'))}
        >
          <ListTodo size={13} /> Công việc đã lưu
        </button>
      </header>

      <p className="task-panel-privacy">
        AI chỉ đọc nội dung chat/email đang hiển thị sau khi anh bấm. Anh xem trích dẫn rồi chọn Thêm hoặc Bỏ.
      </p>

      <button
        type="button"
        className="secondary-button task-panel-trigger"
        disabled={!model || busy || searched}
        onClick={() => void suggest()}
      >
        {busy ? 'Đang đọc và tìm việc…' : searched ? 'Đã gợi ý nội dung này' : '⌕ Gợi ý công việc'}
      </button>

      {items.length > 0 && (
        <div className="task-panel-list" aria-label="Đề xuất công việc">
          {items.length > 1 && (
            <div className="task-panel-batch-actions">
              <button
                type="button"
                className="secondary-button task-panel-add-all-btn"
                disabled={!!savingId}
                onClick={() => void addAll()}
              >
                ＋ Thêm tất cả ({items.length})
              </button>
            </div>
          )}
          {items.map(item => (
            <article className="task-panel-item" key={`${item.source.conversationId}:${item.source.evidence}`}>
              <div className="task-panel-copy">
                <strong>{item.title}</strong>
                <blockquote>“{item.source.evidence}”</blockquote>
                {item.description && (
                  <span className="task-panel-deadline-badge">
                    <Calendar size={11} /> {item.description}
                  </span>
                )}
              </div>
              <div className="task-panel-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!!savingId}
                  onClick={() => void add(item)}
                >
                  {savingId === item.title ? 'Đang lưu…' : '＋ Thêm'}
                </button>
                <button
                  type="button"
                  className="task-panel-dismiss"
                  aria-label={`Bỏ gợi ý ${item.title}`}
                  title="Bỏ gợi ý"
                  onClick={() => {
                    setItems(current => current.filter(candidate => candidate !== item))
                    setMessage('Đã bỏ gợi ý này.')
                  }}
                >
                  Bỏ
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {message && (
        <p className="task-panel-status" role="status" aria-live="polite">
          {message}
        </p>
      )}

      {!model && <p className="task-panel-status">Chọn mô hình AI trong Cài đặt để tạo gợi ý.</p>}
    </section>
  )
}
