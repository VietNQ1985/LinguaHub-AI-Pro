export function isWorkspaceUrl(service:'whatsapp'|'teams'|'zalo',value:string){
  try{
    const url=new URL(value)
    if(url.protocol!=='https:' || url.username || url.password)return false
    if(service==='zalo')return ['chat.zalo.me','id.zalo.me'].includes(url.hostname)
    return (service==='whatsapp'?/(^|\.)whatsapp\.com$/:/(^|\.)(microsoft\.com|microsoftonline\.com|live\.com|cloud\.microsoft)$/).test(url.hostname)
  }catch{return false}
}

export function isSafeExternalWebUrl(value:string){
  try{
    const url=new URL(value)
    if(url.protocol!=='https:'||url.username||url.password)return false
    const host=url.hostname.toLowerCase().replace(/\.$/,'')
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.includes(':'))return false
    const parts=host.split('.').map(Number)
    const isIpv4=parts.length===4&&parts.every(part=>Number.isInteger(part)&&part>=0&&part<=255)
    if(isIpv4){
      const [first,second]=parts
      if(first===0||first===10||first===127||first>=224||first===169&&second===254||first===172&&second>=16&&second<=31||first===192&&second===168)return false
    }
    return true
  }catch{return false}
}

export function isZaloStorageRequest(permission:string,top:string,origin:string,owned:boolean){return owned&&(permission==='storage-access'||permission==='top-level-storage-access')&&isWorkspaceUrl('zalo',top)&&isWorkspaceUrl('zalo',origin)}
