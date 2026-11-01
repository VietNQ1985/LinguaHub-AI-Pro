import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const vocabulary = sqliteTable('vocabulary', {
  id: text('id').primaryKey(),
  term: text('term').notNull(),
  meaning: text('meaning').notNull(),
  phonetic: text('phonetic').notNull().default(''),
  example: text('example').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  createdAt: integer('created_at').notNull(),
  dueAt: integer('due_at').notNull(),
  intervalDays: integer('interval_days').notNull().default(0),
  easeFactor: real('ease_factor').notNull().default(2.5),
  repetitions: integer('repetitions').notNull().default(0),
})

export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  createdAt: integer('created_at').notNull(),
  metadata: text('metadata').notNull().default('{}'),
})
