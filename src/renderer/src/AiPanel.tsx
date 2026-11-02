import { useEffect, useRef, useState } from 'react'
import { LiveTranslation } from './LiveTranslation'
import { AiResult } from './AiResult'
import { ChatGPTAccount } from './ChatGPTAccount'
import { AdvancedSettings } from './AdvancedSettings'
import { DEFAULT_CHATGPT_MODEL, DEFAULT_REASONING_EFFORT, DEFAULT_TRANSLATION_REASONING_EFFORT, isGpt6Model, REASONING_EFFORTS, type ReasoningEffort } from '../../shared/model-reasoning'

type PanelMode = 'translate' | 'settings'
type Theme = 'light' | 'dark'
const reasoningEffortLabels: Record<ReasoningEffort, string> = {
  none: 'Tắt suy luận (None)',
  low: 'Thấp (Low)',
  medium: 'Vừa (Medium)',
  high: 'Cao (High)',
  xhigh: 'Rất cao (Extra High)',
  max: 'Tối đa (Max)',
}
type ChatContextMessage = { side: 'left' | 'right' | 'center'; text: string }

function recentChatContext(messages: ChatContextMessage[]) {
  const selected: ChatContextMessage[] = []
  let remaining = 9000
  for (const message of messages.slice(-20).reverse()) {
    const text = message.text.trim().slice(0, Math.min(2000, remaining - 32))
    if (!text) continue
    const candidate = { side: message.side, text }
    const size = JSON.stringify(candidate).length + 1
    if (size > remaining) break
    selected.unshift(candidate)
    remaining -= size
  }
  return selected
}

function modelLabel(value: string) {
  if (value === DEFAULT_CHATGPT_MODEL) return 'ChatGPT · GPT-6 Luna'
  if (value.startsWith('chatgpt:')) return 'ChatGPT · ' + value.slice(8)
  return value ? 'Ollama · ' + value : 'Chưa chọn mô hình'
}

export function AiPanel() {
  const [mode, setMode] = useState<PanelMode>('translate')
  const [model, setModel] = useState('')
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(DEFAULT_REASONING_EFFORT)
  const [translationReasoningEffort, setTranslationReasoningEffort] = useState<ReasoningEffort>(DEFAULT_TRANSLATION_REASONING_EFFORT)
  const [fastMode, setFastMode] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [modelReasoningEfforts, setModelReasoningEfforts] = useState<Record<string,ReasoningEffort[]>>({})
  const [theme, setTheme] = useState<Theme>('light')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [masking, setMasking] = useState(true)
  const requestGeneration = useRef(0)

  useEffect(() => {
    let active = true
    void Promise.all([window.lingua.getPreferences(), window.lingua.getReasoningEffort(), window.lingua.getTranslationReasoningEffort(), window.lingua.getFastMode()]).then(([preferences, savedEffort, savedTranslationEffort, savedFastMode]) => {
      if (!active) return
      const selectedModel = preferences.model || DEFAULT_CHATGPT_MODEL
      setModel(selectedModel)
      setReasoningEffort(savedEffort)
      setTranslationReasoningEffort(savedTranslationEffort)
      setFastMode(savedFastMode)
      setTheme(preferences.theme as Theme)
      document.documentElement.dataset.theme = preferences.theme
      setModels([selectedModel])
    }).catch(() => setError('Chưa tải được cài đặt.'))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const showSettings = () => setMode('settings')
    window.addEventListener('linguahub:settings', showSettings)
    return () => window.removeEventListener('linguahub:settings', showSettings)
  }, [])

  const saveModel = (value: string) => {
    setModel(value)
    setError('')
    void window.lingua.setPreferences({ theme, model: value }).catch(() => setError('Không lưu được mô hình AI.'))
    const slug = value.startsWith('chatgpt:') ? value.slice(8) : ''
    if (isGpt6Model(slug) && !modelReasoningEfforts[slug]?.includes('none') && reasoningEffort === 'none') {
      setReasoningEffort('low')
      void window.lingua.setReasoningEffort('low').catch(() => setError('Không lưu được mức suy luận.'))
    }
  }

  const saveReasoningEffort = (value: ReasoningEffort) => {
    setReasoningEffort(value)
    setError('')
    void window.lingua.setReasoningEffort(value).catch(() => setError('Không lưu được mức suy luận.'))
  }

  const saveTranslationReasoningEffort = (value: ReasoningEffort) => {
    setTranslationReasoningEffort(value)
    setError('')
    void window.lingua.setTranslationReasoningEffort(value).catch(() => setError('Không lưu được mức suy luận khi dịch.'))
  }

  const saveFastMode = (enabled: boolean) => {
    setFastMode(enabled)
    setError('')
    void window.lingua.setFastMode(enabled).catch(() => setError('Không lưu được chế độ tăng tốc.'))
  }

  const changeTheme = (next: Theme) => {
    setTheme(next)
    document.documentElement.dataset.theme = next
    void window.lingua.setPreferences({ theme: next, model }).catch(() => setError('Không lưu được giao diện.'))
  }

  const connectOllama = async () => {
    setError('')
    try {
      const values = await window.lingua.listModels()
      if (!values.length) { setError('Ollama chưa có mô hình. Anh cần cài mô hình trên máy.'); return }
      setModels(values)
      saveModel(values[0])
    } catch {
      setError('Chưa kết nối được Ollama. Anh kiểm tra Ollama đang chạy trên máy.')
    }
  }

  const connectChatGPT = async () => {
    setError('')
    try {
      const values = await window.lingua.chatgptModels()
      if (!values.length) { setError('Tài khoản ChatGPT chưa có mô hình khả dụng.'); return }
      const names = values.map(value => 'chatgpt:' + value.slug)
      setModelReasoningEfforts(Object.fromEntries(values.map(value=>[value.slug,value.reasoningEfforts||[]])))
      setModels(names)
      saveModel(names.includes(DEFAULT_CHATGPT_MODEL) ? DEFAULT_CHATGPT_MODEL : names[0])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa lấy được mô hình ChatGPT. Anh hãy đăng nhập trong Cài đặt.')
    }
  }

  const sendReplyRequest = async () => {
    if (!input.trim() || !model || busy) return
    const generation = ++requestGeneration.current
    setBusy(true)
    setError('')
    setOutput(null)
    try {
      if (model.startsWith('chatgpt:') && !(await window.lingua.allowCloud())) {
        if (generation === requestGeneration.current) setError('Anh chưa cho phép xử lý nội dung bằng ChatGPT.')
        return
      }
      const result = await window.lingua.runAi('reply', input, model)
      if (generation === requestGeneration.current) setOutput(result)
    } catch (failure) {
      if (generation === requestGeneration.current) setError(failure instanceof Error ? failure.message : 'Chưa tạo được gợi ý. Anh thử lại.')
    } finally {
      if (generation === requestGeneration.current) setBusy(false)
    }
  }

  const sendContextualReplyRequest = async () => {
    if (!model || busy) return
    const generation = ++requestGeneration.current
    setBusy(true)
    setError('')
    setOutput(null)
    try {
      if (!(await window.lingua.hasVisibleChatReadAuthorization()) && !(await window.lingua.authorizeVisibleChatRead())) {
        if (generation === requestGeneration.current) setError('Anh chưa cho phép đọc chữ chat đang hiển thị.')
        return
      }
      const snapshot = await window.lingua.readVisibleChat()
      const messages = snapshot ? recentChatContext(snapshot.messages) : []
      if (!messages.length) throw new Error('Chưa thấy tin nhắn trong vùng chat đang hiển thị. Anh mở WhatsApp hoặc Teams rồi thử lại.')
      if (model.startsWith('chatgpt:') && !(await window.lingua.allowBackgroundCloud())) {
        if (generation === requestGeneration.current) setError('Anh chưa cho phép gửi chữ chat đang hiển thị đến ChatGPT.')
        return
      }
      const requestId = crypto.randomUUID()
      const result = await window.lingua.runAi('replyFromChat', JSON.stringify({ messages, intent: input.trim() || undefined }), model, requestId)
      if (generation === requestGeneration.current) setOutput(result)
    } catch (failure) {
      if (generation === requestGeneration.current) setError(failure instanceof Error ? failure.message : 'Chưa tạo được gợi ý từ cuộc trò chuyện. Anh thử lại.')
    } finally {
      if (generation === requestGeneration.current) setBusy(false)
    }
  }

  return <div className="assistant-shell">
    <div className="assistant-heading">
      <div>
        <h2>Bản dịch tiếng Việt</h2>
        <p>Đọc tin nhắn dễ dàng hơn</p>
      </div>
    </div>

    <div className="assistant-content">
      {/* Keep the translation component mounted: changing tabs or hiding the panel must not stop visible chat reading. */}
      <div style={{ display: mode === 'translate' ? 'block' : 'none' }} aria-hidden={mode !== 'translate'}>
        <LiveTranslation model={model} />
        <details className="reply-suggestions">
          <summary>Gợi ý trả lời</summary>
          <div className="reply-view">
            <p className="helper-text">AI đọc các tin nhắn đang hiển thị để gợi ý cách trả lời bằng tiếng Anh. Anh có thể thêm ý riêng hoặc để trống.</p>
            <label htmlFor="reply-input">Ý anh muốn bổ sung (không bắt buộc)</label>
            <textarea id="reply-input" value={input} maxLength={2000} onChange={event => { setInput(event.target.value); setOutput(null); requestGeneration.current++; setBusy(false) }} placeholder="Ví dụ: Tôi sẽ kiểm tra lại và phản hồi vào sáng mai." />
            {!model && <p className="helper-text">Anh hãy chọn dịch vụ AI trong phần Cài đặt.</p>}
            <button type="button" className="primary-button" disabled={!model || busy} onClick={() => void sendContextualReplyRequest()}>{busy ? 'Đang đọc chat và tạo gợi ý…' : 'Đọc chat & gợi ý trả lời'}</button>
            {input.trim() && <button type="button" className="secondary-button reply-manual-button" disabled={!model || busy} onClick={() => void sendReplyRequest()}>Chỉ dùng ý tôi nhập</button>}
            {output !== null && <div className="reply-results"><AiResult result={output} /></div>}
            <p className="helper-text">Chỉ lấy chữ trong các tin đang hiển thị. Ứng dụng không tự gửi tin nhắn; anh xem và tự chọn câu trả lời.</p>
          </div>
        </details>
      </div>

      {mode === 'settings' && <div className="settings-view">
        <div className="settings-title"><h3>Cài đặt</h3><button type="button" onClick={() => setMode('translate')}>← Quay lại bản dịch</button></div>
        <div className="settings-group">
          <h4>Dịch vụ AI</h4>
          <p className="helper-text">Chọn ChatGPT hoặc Ollama. Ứng dụng không tự sử dụng API trả phí.</p>
          <div className="settings-actions">
            <button type="button" onClick={() => void connectChatGPT()}>Chọn ChatGPT</button>
            <button type="button" onClick={() => void connectOllama()}>Chọn Ollama</button>
          </div>
          <label htmlFor="model-choice">Mô hình AI đang sử dụng</label>
          <select id="model-choice" value={model} onChange={event => saveModel(event.target.value)}>
            <option value="">Chưa chọn mô hình</option>
            {models.includes(model) || !model ? null : <option value={model}>{modelLabel(model)}</option>}
            {models.map(name => <option key={name} value={name}>{modelLabel(name)}</option>)}
          </select>
          <p className="helper-text">Đang chọn: {modelLabel(model)}{model.startsWith('chatgpt:') && isGpt6Model(model.slice(8)) ? ` · ${reasoningEffortLabels[reasoningEffort]}` : ''}</p>
          {model.startsWith('chatgpt:') && isGpt6Model(model.slice(8)) && <>
            <label htmlFor="reasoning-effort">Mức suy luận cho tác vụ khác</label>
            <select id="reasoning-effort" value={reasoningEffort} onChange={event => saveReasoningEffort(event.target.value as ReasoningEffort)}>
              {REASONING_EFFORTS.filter(effort => effort !== 'none' || modelReasoningEfforts[model.slice(8)]?.includes('none')).map(effort => <option key={effort} value={effort}>{reasoningEffortLabels[effort]}</option>)}
            </select>
            <p className="helper-text">Mặc định Max; áp dụng cho gợi ý trả lời và các tác vụ AI khác.</p>
            <label htmlFor="translation-reasoning-effort">Mức suy luận cho tác vụ dịch</label>
            <select id="translation-reasoning-effort" value={translationReasoningEffort} onChange={event => saveTranslationReasoningEffort(event.target.value as ReasoningEffort)}>
              {REASONING_EFFORTS.filter(effort => effort !== 'none' || modelReasoningEfforts[model.slice(8)]?.includes('none')).map(effort => <option key={effort} value={effort}>{reasoningEffortLabels[effort]}</option>)}
            </select>
            <p className="helper-text">Mặc định Low để dịch nhanh hơn; có cấu hình riêng, không đổi mức của tác vụ khác.</p>
            <label className="checkbox-label"><input type="checkbox" checked={fastMode} onChange={event => saveFastMode(event.target.checked)} /> Ưu tiên tốc độ khi dịch</label>
            <p className="helper-text">Chỉ áp dụng cho dịch: khi bật sẽ dùng Low; tắt để quay lại mức {reasoningEffortLabels[translationReasoningEffort]}.</p>
          </>}
        </div>
        <div className="settings-group">
          <h4>Tài khoản ChatGPT</h4>
          <ChatGPTAccount />
        </div>
        <div className="settings-group">
          <h4>Giao diện</h4>
          <label htmlFor="theme-choice">Chế độ hiển thị</label>
          <select id="theme-choice" value={theme} onChange={event => changeTheme(event.target.value as Theme)}>
            <option value="light">Sáng</option>
            <option value="dark">Tối</option>
          </select>
        </div>
        <div className="settings-group">
          <h4>Quyền riêng tư</h4>
          <label className="checkbox-label"><input type="checkbox" checked={masking} onChange={async event => { const next = event.target.checked; try { await window.lingua.setMasking(next); setMasking(next) } catch { setError('Không cập nhật được quyền riêng tư.') } }}/> Che email và số điện thoại trước khi gửi AI</label>
          <p className="helper-text">Chức năng che thông tin có thể bỏ sót dữ liệu nhạy cảm. Chỉ bật dịch cloud khi anh đồng ý.</p>
        </div>
        <details className="advanced-settings"><summary>Cài đặt nâng cao</summary><AdvancedSettings /></details>
      </div>}
    </div>
    {error && <p className="assistant-error" role="alert">{error}</p>}
  </div>
}
