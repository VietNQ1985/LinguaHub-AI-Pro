export type WindowRect={x:number;y:number;width:number;height:number}
export function companionLayout(area:WindowRect){
 if(!Object.values(area).every(Number.isFinite)||area.width<1240||area.height<600)return null
 const width=Math.min(480,area.width-820),gap=8
 return {assistant:{x:area.x+area.width-width,y:area.y,width,height:area.height},zalo:{x:area.x,y:area.y,width:area.width-width-gap,height:area.height}}
}
