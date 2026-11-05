/** Repair only illegal backslash escapes inside JSON strings; never alter structure or values outside strings. */
export function parseAiJson(content:string):unknown{
 const source=content.trim().replace(/^```(?:json)?\s*\n?/i,'').replace(/\n?```$/,'')
 try{return JSON.parse(source)}catch(original){
  let output='',quoted=false,changed=false
  for(let i=0;i<source.length;i++){
   const c=source[i]
   if(c==='"'){quoted=!quoted;output+=c;continue}
   if(quoted&&c==='\\'){
    const next=source[i+1]
    if(next&&('"\\/bfnrt'.includes(next)||(next==='u'&&/^[0-9a-f]{4}$/i.test(source.slice(i+2,i+6))))){output+=c+next;i++;continue}
    output+='\\\\';changed=true;continue
   }
   output+=c
  }
  if(!changed)throw new Error('AI trả dữ liệu sai cấu trúc. Anh thử dịch lại tin này.')
  try{return JSON.parse(output)}catch{throw new Error('AI trả dữ liệu sai cấu trúc. Anh thử dịch lại tin này.')}
 }
}
