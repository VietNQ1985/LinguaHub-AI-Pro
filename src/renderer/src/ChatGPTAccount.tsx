import { useEffect, useState } from 'react'

type ConnectedAccount = { connected: boolean; email: string | null; usageEnabled: boolean }

export function ChatGPTAccount() {
  const [status, setStatus] = useState('Đang kiểm tra tài khoản…')
  const [busy, setBusy] = useState(false)

  const updateStatus = (account: ConnectedAccount) => {
    setStatus(account.connected
      ? 'Đã đăng nhập' + (account.email ? ' · ' + account.email : '') +
          (account.usageEnabled ? ' · đã cấp quyền sử dụng gói' : ' · chưa có quyền sử dụng gói')
      : 'Chưa kết nối ChatGPT')
  }

  useEffect(() => {
    void window.lingua.chatgptStatus().then(updateStatus)
      .catch(() => setStatus('Chưa đọc được trạng thái tài khoản.'))
  }, [])

  const connect = async (newWorkspace: boolean) => {
    setBusy(true)
    setStatus(newWorkspace ? 'Đang mở đăng nhập mới…' : 'Đang mở trang ChatGPT để đăng nhập…')
    try {
      const result = newWorkspace
        ? await window.lingua.connectChatGPTNewWorkspace()
        : await window.lingua.connectChatGPT()
      if (result) updateStatus(result)
      else updateStatus(await window.lingua.chatgptStatus())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chưa đăng nhập được.'
      setStatus(message + ' Nếu OpenAI báo tài khoản không được truy cập ứng dụng, anh chọn nút Đổi tài khoản hoặc không gian làm việc bên dưới.')
    } finally {
      setBusy(false)
    }
  }

  return <details className="notice">
    <summary>Đăng nhập và quản lý ChatGPT</summary>
    <p role="status">{status}</p>
    <p>LinguaHub sử dụng quyền đăng nhập ChatGPT do anh cấp. Mỗi đăng ký được gắn với tài khoản và không gian làm việc đã chọn.</p>
    <button type="button" disabled={busy} onClick={() => void connect(false)}>{busy ? 'Đang chờ trình duyệt…' : 'Đăng nhập bằng ChatGPT'}</button>
    <button type="button" disabled={busy} onClick={() => void connect(true)}>Đổi tài khoản hoặc không gian làm việc</button>
    <p>Nếu OpenAI báo “Tài khoản này không thể truy cập ứng dụng này”, anh có thể dùng nút đổi tài khoản hoặc không gian làm việc để tạo đăng ký mới. Chọn đúng tài khoản Plus và không gian làm việc được phép sử dụng. Không cần xóa WhatsApp hoặc Teams.</p>
    <button type="button" onClick={() => void window.lingua.openChatGPTUsageSettings()}>Xem hạn mức ChatGPT</button>
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        const result = await window.lingua.disconnectChatGPT()
        setStatus(result.revoked
          ? 'Đã ngắt kết nối và thu hồi phiên ChatGPT.'
          : 'Đã xóa token trên máy, chưa xác nhận thu hồi từ xa.')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Chưa ngắt được kết nối.')
      } finally {
        setBusy(false)
      }
    }}>Ngắt kết nối ChatGPT</button>
  </details>
}
