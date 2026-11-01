import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import { eq, lte } from 'drizzle-orm'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { vocabulary, appSettings, activity } from './schema'

function localDayKey(timestamp: number) {
  const date=new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export async function createLearningStore(directory: string, wasmPath: string) {
  await mkdir(directory, { recursive: true })
  const filename = join(directory, 'learning.sqlite')
  const SQL = await initSqlJs({ locateFile: () => wasmPath })
  let bytes: Buffer | undefined
  try { bytes = await readFile(filename) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const sqlite = new SQL.Database(bytes)
  sqlite.run('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  sqlite.run('CREATE TABLE IF NOT EXISTS vocabulary (id TEXT PRIMARY KEY, term TEXT NOT NULL, meaning TEXT NOT NULL, phonetic TEXT NOT NULL DEFAULT \'\', example TEXT NOT NULL DEFAULT \'\', tags TEXT NOT NULL DEFAULT \'[]\', created_at INTEGER NOT NULL, due_at INTEGER NOT NULL, interval_days INTEGER NOT NULL DEFAULT 0, ease_factor REAL NOT NULL DEFAULT 2.5, repetitions INTEGER NOT NULL DEFAULT 0)')
  sqlite.run('CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, kind TEXT NOT NULL, created_at INTEGER NOT NULL, metadata TEXT NOT NULL DEFAULT \'{}\')')
  const db = drizzle(sqlite)
  let queue = Promise.resolve()
  let storageFailed=false
  const ensureHealthy=()=>{if(storageFailed)throw new Error('Lưu dữ liệu thất bại. Anh mở lại app trước khi tiếp tục để tránh dùng dữ liệu chưa lưu.')}
  const persist = () => {
    ensureHealthy()
    const snapshot = sqlite.export()
    queue = queue.catch(() => {}).then(async () => { ensureHealthy();try{await writeFile(`${filename}.tmp`, snapshot); await rename(`${filename}.tmp`, filename)}catch(error){storageFailed=true;throw error} })
    return queue
  }
  const getNotificationPreferences = () => {
    ensureHealthy()
    const rows = db.select().from(appSettings).all()
    const values = Object.fromEntries(rows.map(row => [row.key, row.value]))
    return { whatsapp: values['notifications.whatsapp'] === 'true', teams: values['notifications.teams'] === 'true' }
  }
  const readRetentionDays = () => {
    const value=db.select().from(appSettings).all().find(row=>row.key==='privacy.retentionDays')?.value
    const days=Number(value)
    return [30,90,365].includes(days)?days:0
  }
  const pruneOlderThan = (days:number) => {
    if(days<=0)return
    const cutoff=Date.now()-days*86400000
    db.delete(vocabulary).where(lte(vocabulary.createdAt,cutoff)).run()
    db.delete(activity).where(lte(activity.createdAt,cutoff)).run()
  }
  const getLearningProgress = () => {
    ensureHealthy()
    const now=Date.now()
    const words=db.select().from(vocabulary).all()
    const events=db.select().from(activity).all()
    const today=localDayKey(now)
    const reviewsToday=events.filter(item=>item.kind==='vocabulary_review'&&localDayKey(item.createdAt)===today).length
    const lessonsToday=events.filter(item=>item.kind==='daily_lesson'&&localDayKey(item.createdAt)===today).length
    const aiEventsToday=events.filter(item=>item.kind==='ai_request'&&localDayKey(item.createdAt)===today)
    const aiProvider=(item:typeof aiEventsToday[number])=>{try{return JSON.parse(item.metadata).provider}catch{return ''}}
    const studyDays=new Set(events.filter(item=>item.kind==='vocabulary_review'||item.kind==='daily_lesson').map(item=>localDayKey(item.createdAt)))
    let studyStreak=0
    const cursor=new Date(now)
    if(!studyDays.has(today))cursor.setDate(cursor.getDate()-1)
    for(let i=0;i<366&&studyDays.has(localDayKey(cursor.getTime()));i++){
      studyStreak++
      cursor.setDate(cursor.getDate()-1)
    }
    return {
      totalWords:words.length,
      reviewedWords:words.filter(item=>item.repetitions>0).length,
      dueWords:words.filter(item=>item.dueAt<=now).length,
      reviewsToday,
      lessonsToday,
      lessonCompletedToday:lessonsToday>0,
      studyStreak,
      aiRequestsToday:aiEventsToday.length,
      ollamaRequestsToday:aiEventsToday.filter(item=>aiProvider(item)==='ollama').length,
      chatgptRequestsToday:aiEventsToday.filter(item=>aiProvider(item)==='chatgpt').length,
    }
  }
  const recordActivity = async(kind:'vocabulary_review'|'daily_lesson'|'ai_request',metadata:Record<string,unknown>={})=>{
    ensureHealthy()
    const createdAt=Date.now()
    db.insert(activity).values({id:randomUUID(),kind,createdAt,metadata:JSON.stringify(metadata)}).run()
    db.delete(activity).where(lte(activity.createdAt,createdAt-365*86400000)).run()
    await persist()
  }
  pruneOlderThan(readRetentionDays())
  await persist()
  return {
    getNotificationPreferences,
    getRetentionDays:readRetentionDays,
    async setRetentionDays(input:unknown){
      ensureHealthy()
      const days=z.union([z.literal(0),z.literal(30),z.literal(90),z.literal(365)]).parse(input)
      db.insert(appSettings).values({key:'privacy.retentionDays',value:String(days)}).onConflictDoUpdate({target:appSettings.key,set:{value:String(days)}}).run()
      pruneOlderThan(days)
      await persist()
      return days
    },
    getLearningProgress,
    async completeDailyLesson(){
      if(getLearningProgress().lessonCompletedToday)return false
      await recordActivity('daily_lesson')
      return true
    },
    async recordAiUsage(provider:unknown,task:unknown){
      const data=z.object({provider:z.enum(['ollama','chatgpt']),task:z.enum(['translate','translateMessages','reply','coach','summary','risks'])}).parse({provider,task})
      await recordActivity('ai_request',data)
    },
    async setNotificationPreference(service: unknown, enabled: unknown) {
      ensureHealthy()
      const data = z.object({ service: z.enum(['whatsapp','teams']), enabled: z.boolean() }).parse({service,enabled})
      const key = `notifications.${data.service}`
      db.insert(appSettings).values({key,value:String(data.enabled)}).onConflictDoUpdate({target:appSettings.key,set:{value:String(data.enabled)}}).run()
      await persist()
      return getNotificationPreferences()
    },
    getPreferences() {
      ensureHealthy()
      const rows = db.select().from(appSettings).all()
      const values = Object.fromEntries(rows.map(row => [row.key, row.value]))
      const savedWidth=Number(values.panelWidth)
      return { theme: values.theme === 'dark' ? 'dark' : 'light', model: values.model || '', panelWidth:Number.isFinite(savedWidth)&&savedWidth>=280&&savedWidth<=560?savedWidth:360 }
    },
    async setPreferences(input: unknown) {
      ensureHealthy()
      const data = z.object({ theme: z.enum(['light','dark']), model: z.string().max(200) }).parse(input)
      for (const [key,value] of Object.entries(data)) db.insert(appSettings).values({key,value}).onConflictDoUpdate({target:appSettings.key,set:{value}}).run()
      await persist()
    },
    async setPanelWidth(width:unknown){
      ensureHealthy()
      const panelWidth=z.number().int().min(280).max(560).parse(width)
      db.insert(appSettings).values({key:'panelWidth',value:String(panelWidth)}).onConflictDoUpdate({target:appSettings.key,set:{value:String(panelWidth)}}).run()
      await persist()
      return panelWidth
    },
    async clearVocabulary() { ensureHealthy();db.delete(vocabulary).run();db.delete(activity).run(); await persist() },
    async clearAll(){ensureHealthy();db.delete(vocabulary).run();db.delete(activity).run();db.delete(appSettings).run();await persist()},
    list: () => {ensureHealthy();return db.select().from(vocabulary).all()},
    async add(input: unknown) {
      ensureHealthy()
      const data = z.object({ term: z.string().trim().min(1).max(200), meaning: z.string().trim().min(1).max(2000) }).parse(input)
      db.insert(vocabulary).values({ id: randomUUID(), ...data, createdAt: Date.now(), dueAt: Date.now() }).run()
      await persist()
    },
    async review(id: unknown, remembered: unknown) {
      ensureHealthy()
      if (typeof id !== 'string' || typeof remembered !== 'boolean') throw new Error('Đánh giá không hợp lệ')
      const row = db.select().from(vocabulary).where(eq(vocabulary.id, id)).get()
      if (!row) throw new Error('Không tìm thấy từ vựng')
      const intervalDays = remembered ? (row.intervalDays === 0 ? 1 : Math.min(365, Math.ceil(row.intervalDays * 2.5))) : 0
      db.update(vocabulary).set({ intervalDays, dueAt: Date.now() + (remembered ? intervalDays * 86400000 : 600000), repetitions: remembered ? row.repetitions + 1 : 0 }).where(eq(vocabulary.id, id)).run()
      const createdAt=Date.now()
      db.insert(activity).values({id:randomUUID(),kind:'vocabulary_review',createdAt,metadata:JSON.stringify({remembered})}).run()
      db.delete(activity).where(lte(activity.createdAt,createdAt-365*86400000)).run()
      await persist()
    },
  }
}
