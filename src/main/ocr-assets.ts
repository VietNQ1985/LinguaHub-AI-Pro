import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function getOcrAssetPaths(isPackaged: boolean, appPath: string, resourcesPath: string) {
  const root = isPackaged ? join(resourcesPath, 'ocr') : undefined
  const workerPath = root
    ? join(root, 'worker.min.js')
    : join(appPath, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js')
  const corePath = root
    ? join(root, 'core')
    : join(appPath, 'node_modules', 'tesseract.js-core')
  return { workerUrl: pathToFileURL(workerPath).href, corePath: pathToFileURL(corePath).href }
}
