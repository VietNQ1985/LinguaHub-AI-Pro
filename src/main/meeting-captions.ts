export function meetingCaptionScript(){return `(${readMeetingCaptions.toString()})()`}
function readMeetingCaptions(){
 const visible=(element:Element)=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&s.display!=='none'&&s.visibility!=='hidden'}
 const root=[...document.querySelectorAll('[data-tid="closed-caption-container"], [data-tid="closed-captions-renderer"], [data-tid="closed-captions-container"]')].find(visible)
 if(!root)return {session:null,segments:[]}
 const scope=window as unknown as {__linguaMeeting?:{root:Element;session:string;ids:WeakMap<Element,string>;next:number}}
 if(scope.__linguaMeeting?.root!==root)scope.__linguaMeeting={root,session:crypto.randomUUID(),ids:new WeakMap(),next:0}
 const state=scope.__linguaMeeting!
 const rows=[...root.querySelectorAll('[data-tid="closed-caption-item"], [data-tid="closed-caption-v2-item"]')].filter(visible)
 const segments=rows.slice(-30).flatMap(row=>{
  const body=row.querySelector('[data-tid="closed-caption-text"], [data-tid="closed-caption-v2-text"]')
  if(!body||!visible(body))return []
  const text=(body.textContent||'').replace(/\s+/g,' ').trim().slice(0,4000)
  if(!text)return []
  if(!state.ids.has(row))state.ids.set(row,String(++state.next))
  const speaker=row.querySelector('[data-tid="closed-caption-speaker-name"]')
  return [{id:state.ids.get(row)!,text,speaker:speaker&&visible(speaker)?(speaker.textContent||'').trim().slice(0,100):'',timestamp:Date.now()}]
 })
 return {session:state.session,segments}
}
