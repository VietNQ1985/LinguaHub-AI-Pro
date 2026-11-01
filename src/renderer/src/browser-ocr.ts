import Tesseract from 'tesseract.js'
import { conversationFingerprint, segmentOcrLines } from '../../shared/ocr-messages'

type OcrAssets = { workerUrl: string; corePath: string }
type OcrCapture = { pngBase64: string; width: number; height: number }

export class BrowserOcr {
  private worker: Promise<Tesseract.Worker> | null = null
  private workerAssets: OcrAssets | null = null

  constructor(private readonly createWorker = Tesseract.createWorker) {}

  async recognize(capture: OcrCapture, assets: OcrAssets) {
    try {
      const worker = await this.getWorker(assets)
      const imageUrl = `data:image/png;base64,${capture.pngBase64}`
      const { data } = await worker.recognize(imageUrl, undefined, { blocks: true })
      const lines = (data.blocks || []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.map(line => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.bbox,
      }))))
      const layout = segmentOcrLines(lines, capture.width, capture.height)
      return {
        text: data.text.trim(),
        confidence: data.confidence,
        messages: layout.messages,
        conversationId: conversationFingerprint(layout.headerText),
      }
    } catch (error) {
      await this.terminate()
      throw error
    }
  }

  async terminate() {
    const worker = this.worker
    this.worker = null
    this.workerAssets = null
    if (worker) {
      try { await (await worker).terminate() } catch {}
    }
  }

  private async getWorker(assets: OcrAssets) {
    if (this.workerAssets && (this.workerAssets.workerUrl !== assets.workerUrl || this.workerAssets.corePath !== assets.corePath)) await this.terminate()
    if (!this.worker) {
      this.workerAssets = assets
      this.worker = this.createWorker('eng', 1, { workerPath: assets.workerUrl, corePath: assets.corePath }).catch(error => {
        this.worker = null
        this.workerAssets = null
        throw error
      })
    }
    return this.worker
  }
}
