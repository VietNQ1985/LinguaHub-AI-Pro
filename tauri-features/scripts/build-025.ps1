param([switch]$SkipTests)
$ErrorActionPreference='Stop'
$src='D:\Documents\ChatGPT\LinguaHub-AI-Pro\tauri-features'
$dst='C:\lhb-20261105'
foreach($folder in @('src','src-tauri\src')){Copy-Item -LiteralPath (Join-Path $src $folder) -Destination (Split-Path (Join-Path $dst $folder) -Parent) -Recurse -Force}
foreach($file in @('package.json','package-lock.json','src-tauri\Cargo.toml','src-tauri\Cargo.lock','src-tauri\tauri.conf.json')){Copy-Item -LiteralPath (Join-Path $src $file) -Destination (Join-Path $dst $file) -Force}
$vs='C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools'
$dev=Join-Path $vs 'Common7\Tools\VsDevCmd.bat'
$lines=cmd.exe /d /s /c "`"$dev`" -no_logo && set"
foreach($line in $lines){$i=$line.IndexOf('=');if($i -gt 0){[Environment]::SetEnvironmentVariable($line.Substring(0,$i),$line.Substring($i+1),'Process')}}
$env:LIBCLANG_PATH='C:\lhb-20261105\.build-deps\llvm\bin'
$env:PATH='C:\Users\VietNguyenQuoc\.cargo\bin;'+$env:LIBCLANG_PATH+';'+(Join-Path $vs 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin')+';'+$env:PATH
Set-Location $dst
if(-not $SkipTests){cargo test --release --manifest-path src-tauri/Cargo.toml
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}}
npm run dist
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$installer='C:\lhb-20261105\src-tauri\target\release\bundle\nsis\LinguaHub_0.2.5_x64-setup.exe'
if((Get-Item -LiteralPath $installer).Length -lt 2000000){throw 'Installer quá nhỏ'}
$destination='C:\Users\VietNguyenQuoc\Downloads\LinguaHub-AI-Pro-Setup-0.2.5.exe'
Copy-Item -LiteralPath $installer -Destination $destination -Force
Get-Item -LiteralPath $destination | Select-Object FullName,Length
Get-FileHash -LiteralPath $destination -Algorithm SHA256
