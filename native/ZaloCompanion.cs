using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

// A narrow window-placement helper. No injection, SetParent, input, chat reading or networking.
class ZaloCompanion {
 [StructLayout(LayoutKind.Sequential)] struct Point { public int x,y; }
 [StructLayout(LayoutKind.Sequential)] struct Rect { public int left,top,right,bottom; }
 [StructLayout(LayoutKind.Sequential)] struct Placement { public int length,flags,show; public Point min,max; public Rect normal; }
 delegate bool EnumProc(IntPtr hwnd,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr data);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd,uint command);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
 [DllImport("user32.dll")] static extern bool GetWindowPlacement(IntPtr hwnd,ref Placement placement);
 [DllImport("user32.dll")] static extern bool SetWindowPlacement(IntPtr hwnd,ref Placement placement);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd,int command);
 [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 public class Command { public int id {get;set;} public string op {get;set;} public int x {get;set;} public int y {get;set;} public int width {get;set;} public int height {get;set;} }
 static string executable;
 static IntPtr target;
 static uint targetPid;
 static Placement original;
 static Rect last;
 static bool placed;
 static bool Owned(IntPtr hwnd) {
  try { uint pid;GetWindowThreadProcessId(hwnd,out pid);
   using(var process=Process.GetProcessById((int)pid)) {
    return String.Equals(process.ProcessName,"Zalo",StringComparison.OrdinalIgnoreCase)&&String.Equals(Path.GetFullPath(process.MainModule.FileName),executable,StringComparison.OrdinalIgnoreCase);
   }
  } catch { return false; }
 }
 static bool Bound() { uint pid;GetWindowThreadProcessId(target,out pid);return target!=IntPtr.Zero&&pid==targetPid&&Owned(target); }
 static bool Find() {
  if(Bound())return true;
  placed=false;target=IntPtr.Zero;long largest=0;
  EnumWindows(delegate(IntPtr hwnd,IntPtr unused) {
   Rect r;if(!IsWindowVisible(hwnd)||GetWindow(hwnd,4)!=IntPtr.Zero||!Owned(hwnd)||!GetWindowRect(hwnd,out r))return true;
   long area=(long)(r.right-r.left)*(r.bottom-r.top);
   if(area>largest&&r.right-r.left>=200&&r.bottom-r.top>=200){largest=area;target=hwnd;}
   return true;
  },IntPtr.Zero);
  if(target==IntPtr.Zero)return false;
  GetWindowThreadProcessId(target,out targetPid);return true;
 }
 static bool Same(Rect a,Rect b) { return Math.Abs(a.left-b.left)<4&&Math.Abs(a.top-b.top)<4&&Math.Abs(a.right-b.right)<4&&Math.Abs(a.bottom-b.bottom)<4; }
 static void Release() {
  Rect current;
  // Respect manual movement after arrangement. Never touch a reused HWND/process.
  if(placed&&Bound()&&GetWindowRect(target,out current)&&Same(current,last))SetWindowPlacement(target,ref original);
  placed=false;target=IntPtr.Zero;
 }
 static bool Place(Command c) {
  if(c.width<400||c.width>16000||c.height<300||c.height>16000||Math.Abs((long)c.x)>100000||Math.Abs((long)c.y)>100000||!Find())return false;
  if(!placed){original=new Placement();original.length=Marshal.SizeOf(typeof(Placement));if(!GetWindowPlacement(target,ref original))return false;}
  ShowWindow(target,9); // Restore a minimized/maximized window before sizing.
  if(!SetWindowPos(target,IntPtr.Zero,c.x,c.y,c.width,c.height,0x0010|0x0200))return false;
  placed=GetWindowRect(target,out last);
  Rect wanted=new Rect {left=c.x,top=c.y,right=c.x+c.width,bottom=c.y+c.height};
  if(!placed||!Same(last,wanted)){Release();return false;}
  return true;
 }
 static int Main(string[] args) {
  if(args.Length!=1||!Path.IsPathRooted(args[0])||!String.Equals(Path.GetFileName(args[0]),"Zalo.exe",StringComparison.OrdinalIgnoreCase))return 2;
  executable=Path.GetFullPath(args[0]);
  Console.InputEncoding=new UTF8Encoding(false);Console.OutputEncoding=new UTF8Encoding(false);
  try{SetThreadDpiAwarenessContext(new IntPtr(-4));}catch(EntryPointNotFoundException){}
  var json=new JavaScriptSerializer();json.MaxJsonLength=4096;
  try { string line;while((line=Console.ReadLine())!=null) {
   if(line.Length>4096)break;
   Command command=null;
   try{command=json.Deserialize<Command>(line);bool ok=false;
    if(command.op=="find")ok=Find();
    else if(command.op=="place")ok=Place(command);
    else if(command.op=="release"){Release();ok=true;}
    Console.WriteLine(json.Serialize(new {id=command.id,ok=ok}));
   }catch{Console.WriteLine(json.Serialize(new {id=command==null?0:command.id,ok=false}));}
  }}finally{Release();}
  return 0;
 }
}
