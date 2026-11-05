import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2, Circle, Clock, Calendar, AlertCircle, Star,
  Play, Plus, Search, Trash2, ExternalLink, Copy, Check,
  Sparkles, ArrowLeft, CheckSquare, ListTodo, X, Sun,
  RotateCcw, Zap, BarChart2, LayoutList, Columns3, Download,
  Undo2
} from 'lucide-react'

export type TaskSourceSnapshot = {
  conversationId: string
  text: string
  messages: Array<{ text: string; side: 'left' | 'right' | 'center' }>
  service: string
  capturedAt: number
}

export type WorkTask = {
  id?: string
  title: string
  description: string
  status: 'todo' | 'doing' | 'done'
  remindAt: number | null
  dueAt?: number | null
  important?: boolean
  steps?: { id: string; text: string; done: boolean }[]
  source?: { service: string; conversationId: string; evidence: string }
  updatedAt?: number
}

const blank = (): WorkTask => ({
  title: '',
  description: '',
  status: 'todo',
  remindAt: null,
  dueAt: null,
  steps: [],
  important: false
})

const label = (service: string) => ({
  whatsapp: 'WhatsApp',
  teams: 'Microsoft Teams',
  outlook: 'Outlook',
  zalo: 'Zalo Web',
  telegram: 'Telegram',
  zoom: 'Zoom',
  meet: 'Google Meet'
}[service] || service)

const localDate = (time: number | null | undefined) =>
  time ? new Date(time - new Date(time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''

const dayEnd = (now: number) => {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function taskMatches(task: WorkTask, filter: string, now: number) {
  if (filter === 'done') return task.status === 'done'
  if (task.status === 'done') return false
  if (filter === 'important') return !!task.important
  if (filter === 'today') return !!task.dueAt && task.dueAt <= dayEnd(now)
  if (filter === 'overdue') return !!task.dueAt && task.dueAt < now
  if (filter === 'doing') return task.status === 'doing'
  return true
}

export function WorkTasks({
  service,
  model,
  sourceSnapshot,
  onBack
}: {
  service: string
  model: string
  sourceSnapshot?: TaskSourceSnapshot | null
  onBack?: () => void
}) {
  const [rows, setRows] = useState<WorkTask[]>([])
  const [draft, setDraft] = useState<WorkTask | null>(null)
  const [quick, setQuick] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'default' | 'due' | 'updated' | 'title'>('default')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [suggestions, setSuggestions] = useState<WorkTask[]>([])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [step, setStep] = useState('')
  const [copied, setCopied] = useState(false)
  const [clock, setClock] = useState(Date.now())

  const generation = useRef(0)
  const request = useRef<string | null>(null)
  const latestSource = useRef(sourceSnapshot)
  latestSource.current = sourceSnapshot

  const refresh = () => window.lingua.listTasks().then(setRows)

  const cancel = () => {
    generation.current++
    if (request.current) void window.lingua.cancelAi(request.current).catch(() => {})
    request.current = null
    setBusy(false)
  }

  useEffect(() => {
    void refresh().catch(() => setMessage('Chưa đọc được công việc.'))
    const timer = setInterval(() => setClock(Date.now()), 60000)
    return () => {
      clearInterval(timer)
      generation.current++
      if (request.current) void window.lingua.cancelAi(request.current).catch(() => {})
    }
  }, [])

  useEffect(() => {
    cancel()
    setSuggestions([])
  }, [service, model, sourceSnapshot])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const tagName = activeEl?.tagName.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || (activeEl as HTMLElement)?.isContentEditable) {
        if (e.key === 'Escape' && draft) {
          setDraft(null)
        }
        return
      }

      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.task-quick-add input')
        input?.focus()
      } else if (e.key === 'Escape') {
        if (draft) {
          e.preventDefault()
          setDraft(null)
        }
      } else if (e.key === '?') {
        e.preventDefault()
        setMessage('⌨ Phím tắt: N = Thêm việc · Esc = Đóng chi tiết · ? = Trợ giúp')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draft])

  const persist = async (value: WorkTask) => {
    setSaving(true)
    try {
      const saved = await window.lingua.saveTask(value)
      await refresh()
      return saved
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setSaving(false)
    }
  }

  const addSuggestion = async (item: WorkTask) => {
    if (rows.some(row => row.title.trim().toLocaleLowerCase('vi') === item.title.trim().toLocaleLowerCase('vi') && row.status !== 'done')) {
      setMessage('Việc này đã có trong danh sách.')
      return
    }
    const saved = await persist(item)
    if (saved) {
      setSuggestions(items => items.filter(value => value !== item))
      setMessage('Đã thêm công việc. Chọn việc để đặt hạn hoặc giờ nhắc.')
    }
  }

  const addAllSuggestions = async () => {
    if (suggestions.length === 0 || saving) return
    setSaving(true)
    let addedCount = 0
    try {
      for (const item of suggestions) {
        const isDuplicate = rows.some(r => r.title.trim().toLocaleLowerCase('vi') === item.title.trim().toLocaleLowerCase('vi') && r.status !== 'done')
        if (!isDuplicate) {
          await window.lingua.saveTask(item)
          addedCount++
        }
      }
      await refresh()
      setSuggestions([])
      setMessage(`Đã thêm thành công ${addedCount} công việc vào danh sách.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const capture = async () => {
    const version = ++generation.current
    setBusy(true)
    setMessage('')
    setSuggestions([])
    try {
      const cached = sourceSnapshot
      if (cached === null) {
        setMessage('Quay lại chat/email, bật quyền đọc và mở lại Công việc để lấy nguồn.')
        return
      }
      if (!cached && !await window.lingua.hasVisibleChatReadAuthorization() && !await window.lingua.authorizeVisibleChatRead()) return
      const source = cached || await window.lingua.readVisibleChat()
      if (version !== generation.current) return
      if (!source?.text.trim()) throw new Error('Chưa có nội dung nguồn. Mở chat/email rồi vào Công việc.')
      if (model.startsWith('chatgpt:') && !await window.lingua.allowCloud()) return
      if (version !== generation.current) return
      if (cached && latestSource.current !== cached) return
      if (!cached) {
        const check = await window.lingua.readVisibleChat()
        if (version !== generation.current) return
        if (check?.conversationId !== source.conversationId || check.text !== source.text) {
          throw new Error('Nội dung đã đổi. Anh lấy lại nguồn.')
        }
      }
      const id = 'tasks-' + crypto.randomUUID()
      request.current = id
      const value = await window.lingua.runAi('summary', source.text.slice(0, 11000), model, id) as {
        actions?: { text: string; evidence: string; deadline: string | null }[]
      }
      if (version !== generation.current) return
      if (cached && latestSource.current !== cached) return
      if (!cached) {
        const check = await window.lingua.readVisibleChat()
        if (version !== generation.current) return
        if (check?.conversationId !== source.conversationId || check.text !== source.text) {
          throw new Error('Chat/email đã đổi. Đã bỏ đề xuất cũ.')
        }
      }
      const seen = new Set<string>()
      const next = (value.actions || [])
        .filter(a => typeof a.text === 'string' && typeof a.evidence === 'string' && a.evidence.trim() && source.text.includes(a.evidence))
        .filter(a => {
          const key = a.text.trim().toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, 10)
        .map(a => ({
          ...blank(),
          title: a.text.slice(0, 200),
          description: a.deadline ? `Hạn trong nguồn: ${a.deadline}. Cần xác nhận ngày giờ.` : '',
          source: { service, conversationId: source.conversationId, evidence: a.evidence }
        }))
      setSuggestions(next)
      setMessage(next.length ? `Tìm thấy ${next.length} đề xuất. Chỉ lưu những việc anh bấm Thêm.` : 'Không tìm thấy đầu việc rõ ràng trong nguồn.')
    } catch (e) {
      if (version === generation.current) setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      if (version === generation.current) {
        setBusy(false)
        request.current = null
      }
    }
  }

  const exportStandupReport = async () => {
    const todayStr = new Date().toLocaleDateString('vi-VN')
    const done = rows.filter(t => t.status === 'done')
    const doing = rows.filter(t => t.status === 'doing')
    const todo = rows.filter(t => t.status === 'todo')

    let text = `📋 BÁO CÁO CÔNG VIỆC (${todayStr})\n`
    if (done.length > 0) {
      text += `\n✅ ĐÃ HOÀN THÀNH (${done.length}):\n`
      done.forEach(t => { text += `  • ${t.title}\n` })
    }
    if (doing.length > 0) {
      text += `\n⏳ ĐANG THỰC HIỆN (${doing.length}):\n`
      doing.forEach(t => {
        const due = t.dueAt ? ` (Hạn: ${new Date(t.dueAt).toLocaleString('vi-VN')})` : ''
        text += `  • ${t.title}${due}\n`
      })
    }
    if (todo.length > 0) {
      text += `\n📌 CẦN THỰC HIỆN TIẾP THEO (${todo.length}):\n`
      todo.slice(0, 15).forEach(t => {
        const due = t.dueAt ? ` (Hạn: ${new Date(t.dueAt).toLocaleString('vi-VN')})` : ''
        text += `  • ${t.title}${due}\n`
      })
      if (todo.length > 15) text += `  ... và ${todo.length - 15} việc khác.\n`
    }

    try {
      await window.lingua.writeClipboardText(text.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      setMessage('Đã sao chép báo cáo công việc vào bộ nhớ tạm (Clipboard)!')
    } catch {
      setMessage('Không thể sao chép báo cáo.')
    }
  }

  const exportToJSON = async () => {
    try {
      const json = JSON.stringify(rows, null, 2)
      await window.lingua.writeClipboardText(json)
      setMessage(`Đã sao chép ${rows.length} công việc dạng JSON vào clipboard.`)
    } catch {
      setMessage('Không thể sao chép dữ liệu JSON.')
    }
  }

  const exportToCSV = async () => {
    try {
      const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
      const header = 'Tiêu đề,Ghi chú,Trạng thái,Quan trọng,Hạn chót,Nhắc lúc,Nguồn,Số bước'
      const csvRows = rows.map(t => [
        escape(t.title),
        escape(t.description),
        t.status === 'done' ? 'Đã xong' : t.status === 'doing' ? 'Đang làm' : 'Chưa làm',
        t.important ? 'Có' : 'Không',
        t.dueAt ? new Date(t.dueAt).toLocaleString('vi-VN') : '',
        t.remindAt ? new Date(t.remindAt).toLocaleString('vi-VN') : '',
        t.source?.service ? label(t.source.service) : '',
        String(t.steps?.length || 0)
      ].join(','))
      const csv = [header, ...csvRows].join('\r\n')
      await window.lingua.writeClipboardText(csv)
      setMessage(`Đã sao chép ${rows.length} công việc dạng CSV vào clipboard.`)
    } catch {
      setMessage('Không thể sao chép dữ liệu CSV.')
    }
  }

  const clearCompleted = async () => {
    const completedTasks = rows.filter(r => r.status === 'done')
    if (completedTasks.length === 0) return
    if (!window.confirm(`Xóa tất cả ${completedTasks.length} công việc đã hoàn thành?`)) return
    setSaving(true)
    try {
      for (const t of completedTasks) {
        if (t.id) await window.lingua.deleteTask(t.id)
      }
      await refresh()
      setMessage(`Đã dọn sạch ${completedTasks.length} công việc đã xong.`)
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
    }
  }

  const navigateToSource = (serviceName: string) => {
    window.dispatchEvent(new CustomEvent('linguahub:open-app', { detail: serviceName }))
  }

  // Quick preset dates for Due Date
  const setDuePreset = (type: 'today_18' | 'tomorrow_12' | 'friday_17' | 'monday_9' | 'clear') => {
    if (!draft) return
    if (type === 'clear') {
      setDraft({ ...draft, dueAt: null })
      return
    }
    const d = new Date()
    if (type === 'today_18') {
      d.setHours(18, 0, 0, 0)
    } else if (type === 'tomorrow_12') {
      d.setDate(d.getDate() + 1)
      d.setHours(12, 0, 0, 0)
    } else if (type === 'friday_17') {
      const day = d.getDay()
      const diff = (5 - day + 7) % 7 || 7
      d.setDate(d.getDate() + diff)
      d.setHours(17, 0, 0, 0)
    } else if (type === 'monday_9') {
      const day = d.getDay()
      const diff = (1 - day + 7) % 7 || 7
      d.setDate(d.getDate() + diff)
      d.setHours(9, 0, 0, 0)
    }
    setDraft({ ...draft, dueAt: d.getTime() })
  }

  const addStepToDraft = () => {
    if (!draft || !step.trim() || (draft.steps?.length || 0) >= 30) return
    setDraft({
      ...draft,
      steps: [...(draft.steps || []), { id: crypto.randomUUID(), text: step.trim(), done: false }]
    })
    setStep('')
  }

  const filtered = rows
    .filter(row =>
      taskMatches(row, filter, clock) &&
      (sourceFilter === 'all' || row.source?.service === sourceFilter) &&
      `${row.title} ${row.description} ${row.source?.evidence || ''}`
        .toLocaleLowerCase('vi')
        .includes(query.toLocaleLowerCase('vi'))
    )
    .sort((a, b) => {
      if (sortBy === 'due') {
        return (a.dueAt || Infinity) - (b.dueAt || Infinity)
      }
      if (sortBy === 'updated') {
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title, 'vi')
      }
      // default: important first, then closest due date
      return Number(!!b.important) - Number(!!a.important) || (a.dueAt || Infinity) - (b.dueAt || Infinity)
    })

  const active = rows.filter(r => r.status !== 'done')
  const completed = rows.filter(r => r.status === 'done')
  const overdue = active.filter(r => !!r.dueAt && r.dueAt < clock)
  const doing = active.filter(r => r.status === 'doing')
  const totalCount = rows.length
  const completionRate = totalCount ? Math.round((completed.length / totalCount) * 100) : 0

  const snooze = (item: WorkTask, hours: number) =>
    void persist({ ...item, remindAt: Date.now() + hours * 3600000 })

  const toggleDoing = (item: WorkTask) =>
    void persist({ ...item, status: item.status === 'doing' ? 'todo' : 'doing' })

  return (
    <section className="task-center" aria-label="Quản lý công việc">
      <header className="task-center-header">
        <div className="task-center-header-main">
          <p className="task-eyebrow">KHÔNG GIAN LÀM VIỆC & NHẮC VIỆC THÔNG MINH</p>
          <h1>Công việc của tôi</h1>
          <div className="task-stats-summary">
            <span className="stat-pill stat-active">{active.length} việc cần làm</span>
            {doing.length > 0 && <span className="stat-pill stat-doing">◉ {doing.length} đang làm</span>}
            {overdue.length > 0 && <span className="stat-pill stat-overdue">◷ {overdue.length} quá hạn</span>}
            <span className="stat-pill stat-done">✓ {completed.length} đã xong ({completionRate}%)</span>
          </div>
        </div>
        <div className="task-header-actions">
          <button
            type="button"
            className="secondary-button task-export-btn"
            title="Sao chép báo cáo công việc để gửi Zalo / Teams / Email"
            onClick={() => void exportStandupReport()}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Đã chép báo cáo!' : 'Sao chép báo cáo'}
          </button>
          <button
            type="button"
            className="secondary-button task-export-btn"
            title="Xuất dữ liệu dạng JSON"
            onClick={() => void exportToJSON()}
          >
            <Download size={15} /> JSON
          </button>
          <button
            type="button"
            className="secondary-button task-export-btn"
            title="Xuất dữ liệu dạng CSV để mở Excel"
            onClick={() => void exportToCSV()}
          >
            <Download size={15} /> CSV
          </button>
          <button type="button" className="secondary-button" onClick={onBack}>
            <ArrowLeft size={16} /> Quay lại {label(service)}
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="task-progress-card" aria-label="Tiến độ hoàn thành công việc">
          <div className="task-progress-label">
            <span>Tiến độ thực hiện: <strong>{completed.length}/{totalCount} công việc ({completionRate}%)</strong></span>
            {completionRate === 100 && <span className="task-progress-congrats">🎉 Đã hoàn thành tất cả công việc!</span>}
          </div>
          <div className="task-progress-track">
            <div className="task-progress-fill" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      )}

      <div className="task-center-layout">
        <nav className="task-sidebar" aria-label="Lọc công việc">
          <button
            type="button"
            aria-pressed={filter === 'all'}
            className={filter === 'all' ? 'selected' : ''}
            onClick={() => setFilter('all')}
          >
            <span className="sidebar-label"><ListTodo size={16} /> Tất cả</span>
            <span className="sidebar-count">{rows.filter(r => taskMatches(r, 'all', clock)).length}</span>
          </button>
          <button
            type="button"
            aria-pressed={filter === 'today'}
            className={filter === 'today' ? 'selected' : ''}
            onClick={() => setFilter('today')}
          >
            <span className="sidebar-label"><Sun size={16} /> Hôm nay</span>
            <span className="sidebar-count">{rows.filter(r => taskMatches(r, 'today', clock)).length}</span>
          </button>
          <button
            type="button"
            aria-pressed={filter === 'important'}
            className={filter === 'important' ? 'selected' : ''}
            onClick={() => setFilter('important')}
          >
            <span className="sidebar-label"><Star size={16} /> Quan trọng</span>
            <span className="sidebar-count">{rows.filter(r => taskMatches(r, 'important', clock)).length}</span>
          </button>
          <button
            type="button"
            aria-pressed={filter === 'overdue'}
            className={filter === 'overdue' ? 'selected' : ''}
            onClick={() => setFilter('overdue')}
          >
            <span className="sidebar-label"><Clock size={16} /> Quá hạn</span>
            <span className="sidebar-count">{rows.filter(r => taskMatches(r, 'overdue', clock)).length}</span>
          </button>
          <button
            type="button"
            aria-pressed={filter === 'doing'}
            className={filter === 'doing' ? 'selected' : ''}
            onClick={() => setFilter('doing')}
          >
            <span className="sidebar-label"><Play size={16} /> Đang làm</span>
            <span className="sidebar-count">{rows.filter(r => taskMatches(r, 'doing', clock)).length}</span>
          </button>
          <button
            type="button"
            aria-pressed={filter === 'done'}
            className={filter === 'done' ? 'selected' : ''}
            onClick={() => setFilter('done')}
          >
            <span className="sidebar-label"><CheckCircle2 size={16} /> Đã xong</span>
            <span className="sidebar-count">{rows.filter(r => taskMatches(r, 'done', clock)).length}</span>
          </button>

          <p className="task-sidebar-note">
            Danh sách lưu an toàn trên máy này. Nhắc việc tự động hiển thị qua Windows Toast khi đến giờ.
          </p>
          <p className="task-sidebar-note task-shortcuts-note">
            ⌨ <strong>N</strong> thêm việc · <strong>Esc</strong> đóng · <strong>?</strong> trợ giúp
          </p>

          {filter === 'done' && completed.length > 0 && (
            <button type="button" className="task-clear-completed-btn" onClick={() => void clearCompleted()}>
              <Trash2 size={14} /> Dọn việc đã xong ({completed.length})
            </button>
          )}
        </nav>

        <main className="task-main">
          <div className="task-tools">
            <div className="task-search-wrapper">
              <Search size={16} className="task-search-icon" />
              <input
                aria-label="Tìm công việc"
                placeholder="Tìm tên việc, ghi chú hoặc trích dẫn…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="task-search-clear" onClick={() => setQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              aria-label="Lọc nguồn"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
            >
              <option value="all">Mọi nguồn</option>
              {[...new Set(rows.flatMap(r => (r.source ? [r.source.service] : [])))].map(s => (
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </select>

            <select
              aria-label="Sắp xếp"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="default">Sắp xếp: Quan trọng & Hạn</option>
              <option value="due">Sắp xếp: Hạn chót sớm nhất</option>
              <option value="updated">Sắp xếp: Cập nhật mới nhất</option>
              <option value="title">Sắp xếp: Theo bảng chữ cái (A-Z)</option>
            </select>

            <div className="task-view-toggle" role="group" aria-label="Chế độ hiển thị">
              <button
                type="button"
                className={viewMode === 'list' ? 'active' : ''}
                title="Xem danh sách"
                aria-label="Xem danh sách"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <LayoutList size={16} />
              </button>
              <button
                type="button"
                className={viewMode === 'kanban' ? 'active' : ''}
                title="Xem bảng Kanban"
                aria-label="Xem bảng Kanban"
                aria-pressed={viewMode === 'kanban'}
                onClick={() => setViewMode('kanban')}
              >
                <Columns3 size={16} />
              </button>
            </div>
          </div>

          <form
            className="task-quick-add"
            onSubmit={async e => {
              e.preventDefault()
              if (!quick.trim() || saving) return
              const saved = await persist({ ...blank(), title: quick.trim() })
              if (saved) {
                setQuick('')
                setMessage('Đã thêm việc mới.')
              }
            }}
          >
            <input
              aria-label="Thêm nhanh công việc"
              maxLength={200}
              placeholder="＋ Thêm việc cần làm… (gõ rồi nhấn Enter)"
              value={quick}
              onChange={e => setQuick(e.target.value)}
            />
            <button disabled={saving || !quick.trim()} type="submit" className="primary-button">
              <Plus size={16} /> Thêm việc
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDraft(blank())
                setStep('')
              }}
            >
              Chi tiết
            </button>
          </form>

          <section className="task-source-capture">
            <div className="task-source-info">
              <div className="task-source-title">
                <Sparkles size={18} className="task-sparkle-icon" />
                <strong>Trích xuất việc bằng AI từ {label(service)}</strong>
              </div>
              <small>
                {sourceSnapshot
                  ? `Nguồn lấy lúc ${new Date(sourceSnapshot.capturedAt).toLocaleTimeString('vi-VN')}. Quay lại ứng dụng để cập nhật.`
                  : 'Mở cuộc trò chuyện hoặc email, bật đọc nội dung rồi quay lại đây để tìm việc.'}
              </small>
            </div>
            <div className="task-capture-buttons">
              <button
                className="primary-button"
                type="button"
                disabled={busy || !model || sourceSnapshot === null}
                onClick={() => void capture()}
              >
                {busy ? 'Đang tìm…' : '⌕ Tìm việc trong chat/email'}
              </button>
              {busy && (
                <button type="button" className="secondary-button" onClick={cancel}>
                  Hủy
                </button>
              )}
            </div>
          </section>

          {suggestions.length > 0 && (
            <section className="task-proposals">
              <div className="task-proposals-header">
                <h2>AI đề xuất ({suggestions.length}) · Chọn việc muốn lưu</h2>
                {suggestions.length > 1 && (
                  <button
                    type="button"
                    className="primary-button task-add-all-btn"
                    disabled={saving}
                    onClick={() => void addAllSuggestions()}
                  >
                    ＋ Thêm tất cả ({suggestions.length})
                  </button>
                )}
              </div>
              <div className="task-proposals-list">
                {suggestions.map((item, i) => (
                  <article key={i} className="task-proposal-item">
                    <div className="task-proposal-content">
                      <strong>{item.title}</strong>
                      <blockquote>“{item.source?.evidence}”</blockquote>
                      {item.description && <small className="task-proposal-deadline">{item.description}</small>}
                    </div>
                    <div className="task-proposal-actions">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={saving}
                        onClick={() => void addSuggestion(item)}
                      >
                        ＋ Thêm
                      </button>
                      <button
                        type="button"
                        className="task-proposal-dismiss"
                        aria-label={`Bỏ đề xuất ${item.title}`}
                        onClick={() => setSuggestions(list => list.filter(x => x !== item))}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {message && (
            <p className="task-message" role="status">
              {message}
            </p>
          )}

{viewMode === 'list' ? (
            <>
              <div className="task-list" aria-label="Danh sách công việc">
                {filtered.map(item => (
                  <article
                    className={`task-row ${item.status === 'done' ? 'completed' : ''} ${item.status === 'doing' ? 'in-progress' : ''}`}
                    key={item.id}
                  >
                    <input
                      aria-label={`Hoàn thành ${item.title}`}
                      type="checkbox"
                      checked={item.status === 'done'}
                      disabled={saving}
                      onChange={e => void persist({ ...item, status: e.target.checked ? 'done' : 'todo' })}
                    />
                    <button
                      className="task-row-body"
                      type="button"
                      onClick={() => {
                        setDraft(item)
                        setStep('')
                      }}
                    >
                      <div className="task-title-line">
                        <strong>{item.title}</strong>
                        {item.status === 'doing' && <span className="status-badge doing-badge">◉ Đang làm</span>}
                      </div>

                      <div className="task-row-meta">
                        {item.source && (
                          <span className="source-tag">
                            {label(item.source.service)}
                          </span>
                        )}
                        {item.dueAt && (
                          <span className={`due-tag ${item.dueAt < clock && item.status !== 'done' ? 'overdue' : ''}`}>
                            <Calendar size={12} /> Hạn: {new Date(item.dueAt).toLocaleString('vi-VN')}
                          </span>
                        )}
                        {item.remindAt && (
                          <span className="remind-tag">
                            <Clock size={12} /> Nhắc: {new Date(item.remindAt).toLocaleString('vi-VN')}
                          </span>
                        )}
                        {!!item.steps?.length && (
                          <span className="steps-tag">
                            <CheckSquare size={12} /> {item.steps.filter(s => s.done).length}/{item.steps.length} bước
                          </span>
                        )}
                      </div>

                      {item.source && (
                        <blockquote className="task-evidence-preview">
                          “{item.source.evidence}”
                        </blockquote>
                      )}
                    </button>

                    {/* Quick Action Buttons on Row */}
                    <div className="task-row-actions">
                      {item.source && (
                        <button
                          type="button"
                          className="task-action-icon-btn task-jump-btn"
                          title={`Mở cuộc trò chuyện trong ${label(item.source.service)}`}
                          aria-label={`Mở ${label(item.source.service)}`}
                          onClick={() => navigateToSource(item.source!.service)}
                        >
                          <ExternalLink size={15} />
                        </button>
                      )}
                      {item.status !== 'done' && (
                        <button
                          type="button"
                          className={`task-action-icon-btn ${item.status === 'doing' ? 'active-doing' : ''}`}
                          title={item.status === 'doing' ? 'Tạm dừng làm' : 'Bắt đầu làm việc này'}
                          aria-label={item.status === 'doing' ? 'Tạm dừng' : 'Bắt đầu làm'}
                          onClick={() => toggleDoing(item)}
                        >
                          <Play size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="task-star-btn"
                        aria-label={`Đánh dấu quan trọng ${item.title}`}
                        aria-pressed={!!item.important}
                        disabled={saving}
                        onClick={() => void persist({ ...item, important: !item.important })}
                      >
                        {item.important ? <Star size={18} fill="#eab308" color="#eab308" /> : <Star size={18} color="#94a3b8" />}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {!filtered.length && (
                <div className="task-empty">
                  <span className="task-empty-icon"><CheckCircle2 size={48} /></span>
                  <h2>{filter === 'done' ? 'Chưa có việc hoàn thành' : 'Danh sách đang trống'}</h2>
                  <p>Thêm một việc mới hoặc bấm "Tìm việc trong chat/email" để AI tự động trích xuất các đầu việc cần làm.</p>
                </div>
              )}
            </>
          ) : (
            <div className="task-kanban" aria-label="Bảng công việc Kanban">
              {([
                { id: 'todo' as const, title: 'Chưa làm', icon: Circle, count: rows.filter(r => r.status === 'todo').length },
                { id: 'doing' as const, title: 'Đang làm', icon: Play, count: rows.filter(r => r.status === 'doing').length },
                { id: 'done' as const, title: 'Đã xong', icon: CheckCircle2, count: rows.filter(r => r.status === 'done').length }
              ]).map(col => {
                const colTasks = filtered.filter(item => item.status === col.id)
                const Icon = col.icon
                return (
                  <div key={col.id} className={`task-kanban-col kanban-col-${col.id}`}>
                    <div className="task-kanban-col-header">
                      <div className="task-kanban-col-title">
                        <Icon size={15} />
                        <span>{col.title}</span>
                      </div>
                      <span className="task-kanban-col-count">{colTasks.length}</span>
                    </div>

                    <div className="task-kanban-col-cards">
                      {colTasks.map(item => (
                        <article
                          key={item.id}
                          className={`task-kanban-card ${item.status === 'done' ? 'completed' : ''} ${item.status === 'doing' ? 'in-progress' : ''}`}
                        >
                          <div className="task-kanban-card-top">
                            <input
                              type="checkbox"
                              aria-label={`Hoàn thành ${item.title}`}
                              checked={item.status === 'done'}
                              disabled={saving}
                              onChange={e => void persist({ ...item, status: e.target.checked ? 'done' : 'todo' })}
                            />
                            <button
                              type="button"
                              className="task-star-btn"
                              aria-label={`Đánh dấu quan trọng ${item.title}`}
                              aria-pressed={!!item.important}
                              disabled={saving}
                              onClick={() => void persist({ ...item, important: !item.important })}
                            >
                              {item.important ? <Star size={16} fill="#eab308" color="#eab308" /> : <Star size={16} color="#94a3b8" />}
                            </button>
                          </div>

                          <button
                            type="button"
                            className="task-kanban-card-body"
                            onClick={() => {
                              setDraft(item)
                              setStep('')
                            }}
                          >
                            <strong>{item.title}</strong>
                            {item.description && <p className="task-kanban-desc">{item.description}</p>}
                          </button>

                          <div className="task-kanban-card-meta">
                            {item.source && (
                              <span className="source-tag">
                                {label(item.source.service)}
                              </span>
                            )}
                            {item.dueAt && (
                              <span className={`due-tag ${item.dueAt < clock && item.status !== 'done' ? 'overdue' : ''}`}>
                                <Calendar size={11} /> {new Date(item.dueAt).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                            {!!item.steps?.length && (
                              <span className="steps-tag">
                                <CheckSquare size={11} /> {item.steps.filter(s => s.done).length}/{item.steps.length}
                              </span>
                            )}
                          </div>

                          <div className="task-kanban-card-footer">
                            {item.status === 'todo' && (
                              <button
                                type="button"
                                className="task-kanban-move-btn"
                                onClick={() => void persist({ ...item, status: 'doing' })}
                              >
                                <Play size={12} /> Bắt đầu
                              </button>
                            )}
                            {item.status === 'doing' && (
                              <div className="task-kanban-split-actions">
                                <button
                                  type="button"
                                  className="task-kanban-move-btn"
                                  onClick={() => void persist({ ...item, status: 'todo' })}
                                  title="Chuyển về Chưa làm"
                                >
                                  <Undo2 size={12} /> Hoãn
                                </button>
                                <button
                                  type="button"
                                  className="task-kanban-move-btn move-done"
                                  onClick={() => void persist({ ...item, status: 'done' })}
                                  title="Đánh dấu Hoàn thành"
                                >
                                  <Check size={12} /> Xong
                                </button>
                              </div>
                            )}
                            {item.status === 'done' && (
                              <button
                                type="button"
                                className="task-kanban-move-btn"
                                onClick={() => void persist({ ...item, status: 'doing' })}
                              >
                                <RotateCcw size={12} /> Làm lại
                              </button>
                            )}
                            {item.source && (
                              <button
                                type="button"
                                className="task-action-icon-btn"
                                title={`Mở ${label(item.source.service)}`}
                                onClick={() => navigateToSource(item.source!.service)}
                              >
                                <ExternalLink size={13} />
                              </button>
                            )}
                          </div>
                        </article>
                      ))}

                      {!colTasks.length && (
                        <div className="task-kanban-col-empty">
                          <span>Không có việc</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        {/* Task Editor Drawer */}
        {draft && (
          <aside className="task-editor" aria-label="Chi tiết công việc">
            <div className="task-editor-heading">
              <h2>{draft.id ? 'Chi tiết công việc' : 'Tạo công việc'}</h2>
              <button
                type="button"
                className="task-editor-close"
                aria-label="Đóng chi tiết"
                onClick={() => setDraft(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault()
                if (await persist(draft)) setDraft(null)
              }}
            >
              <label>
                Tên công việc <span className="required">*</span>
                <input
                  required
                  maxLength={200}
                  value={draft.title}
                  onChange={e => setDraft({ ...draft, title: e.target.value })}
                />
              </label>

              <label>
                Ghi chú
                <textarea
                  maxLength={5000}
                  placeholder="Ghi chú chi tiết hoặc thông tin bổ sung…"
                  value={draft.description}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                />
              </label>

              <div className="task-editor-grid-2">
                <label>
                  Trạng thái
                  <select
                    value={draft.status}
                    onChange={e => setDraft({ ...draft, status: e.target.value as WorkTask['status'] })}
                  >
                    <option value="todo">Chưa làm</option>
                    <option value="doing">Đang làm</option>
                    <option value="done">Đã xong</option>
                  </select>
                </label>

                <label>
                  Mức ưu tiên
                  <button
                    type="button"
                    className={`priority-toggle-btn ${draft.important ? 'priority-high' : ''}`}
                    onClick={() => setDraft({ ...draft, important: !draft.important })}
                  >
                    <Star size={16} fill={draft.important ? '#eab308' : 'none'} color={draft.important ? '#eab308' : 'currentColor'} />
                    {draft.important ? 'Quan trọng (Ưu tiên cao)' : 'Bình thường'}
                  </button>
                </label>
              </div>

              {/* Due Date with Quick Presets */}
              <div className="task-datetime-group">
                <label>
                  Hạn hoàn thành
                  <input
                    type="datetime-local"
                    value={localDate(draft.dueAt)}
                    onChange={e =>
                      setDraft({
                        ...draft,
                        dueAt: e.target.value ? new Date(e.target.value).getTime() : null
                      })
                    }
                  />
                </label>
                <div className="task-presets-row">
                  <button type="button" onClick={() => setDuePreset('today_18')}>Hôm nay 18:00</button>
                  <button type="button" onClick={() => setDuePreset('tomorrow_12')}>Mai 12:00</button>
                  <button type="button" onClick={() => setDuePreset('friday_17')}>Thứ 6 17:00</button>
                  <button type="button" onClick={() => setDuePreset('monday_9')}>Thứ 2 9:00</button>
                  <button type="button" className="preset-clear" onClick={() => setDuePreset('clear')}>Bỏ hạn</button>
                </div>
              </div>

              {/* Reminder with Quick Presets */}
              <div className="task-datetime-group">
                <label>
                  Nhắc tôi lúc
                  <input
                    type="datetime-local"
                    value={localDate(draft.remindAt)}
                    onChange={e =>
                      setDraft({
                        ...draft,
                        remindAt: e.target.value ? new Date(e.target.value).getTime() : null
                      })
                    }
                  />
                </label>
                <div className="task-presets-row">
                  <button type="button" onClick={() => setDraft({ ...draft, remindAt: Date.now() + 1800000 })}>Sau 30p</button>
                  <button type="button" onClick={() => setDraft({ ...draft, remindAt: Date.now() + 3600000 })}>Sau 1 giờ</button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 1)
                      d.setHours(9, 0, 0, 0)
                      setDraft({ ...draft, remindAt: d.getTime() })
                    }}
                  >
                    Mai 9:00
                  </button>
                  <button type="button" className="preset-clear" onClick={() => setDraft({ ...draft, remindAt: null })}>Bỏ nhắc</button>
                </div>
              </div>

              {/* Checklist steps */}
              <fieldset className="task-steps-fieldset">
                <legend>
                  Các bước thực hiện ({draft.steps?.filter(s => s.done).length || 0}/{draft.steps?.length || 0})
                </legend>
                {draft.steps?.map(s => (
                  <label className="task-step" key={s.id}>
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={e =>
                        setDraft({
                          ...draft,
                          steps: draft.steps?.map(x => (x.id === s.id ? { ...x, done: e.target.checked } : x))
                        })
                      }
                    />
                    <span className={s.done ? 'task-step-done' : ''}>{s.text}</span>
                    <button
                      type="button"
                      className="task-step-remove"
                      aria-label={`Xóa bước ${s.text}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          steps: draft.steps?.filter(x => x.id !== s.id)
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </label>
                ))}
                <div className="task-step-add">
                  <input
                    aria-label="Bước mới"
                    maxLength={200}
                    placeholder="Thêm bước con… (Enter để thêm)"
                    value={step}
                    onChange={e => setStep(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addStepToDraft()
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!step.trim() || (draft.steps?.length || 0) >= 30}
                    onClick={addStepToDraft}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </fieldset>

              {/* Source evidence */}
              {draft.source && (
                <details className="task-source-details" open>
                  <summary>
                    <span>Nguồn gốc: <strong>{label(draft.source.service)}</strong></span>
                  </summary>
                  <blockquote>“{draft.source.evidence}”</blockquote>
                  <div className="task-source-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => navigateToSource(draft.source!.service)}
                    >
                      <ExternalLink size={14} /> Mở {label(draft.source.service)}
                    </button>
                    <button
                      type="button"
                      className="task-unlink-btn"
                      onClick={() => setDraft({ ...draft, source: undefined })}
                    >
                      Gỡ trích dẫn
                    </button>
                  </div>
                </details>
              )}

              <button className="primary-button task-save-submit" type="submit" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu công việc'}
              </button>
            </form>

            {draft.id && (
              <div className="task-editor-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => snooze(draft, 1)}
                >
                  <RotateCcw size={14} /> Nhắc lại sau 1 giờ
                </button>
                <button
                  className="task-delete-btn"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
                      void window.lingua
                        .deleteTask(draft.id!)
                        .then(() => {
                          setDraft(null)
                          return refresh()
                        })
                        .catch(e => setMessage(String(e)))
                    }
                  }}
                >
                  <Trash2 size={14} /> Xóa công việc
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  )
}
