import {expect,test} from 'vitest'
import {parseAiJson} from './ai-json'
test('repairs illegal escape without discarding backslashes or valid formatting',()=>{
 const source=String.raw`{"translations":[{"id":"m1","translation":"Đường dẫn C:\Reports\ERP\file.txt và \@Teams\nĐoạn mới"}]}`
 const result=parseAiJson(source) as any
 expect(result.translations[0].translation).toContain(String.raw`C:\Reports\ERP`)
 expect(result.translations[0].translation).toContain('\nĐoạn mới')
 expect(result.translations[0].translation).toContain(String.raw`\@Teams`)
})
test('keeps valid escaped quotes unicode and backslashes',()=>{const value={text:'Xin chào "anh"\nC:\\folder'};expect(parseAiJson(JSON.stringify(value))).toEqual(value)})
test('rejects truncated or structurally broken JSON instead of inventing results',()=>{expect(()=>parseAiJson('{"translations":[')).toThrow('sai cấu trúc');expect(()=>parseAiJson('{"translation":"bad\\q"')).toThrow('sai cấu trúc')})
