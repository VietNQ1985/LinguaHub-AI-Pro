import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Places another app's window (Zalo PC and its call window) inside LinguaHub on Windows by making it a
// child window (SetParent). One long-lived PowerShell process hosts a tiny Win32 helper; commands are JSON lines.
// Every embedded window is given back (original parent and style) when LinguaHub releases it or quits.

const HELPER = String.raw`
Add-Type -TypeDefinition @"
using System; using System.Collections.Generic; using System.Diagnostics; using System.Runtime.InteropServices; using System.Text;
public static class LhEmbed {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll")] static extern IntPtr GetWindowLongPtr(IntPtr h, int i);
  [DllImport("user32.dll")] static extern IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  static readonly Dictionary<long, long> styles = new Dictionary<long, long>();
  public static string Find(string process) {
    var found = new List<string>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      string name; try { name = Process.GetProcessById((int)pid).ProcessName; } catch { return true; }
      if (!string.Equals(name, process, StringComparison.OrdinalIgnoreCase)) return true;
      var c = new StringBuilder(256); GetClassName(h, c, 256);
      var t = new StringBuilder(256); GetWindowText(h, t, 256);
      found.Add(h.ToInt64() + "|" + c.ToString().Replace("|", " ") + "|" + t.ToString().Length);
      return true;
    }, IntPtr.Zero);
    return string.Join(";", found);
  }
  const int GWL_STYLE = -16; const long WS_CHILD = 0x40000000, WS_POPUP = 0x80000000, FRAME = 0x00C00000 | 0x00040000 | 0x00030000 | 0x00080000;
  public static bool Embed(long child, long host, int x, int y, int w, int h) {
    var c = new IntPtr(child); if (!IsWindow(c)) return false;
    if (!styles.ContainsKey(child)) styles[child] = GetWindowLongPtr(c, GWL_STYLE).ToInt64();
    SetWindowLongPtr(c, GWL_STYLE, new IntPtr((styles[child] & ~(WS_POPUP | FRAME)) | WS_CHILD));
    SetParent(c, new IntPtr(host));
    return Move(child, x, y, w, h, true);
  }
  public static bool Move(long child, int x, int y, int w, int h, bool show) {
    var c = new IntPtr(child); if (!IsWindow(c)) return false;
    SetWindowPos(c, IntPtr.Zero, x, y, w, h, 0x0020 | 0x0004);
    ShowWindow(c, show ? 5 : 0); return true;
  }
  public static bool Release(long child) {
    var c = new IntPtr(child); if (!IsWindow(c)) { styles.Remove(child); return false; }
    SetParent(c, IntPtr.Zero);
    if (styles.ContainsKey(child)) { SetWindowLongPtr(c, GWL_STYLE, new IntPtr(styles[child])); styles.Remove(child); }
    SetWindowPos(c, IntPtr.Zero, 120, 80, 1100, 760, 0x0020 | 0x0004 | 0x0040);
    ShowWindow(c, 5); return true;
  }
}
"@
while ($true) {
  $line = [Console]::In.ReadLine(); if ($null -eq $line) { break }
  try {
    $m = $line | ConvertFrom-Json
    $r = switch ($m.op) {
      'find' { [LhEmbed]::Find($m.process) }
      'embed' { [LhEmbed]::Embed([int64]$m.child, [int64]$m.host, $m.x, $m.y, $m.w, $m.h) }
      'move' { [LhEmbed]::Move([int64]$m.child, $m.x, $m.y, $m.w, $m.h, [bool]$m.show) }
      'release' { [LhEmbed]::Release([int64]$m.child) }
      'alive' { [LhEmbed]::IsWindow([IntPtr][int64]$m.child) }
    }
    [Console]::Out.WriteLine((@{ id = $m.id; ok = $true; value = $r } | ConvertTo-Json -Compress))
  } catch { [Console]::Out.WriteLine((@{ id = $m.id; ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress)) }
}
`

export type Rect = { x: number; y: number; w: number; h: number }
export type FoundWindow = { hwnd: string; className: string; titleLength: number }

export class WindowEmbedder {
  private helper: ChildProcessWithoutNullStreams | null = null
  private next = 0
  private waiting = new Map<number, (value: { ok: boolean; value?: unknown; error?: string }) => void>()
  private embedded = new Set<string>()

  constructor(private directory: string) {}

  private start() {
    if (this.helper && !this.helper.killed) return this.helper
    // The fixed helper is written by the app itself (never taken from elsewhere) and rewritten on every start.
    const script = join(this.directory, 'win-embed-helper.ps1')
    writeFileSync(script, '﻿' + HELPER.replace(/\r?\n/g, '\r\n'), 'utf8')
    const helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true })
    createInterface({ input: helper.stdout }).on('line', line => {
      try {
        const message = JSON.parse(line) as { id: number; ok: boolean; value?: unknown; error?: string }
        this.waiting.get(message.id)?.(message)
        this.waiting.delete(message.id)
      } catch { /* PowerShell banner or warnings */ }
    })
    helper.on('exit', () => { this.helper = null; for (const resolve of this.waiting.values()) resolve({ ok: false, error: 'helper exited' }); this.waiting.clear() })
    this.helper = helper
    return helper
  }

  private call(command: Record<string, unknown>) {
    const helper = this.start()
    const id = ++this.next
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => { this.waiting.delete(id); reject(new Error('Window helper timed out')) }, 15000)
      this.waiting.set(id, message => { clearTimeout(timer); if (message.ok) resolve(message.value); else reject(new Error(message.error || 'Window helper failed')) })
      helper.stdin.write(JSON.stringify({ id, ...command }) + '\r\n')
    })
  }

  async find(processName: string): Promise<FoundWindow[]> {
    const raw = String(await this.call({ op: 'find', process: processName }) || '')
    return raw.split(';').filter(Boolean).map(entry => { const [hwnd, className, titleLength] = entry.split('|'); return { hwnd, className, titleLength: Number(titleLength) || 0 } })
  }

  async embed(child: string, host: string, rect: Rect) {
    const ok = await this.call({ op: 'embed', child, host, ...rect }) === true
    if (ok) this.embedded.add(child)
    return ok
  }

  async move(child: string, rect: Rect, show: boolean) {
    const ok = await this.call({ op: 'move', child, ...rect, show }) === true
    if (!ok) this.embedded.delete(child)
    return ok
  }

  isEmbedded(child: string) { return this.embedded.has(child) }
  embeddedWindows() { return [...this.embedded] }

  async release(child: string) {
    this.embedded.delete(child)
    return await this.call({ op: 'release', child }).catch(() => false) === true
  }

  async releaseAll() {
    for (const child of [...this.embedded]) await this.release(child)
  }

  stop() {
    this.helper?.stdin.end()
    this.helper = null
  }
}
