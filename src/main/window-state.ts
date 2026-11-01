import {app,screen,type BrowserWindow} from 'electron'
import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {z} from 'zod'
const schema=z.object({x:z.number().int(),y:z.number().int(),width:z.number().int().min(800).max(10000),height:z.number().int().min(500).max(10000),maximized:z.boolean()})
const path=()=>join(app.getPath('userData'),'window-state.json')
export function restoreWindow(){
  try{
    const state=schema.parse(JSON.parse(readFileSync(path(),'utf8')))
    const area=screen.getDisplayMatching(state).workArea
    const width=Math.min(state.width,area.width),height=Math.min(state.height,area.height)
    return {...state,width,height,x:Math.max(area.x,Math.min(state.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(state.y,area.y+area.height-height))}
  }catch{return {width:1440,height:920,maximized:false}}
}
export function saveWindow(window:BrowserWindow){
  try{const state={...window.getNormalBounds(),maximized:window.isMaximized()};writeFileSync(`${path()}.tmp`,JSON.stringify(state),'utf8');renameSync(`${path()}.tmp`,path())}catch{/* Window state must not prevent closing. */}
}
