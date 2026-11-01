import { expect, test, vi } from 'vitest'
import Tesseract from 'tesseract.js'
import { BrowserOcr } from './browser-ocr'

const assets = { workerUrl: 'file:///resources/ocr/worker.min.js', corePath: 'file:///resources/ocr/core' }
const data = {
  text: 'Alex\nCan you send the updated report?', confidence: 94,
  blocks: [{ paragraphs: [{ lines: [
    { text: 'Alex', confidence: 95, bbox: { x0: 20, y0: 5, x1: 80, y1: 20 } },
    { text: 'Can you send the updated report?', confidence: 93, bbox: { x0: 25, y0: 80, x1: 220, y1: 102 } },
  ] }] }],
}

test('browser OCR uses the packaged worker, local core, and segments recognized lines', async () => {
  const recognize = vi.fn().mockResolvedValue({ data })
  const terminate = vi.fn().mockResolvedValue({})
  const worker = { recognize, terminate } as unknown as Tesseract.Worker
  const createWorker = vi.fn().mockResolvedValue(worker) as unknown as typeof Tesseract.createWorker
  const engine = new BrowserOcr(createWorker)

  const result = await engine.recognize({ pngBase64: btoa('synthetic png'), width: 500, height: 400 }, assets)

  expect(createWorker).toHaveBeenCalledWith('eng', 1, { workerPath: assets.workerUrl, corePath: assets.corePath })
  expect(recognize).toHaveBeenCalledWith(`data:image/png;base64,${btoa('synthetic png')}`, undefined, { blocks: true })
  expect(result.messages).toEqual([{ text: 'Can you send the updated report?', confidence: 93, side: 'left' }])
  expect(result.conversationId).toMatch(/^[0-9a-f]{8}$/)
  await engine.terminate()
  expect(terminate).toHaveBeenCalledOnce()
})

test('browser OCR reuses its worker until stopped', async () => {
  const worker = { recognize: vi.fn().mockResolvedValue({ data }), terminate: vi.fn().mockResolvedValue({}) } as unknown as Tesseract.Worker
  const createWorker = vi.fn().mockResolvedValue(worker) as unknown as typeof Tesseract.createWorker
  const engine = new BrowserOcr(createWorker)
  const capture = { pngBase64: btoa('sample'), width: 500, height: 400 }

  await engine.recognize(capture, assets)
  await engine.recognize(capture, assets)
  expect(createWorker).toHaveBeenCalledOnce()
  await engine.terminate()
})
