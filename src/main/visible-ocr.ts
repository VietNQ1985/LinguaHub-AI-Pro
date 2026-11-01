import { dialog, type BrowserWindow, type WebContentsView } from 'electron'

export class VisibleOcr {
  private authorized = false
  private generation = 0
  private busy = false
  async authorize(window: BrowserWindow) {
    const result = await dialog.showMessageBox(window, {
      type: 'question', title: 'Cho phép đọc vùng chat hiển thị',
      message: 'Cho phép OCR cục bộ đọc vùng chat đang mở trong LinguaHub?',
      detail: 'Chỉ chụp vùng website đang hiển thị, không chụp toàn màn hình. Ảnh được xử lý trên máy và không lưu. Văn bản dịch bằng Ollama ở trên máy; nếu chọn ChatGPT, app sẽ xin quyền riêng trước khi gửi chữ OCR đến OpenAI. Lần đầu cần tải dữ liệu nhận dạng tiếng Anh. Anh có thể dừng bất kỳ lúc nào.',
      buttons: ['Cho phép', 'Hủy'], defaultId: 1, cancelId: 1,
    })
    this.authorized = result.response === 0
    this.generation++
    return this.authorized
  }
  stop() { this.authorized = false; this.generation++ }
  invalidate() { this.generation++ }
  async recognize(view: WebContentsView | undefined, leftPercent: number) {
    if (!this.authorized) throw new Error('Chưa cho phép OCR.')
    if (!view || !view.getVisible()) throw new Error('Anh mở một cuộc trò chuyện trước.')
    if (this.busy) return null
    if (!Number.isFinite(leftPercent) || leftPercent < 0 || leftPercent > 80) throw new Error('Vùng OCR không hợp lệ.')
    const generation = this.generation
    this.busy = true
    try {
      const image = await view.webContents.capturePage()
      const size = image.getSize()
      const x = Math.floor(size.width * leftPercent / 100)
      const y = Math.floor(size.height * .04)
      const crop = image.crop({ x, y, width: size.width - x, height: Math.floor(size.height * .92) })
      if (!this.authorized || generation !== this.generation || view.webContents.isDestroyed() || !view.getVisible()) return null
      return {
        pngBase64: crop.toPNG().toString('base64'),
        width: size.width - x,
        height: crop.getSize().height,
      }
    } finally { this.busy = false }
  }
  async dispose() { this.stop() }
}
