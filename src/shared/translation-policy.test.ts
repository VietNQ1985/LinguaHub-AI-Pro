import { expect, test } from 'vitest'
import { FALLBACK_TRANSLATION_SCAN_MS, IDLESS_MESSAGE_CONFIRMATION_MS, MAX_TRANSLATION_BATCH_MESSAGES, newestFirst, translationCacheScope } from './translation-policy'

test('fallback scan stays responsive without a ten-second idle backoff',()=>{
  expect(FALLBACK_TRANSLATION_SCAN_MS).toBeLessThan(2000)
  expect(IDLESS_MESSAGE_CONFIRMATION_MS).toBeLessThan(250)
})

test('queues newest messages first and bounds each request',()=>{
  expect(newestFirst(['oldest','middle','latest'],MAX_TRANSLATION_BATCH_MESSAGES)).toEqual(['latest','middle','oldest'])
  expect(newestFirst(Array.from({length:30},(_,index)=>index),MAX_TRANSLATION_BATCH_MESSAGES)).toHaveLength(MAX_TRANSLATION_BATCH_MESSAGES)
  expect(newestFirst(Array.from({length:10},(_,index)=>index),MAX_TRANSLATION_BATCH_MESSAGES)[0]).toBe(9)
})

test('scopes cache keys to conversation and stable message identity',()=>{
  expect(translationCacheScope('chat-a','m-1')).toBe('["chat-a","m-1"]')
  expect(translationCacheScope('chat-b','m-1')).not.toBe(translationCacheScope('chat-a','m-1'))
  expect(translationCacheScope('chat-a')).toBe('["chat-a","content"]')
})
