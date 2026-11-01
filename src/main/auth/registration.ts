import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'

const registrationSchema = z.object({ clientId: z.string().min(1).max(512) })

export async function readIssuedClientId(directory: string) {
  try {
    const registration = registrationSchema.parse(JSON.parse(await readFile(join(directory, 'chatgpt-registration.json'), 'utf8')))
    return registration.clientId
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error('Không đọc được mã đăng ký ChatGPT đã lưu.')
  }
}

export async function saveIssuedClientId(directory: string, clientId: string) {
  const registration = registrationSchema.parse({ clientId })
  const path = join(directory, 'chatgpt-registration.json')
  await mkdir(directory, { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(registration), { flag: 'wx' })
  try { await rename(temporary, path) }
  catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
  return registration.clientId
}
