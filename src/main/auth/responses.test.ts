import { test,expect } from 'vitest'
import { readCompletedResponse } from './responses'
test('rejects non-text stream deltas instead of displaying invalid output',async()=>{
  await expect(readCompletedResponse(new Response('data: {"type":"response.output_text.delta","delta":null}\n\n'))).rejects.toThrow('không hợp lệ')
})
test('requires completion even after receiving useful-looking text',async()=>{
  const response=new Response('data: {"type":"response.output_text.delta","delta":"hello"}\n\n')
  await expect(readCompletedResponse(response)).rejects.toThrow('bị ngắt')
})
test('rejects late usage failure and accepts completed result',async()=>{
  await expect(readCompletedResponse(new Response('data: {"type":"response.output_text.delta","delta":"hello"}\n\ndata: {"type":"response.failed"}\n\n'))).rejects.toThrow()
  await expect(readCompletedResponse(new Response('data: {"type":"response.output_text.delta","delta":"Xin chào"}\n\ndata: {"type":"response.completed"}\n\n'))).resolves.toBe('Xin chào')
})
test('reports time to first text and completed stream separately',async()=>{
  const updates:Array<{firstResponseMs?:number|null;completionMs?:number}> = []
  const started=performance.now()
  await expect(readCompletedResponse(new Response('data: {"type":"response.output_text.delta","delta":"Xin chào"}\n\ndata: {"type":"response.completed"}\n\n'),started,value=>updates.push(value))).resolves.toBe('Xin chào')
  expect(updates.some(value=>typeof value.firstResponseMs==='number')).toBe(true)
  expect(updates.at(-1)?.completionMs).toBeGreaterThanOrEqual(updates.find(value=>typeof value.firstResponseMs==='number')!.firstResponseMs!)
})
test('explains shared-plan usage denial without exposing the provider error body',async()=>{
  const result=readCompletedResponse(new Response('data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded","message":"private provider details"}}}\n\n'))
  await expect(result).rejects.toThrow('hạn mức ChatGPT dùng chung')
  await expect(result).rejects.not.toThrow('private provider details')
})
