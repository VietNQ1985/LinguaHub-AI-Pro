$ErrorActionPreference = 'Stop'
$msbuild = 'C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Current\Bin\amd64\MSBuild.exe'
$project = 'D:\Documents\ChatGPT\LinguaHub-AI-Pro\tauri-features\src-tauri\target\release\build\whisper-rs-sys-5f3858d393f1466e\out\build\src\whisper.vcxproj'
$stdout = Join-Path $PSScriptRoot 'msbuild-whisper.stdout.log'
$stderr = Join-Path $PSScriptRoot 'msbuild-whisper.stderr.log'
$exitFile = Join-Path $PSScriptRoot 'msbuild-whisper.exit'
$errorFile = Join-Path $PSScriptRoot 'msbuild-whisper.worker-error.log'
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'msbuild-whisper.started') -Value (Get-Date -Format o) -Encoding Ascii
try {
  $buildArguments = @($project, '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/p:VisualStudioVersion=18.0', '/p:BuildProjectReferences=false', '/m:2', '/v:minimal')
  $buildProcess = Start-Process -FilePath $msbuild -ArgumentList $buildArguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  Set-Content -LiteralPath $exitFile -Value $buildProcess.ExitCode -Encoding Ascii
} catch {
  Set-Content -LiteralPath $errorFile -Value ($_ | Out-String) -Encoding UTF8
}
