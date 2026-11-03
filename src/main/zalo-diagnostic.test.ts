import {expect,test} from 'vitest'
import {zaloDiagnosticHost,zaloNetworkDiagnostic,zaloBlockedNavigationDiagnostic} from './zalo-diagnostic'
test('Zalo diagnostics exclude credentials, tokens, arbitrary domains and error messages',()=>{
 expect(zaloDiagnosticHost('https://id.zalo.me/account?token=SECRET#private')).toBe('id.zalo.me')
 expect(zaloDiagnosticHost('https://id.zalo.me.evil.test/')).toBe('other')
 expect(zaloDiagnosticHost('not a URL SECRET')).toBe('invalid')
 expect(zaloNetworkDiagnostic('https://chat.zalo.me/?token=SECRET','net::ERR_CONNECTION_RESET',503)).toEqual({host:'chat.zalo.me',code:'net::ERR_CONNECTION_RESET',status:503})
 expect(JSON.stringify(zaloNetworkDiagnostic('https://example.com/user/PRIVATE','SECRET',999))).toBe('{"host":"other","code":"network-error"}')
})
test('blocked navigation reports its destination without credentials or authentication parameters',()=>{
 expect(zaloBlockedNavigationDiagnostic('https://user:SECRET@oauth.example.com/callback?token=PRIVATE#SECRET')).toEqual({host:'oauth.example.com',code:'https:'})
 expect(zaloBlockedNavigationDiagnostic('about:blank')).toEqual({host:'none',code:'about:'})
 expect(zaloBlockedNavigationDiagnostic('invalid SECRET')).toEqual({host:'invalid',code:'invalid-url'})
})
