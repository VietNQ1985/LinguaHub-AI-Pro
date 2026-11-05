import { execFile, spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

// Talks to the official Zalo PC app (Electron) through the DevTools port it opens when started with
// --remote-debugging-port. Calls stay in Zalo PC's own call window; LinguaHub only reads the visible
// chat, types into its message box and presses its call buttons. Checked live on Zalo PC 26.11.10.
export const ZALO_PC_PORT = 9334
const run = promisify(execFile)

type Target = { type: string; url: string; webSocketDebuggerUrl?: string }

export function zaloPcInstallDir() {
  return join(process.env.LOCALAPPDATA || '', 'Programs', 'Zalo')
}

/** Newest versioned Zalo.exe (Zalo-26.11.10\Zalo.exe); the top-level launcher does not pass arguments on. */
export async function findZaloPcExe(): Promise<string | null> {
  try {
    const dirs = (await readdir(zaloPcInstallDir(), { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && /^Zalo-\d+(\.\d+)+$/.test(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
    return dirs.length ? join(zaloPcInstallDir(), dirs[0], 'Zalo.exe') : null
  } catch {
    return null
  }
}

export async function zaloPcRunning() {
  try {
    const { stdout } = await run('tasklist', ['/FI', 'IMAGENAME eq Zalo.exe', '/NH', '/FO', 'CSV'], { windowsHide: true })
    return /"Zalo\.exe"/i.test(stdout)
  } catch {
    return false
  }
}

export async function closeZaloPc() {
  await run('taskkill', ['/IM', 'Zalo.exe', '/T', '/F'], { windowsHide: true }).catch(() => undefined)
}

export function launchZaloPc(exe: string) {
  const child = spawn(exe, [`--remote-debugging-port=${ZALO_PC_PORT}`, '--remote-debugging-address=127.0.0.1'], { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()
}

/** The main chat page, only if the port really belongs to Zalo PC (user agent and local pc-dist page). */
async function mainTarget(): Promise<Target | null> {
  try {
    const version = await (await fetch(`http://127.0.0.1:${ZALO_PC_PORT}/json/version`, { signal: AbortSignal.timeout(1500) })).json() as { 'User-Agent'?: string }
    if (!/\bZalo\/\d/.test(version['User-Agent'] || '')) return null
    const targets = await (await fetch(`http://127.0.0.1:${ZALO_PC_PORT}/json`, { signal: AbortSignal.timeout(1500) })).json() as Target[]
    return targets.find(target => target.type === 'page' && /^file:\/\/\/.+\/Zalo\/Zalo-[\d.]+\/resources\/app\.asar\/pc-dist\/index\.html/i.test(target.url) && !!target.webSocketDebuggerUrl) || null
  } catch {
    return null
  }
}

export async function zaloPcConnected() {
  return !!await mainTarget()
}

type Session = { send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>; close: () => void }

async function session(): Promise<Session> {
  const target = await mainTarget()
  if (!target?.webSocketDebuggerUrl) throw new Error('Chưa kết nối được Zalo PC. Bấm "Kết nối Zalo PC" trước.')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Zalo PC không phản hồi.')), 3000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Zalo PC không phản hồi.')) }, { once: true })
  })
  let next = 0
  const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>()
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown>; error?: { message?: string } }
    const waiter = message.id ? pending.get(message.id) : undefined
    if (!waiter) return
    pending.delete(message.id!)
    if (message.error) waiter.reject(new Error(message.error.message || 'Zalo PC từ chối lệnh.'))
    else waiter.resolve(message.result || {})
  })
  return {
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++next
      pending.set(id, { resolve, reject })
      setTimeout(() => { if (pending.delete(id)) reject(new Error('Zalo PC không phản hồi.')) }, 5000)
      socket.send(JSON.stringify({ id, method, params }))
    }),
    close: () => socket.close(),
  }
}

/** Runs one fixed, app-built expression in Zalo PC and returns its JSON value. */
export async function zaloPcEvaluate<T>(expression: string): Promise<T> {
  const current = await session()
  try {
    const result = await current.send('Runtime.evaluate', { expression, returnByValue: true })
    return (result.result as { value?: T } | undefined)?.value as T
  } finally {
    current.close()
  }
}

export async function zaloPcType(text: string) {
  const current = await session()
  try { await current.send('Input.insertText', { text }) } finally { current.close() }
}

export async function zaloPcPressEnter() {
  const current = await session()
  try {
    await current.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
    await current.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  } finally {
    current.close()
  }
}

/** Presses Zalo PC's own voice or video call button in the open 1-1 chat. */
export function buildCallScript(kind: 'voice' | 'video') {
  const title = kind === 'voice' ? 'STR_VOICE_CALL' : 'STR_VIDEO_CALL'
  return `(() => { const button = document.querySelector('header#header [data-translate-title="${title}"]'); if (!button) return false; button.click(); return true })()`
}

export async function zaloPcBringToFront() {
  const current = await session()
  try { await current.send('Page.bringToFront') } finally { current.close() }
}

const normalizeName = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi')

/** Title of the chat open in Zalo PC (header), normalised for comparison. */
export function buildOpenTitleScript() {
  return `(() => (document.querySelector('header#header .header-title')?.innerText || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi'))()`
}

/** Focuses Zalo PC's contact search box and selects its text so typed text replaces it. */
export function buildFocusSearchScript() {
  return `(() => { const input = document.querySelector('#contact-search-input'); if (!input) return false; input.focus(); input.select?.(); return true })()`
}

/**
 * Counts search results whose full name equals `name` and opens it only when exactly one matches,
 * so two contacts with the same name are never guessed between. Returns the number of exact matches.
 */
export function buildOpenSearchResultScript(name: string) {
  return `(() => {
    const norm = value => (value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi')
    const target = ${JSON.stringify(normalizeName(name))}
    const rows = [...document.querySelectorAll('#searchResultList .conv-item')].filter(row => (() => { const name = row.querySelector('.conv-item-title__name'); return norm(name?.innerText || name?.textContent) === target })())
    if (rows.length === 1) rows[0].click()
    return rows.length
  })()`
}

export function sameChatName(a: string, b: string) {
  return normalizeName(a) === normalizeName(b)
}
