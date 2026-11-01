import { expect, test } from 'vitest'
import { conversationFingerprint, segmentOcrLines } from './ocr-messages'

const line = (text:string,x0:number,y0:number,y1:number,confidence=90) => ({text,confidence,bbox:{x0,y0,x1:x0+120,y1}})

test('separates chat header, wrapped lines, and adjacent messages using OCR geometry',()=>{
  const result=segmentOcrLines([
    line('Alex',20,5,20),
    line('Can you send the',25,65,83),
    line('updated report?',25,85,103),
    line('Yes, I will send it.',410,128,146),
  ],600,400)
  expect(result.headerText).toBe('Alex')
  expect(result.messages).toEqual([
    {text:'Can you send the updated report?',confidence:90,side:'left'},
    {text:'Yes, I will send it.',confidence:90,side:'right'},
  ])
})

test('ignores empty OCR and fingerprints conversation labels without retaining their text',()=>{
  const result=segmentOcrLines([line('   ',10,4,19),line('Project Team',10,8,22)],400,300)
  expect(result.messages).toHaveLength(0)
  expect(conversationFingerprint(result.headerText)).toMatch(/^[0-9a-f]{8}$/)
  expect(conversationFingerprint('Project Team')).toBe(conversationFingerprint('project-team'))
  expect(conversationFingerprint('')).toBeNull()
})
