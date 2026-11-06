param([switch]$SkipTests, [string]$StagingPath)
$ErrorActionPreference = 'Stop'
$src = 'D:\Documents\ChatGPT\LinguaHub-AI-Pro\tauri-features'
$dst = if ($StagingPath) { [System.IO.Path]::GetFullPath($StagingPath) } else { $src }

if ($dst -ne $src) {
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    foreach ($folder in @('src', 'src-tauri\src')) {
        $destinationParent = Split-Path (Join-Path $dst $folder) -Parent
        New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $src $folder) -Destination $destinationParent -Recurse -Force
    }
    foreach ($file in @('package.json', 'package-lock.json', 'src-tauri\Cargo.toml', 'src-tauri\Cargo.lock', 'src-tauri\tauri.conf.json')) {
        Copy-Item -LiteralPath (Join-Path $src $file) -Destination (Join-Path $dst $file) -Force
    }
}

$vs = 'C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools'
$dev = Join-Path $vs 'Common7\Tools\VsDevCmd.bat'
$lines = cmd.exe /d /s /c "`"$dev`" -no_logo && set"
foreach ($line in $lines) {
    $i = $line.IndexOf('=')
    if ($i -gt 0) { [Environment]::SetEnvironmentVariable($line.Substring(0, $i), $line.Substring($i + 1), 'Process') }
}
$env:LIBCLANG_PATH = 'C:\lhb-20261105\.build-deps\llvm\bin'
$env:PATH = 'C:\Users\VietNguyenQuoc\.cargo\bin;' + $env:LIBCLANG_PATH + ';' + (Join-Path $vs 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin') + ';' + $env:PATH
Set-Location $dst

if (-not $SkipTests) {
    cargo test --release --manifest-path src-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

npm run dist
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$version = (Get-Content -LiteralPath (Join-Path $src 'package.json') -Raw | ConvertFrom-Json).version
$installer = Join-Path $dst "src-tauri\target\release\bundle\nsis\LinguaHub_${version}_x64-setup.exe"
$artifact = Get-Item -LiteralPath $installer
if ($artifact.Length -lt 2MB) { throw 'Installer thiếu thành phần hoặc có kích thước bất thường.' }
$artifactDirectory = Join-Path $src 'release'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
$destination = Join-Path $artifactDirectory "LinguaHub-AI-Pro-Setup-$version.exe"
Copy-Item -LiteralPath $installer -Destination $destination -Force
Get-Item -LiteralPath $destination | Select-Object FullName, Length
Get-FileHash -LiteralPath $destination -Algorithm SHA256
