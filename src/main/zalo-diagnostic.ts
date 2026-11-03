// Never retain URL paths, queries, fragments, credentials, headers or response bodies.
export function zaloDiagnosticHost(value:string){
 try{const host=new URL(value).hostname.toLowerCase();return host==='jr.zaloapp.com'||/(^|\.)(zalo\.me|zdn\.vn)$/.test(host)?host:'other'}catch{return 'invalid'}
}
export function zaloNetworkDiagnostic(url:string,error:string,status?:number){
 return {host:zaloDiagnosticHost(url),code:/^net::ERR_[A-Z0-9_]+$/.test(error)?error:'network-error',...(Number.isInteger(status)&&status!>=100&&status!<=599?{status}: {})}
}
export function zaloBlockedNavigationDiagnostic(value:string){
 try{const url=new URL(value);return {host:url.hostname||'none',code:url.protocol}}
 catch{return {host:'invalid',code:'invalid-url'}}
}
