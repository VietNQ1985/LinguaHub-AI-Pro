// Read-only Teams captions from the visible meeting pane. No microphone capture.
const visible = e => {
  if (!(e instanceof Element)) return false;
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0
    && s.display!=='none'&&s.visibility!=='hidden';
};
const roots=[
 '[data-tid="closed-caption-container"]',
 '[data-tid="closed-captions-renderer"]',
 '[data-tid="closed-captions-container"]',
 '[data-tid="closed-caption-v2-container"]',
 '[data-tid="closed-caption-v2-window-wrapper"]',
 '[data-tid="closed-caption-v2-renderer"]',
 '[data-tid="closed-caption-renderer-wrapper"]',
 '[data-tid="closed-captions-v2-items-renderer"]',
];
const root=[...document.querySelectorAll(roots.join(','))].find(visible);
if (!root) return {session:null,segments:[],diagnostics:{captionVisible:false}};
if (!globalThis.__linguaMeeting || globalThis.__linguaMeeting.root!==root) {
  globalThis.__linguaMeeting={root,session:crypto.randomUUID(),ids:new WeakMap(),next:0};
}
const state=globalThis.__linguaMeeting;
const rowsSelector='[data-tid="closed-caption-item"],[data-tid="closed-caption-v2-item"],[data-tid="closed-caption-v2-utterance"],[data-tid="closed-caption-utterance"]';
const bodySelector='[data-tid="closed-caption-text"],[data-tid="closed-caption-v2-text"],[data-tid="closed-caption-v2-text-content"],[data-tid="closed-caption-text-content"]';
let rows=[...root.querySelectorAll(rowsSelector)].filter(visible);
rows=rows.filter(row=>!rows.some(other=>other!==row&&row.contains(other)));
for(const body of root.querySelectorAll(bodySelector)){
 if(visible(body)&&!rows.some(row=>row===body||row.contains(body)))rows.push(body);
}
rows.sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);
const segments=[];
for(const row of rows.slice(-30)){
 const body=row.matches(bodySelector)?row:(row.querySelector(bodySelector) || row);
 const clone=body.cloneNode(true);
 clone.querySelectorAll('button,[role="button"],[aria-hidden="true"],[data-tid*="speaker"]').forEach(el=>el.remove());
 const text=(clone.textContent||'').replace(/\s+/g,' ').trim().slice(0,2000);
 if(!text)continue;
 if(!state.ids.has(row))state.ids.set(row,String(++state.next));
 const speaker=row.querySelector('[data-tid="closed-caption-speaker-name"],[data-tid="closed-caption-v2-speaker-name"],[data-tid="closed-caption-v2-speaker"]');
 segments.push({id:state.ids.get(row),text,speaker:speaker?.textContent?.trim().slice(0,100)||'',timestamp:Date.now()});
}
return {session:state.session,segments,diagnostics:{captionVisible:true}};
