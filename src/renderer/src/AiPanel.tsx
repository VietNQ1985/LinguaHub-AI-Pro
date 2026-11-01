import { useEffect, useRef, useState } from 'react'
import { LiveTranslation } from './LiveTranslation'
import { AiResult } from './AiResult'
import { ChatGPTAccount } from './ChatGPTAccount'
import { AdvancedSettings } from './AdvancedSettings'

type PanelMode = 'translate' | 'reply' | 'settings'
type Theme = 'light' | 'dark'

export function AiPanel() {
  const [mode, setMode] = useState<PanelMode>('translate')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [theme, setTheme] = useState<Theme>('light')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [masking, setMasking] = useState(true)
  const requestGeneration = useRef(0)

  useEffect(() => {
    let active = true
    void window.lingua.getPreferences().then(preferences => {
      if (!active) return
      setModel(preferences.model)
      setTheme(preferences.theme as Theme)
      document.documentElement.dataset.theme = preferences.theme
      if (preferences.model) setModels([preferences.model])
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
      setModels(names)
      saveModel(names[0])
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

  return <div className="assistant-shell">
    <div className="assistant-heading">
      <div>
        <h2>Bản dịch tiếng Việt</h2>
        <p>Đọc tin nhắn dễ dàng hơn</p>
      </div>
    </div>

    <div className="assistant-tabs" role="tablist" aria-label="Chức năng trợ lý">
      <button type="button" role="tab" aria-selected={mode === 'translate'} className={mode === 'translate' ? 'selected' : ''} onClick={() => setMode('translate')}>Dịch tự động</button>
      <button type="button" role="tab" aria-selected={mode === 'reply'} className={mode === 'reply' ? 'selected' : ''} onClick={() => setMode('reply')}>Gợi ý trả lời</button>
    </div>

    <div className="assistant-content">
      {/* Keep the translation component mounted: changing tabs or hiding the panel must not stop visible chat reading. */}
      <div style={{ display: mode === 'translate' ? 'block' : 'none' }} aria-hidden={mode !== 'translate'}>
        <LiveTranslation model={model} />
      </div>

      {mode === 'reply' && <div className="reply-view">
        <p className="helper-text">Anh viết ý muốn trả lời bằng tiếng Việt. AI sẽ đề xuất ba cách nói tiếng Anh.</p>
        <label htmlFor="reply-input">Nội dung anh muốn trả lời</label>
        <textarea id="reply-input" value={input} maxLength={12000} onChange={event => { setInput(event.target.value); setOutput(null); requestGeneration.current++ }} placeholder="Ví dụ: Tôi sẽ kiểm tra lại và phản hồi vào sáng mai." />
        {!model && <p className="helper-text">Anh hãy chọn dịch vụ AI trong phần Cài đặt.</p>}
        <button type="button" className="primary-button" disabled={!input.trim() || !model || busy} onClick={() => void sendReplyRequest()}>{busy ? 'Đang tạo gợi ý…' : 'Gợi ý câu trả lời'}</button>
        {output !== null && <div className="reply-results"><AiResult result={output} /></div>}
        <p className="helper-text">Ứng dụng chỉ gợi ý. Anh tự quyết định nội dung và gửi tin nhắn.</p>
      </div>}

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
            {models.includes(model) || !model ? null : <option value={model}>{model}</option>}
            {models.map(name => <option key={name} value={name}>{name.startsWith('chatgpt:') ? 'ChatGPT · ' + name.slice(8) : 'Ollama · ' + name}</option>)}
          </select>
          <p className="helper-text">Đang chọn: {model ? model.startsWith('chatgpt:') ? 'ChatGPT' : 'Ollama trên máy' : 'Chưa có dịch vụ AI'}</p>
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
