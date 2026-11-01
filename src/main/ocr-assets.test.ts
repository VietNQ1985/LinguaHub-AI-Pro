import { expect, test } from 'vitest'
import { getOcrAssetPaths } from './ocr-assets'

test('packaged OCR uses the local worker and core shipped in resources', () => {
  const paths = getOcrAssetPaths(true, 'C:/app', 'C:/Program Files/LinguaHub/resources')
  expect(paths.workerUrl).toBe('file:///C:/Program%20Files/LinguaHub/resources/ocr/worker.min.js')
  expect(paths.corePath).toBe('file:///C:/Program%20Files/LinguaHub/resources/ocr/core')
})

test('development OCR uses the installed project dependencies', () => {
  const paths = getOcrAssetPaths(false, 'C:/work/LinguaHub', 'C:/electron/resources')
  expect(paths.workerUrl).toBe('file:///C:/work/LinguaHub/node_modules/tesseract.js/dist/worker.min.js')
  expect(paths.corePath).toBe('file:///C:/work/LinguaHub/node_modules/tesseract.js-core')
})
