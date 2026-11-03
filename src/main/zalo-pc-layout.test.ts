import {expect,test} from 'vitest'
import {companionLayout} from './zalo-pc-layout'
test('companion uses the selected work area, including negative monitor coordinates',()=>{
 const layout=companionLayout({x:-1920,y:40,width:1920,height:1040})!
 expect(layout.assistant).toEqual({x:-480,y:40,width:480,height:1040})
 expect(layout.zalo).toEqual({x:-1920,y:40,width:1432,height:1040})
 expect(layout.zalo.x+layout.zalo.width+8).toBe(layout.assistant.x)
})
test('small screens fall back to separate windows instead of clipping Zalo or the assistant',()=>{
 expect(companionLayout({x:0,y:0,width:1024,height:768})).toBeNull()
 expect(companionLayout({x:0,y:0,width:1920,height:540})).toBeNull()
 const layout=companionLayout({x:0,y:0,width:1240,height:700})!
 expect(layout.assistant.width).toBe(420);expect(layout.zalo.width).toBe(812)
 expect(companionLayout({x:NaN,y:0,width:1920,height:1080})).toBeNull()
})
