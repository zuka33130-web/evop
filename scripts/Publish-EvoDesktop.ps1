<# Builds a portable Windows x64 package: WebView2 shell + React + native engine. #>
[CmdletBinding()]
param([string]$OutputDir = "")
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutputDir) { $OutputDir = Join-Path $root 'dist-native\desktop-win-x64' }
$OutputDir = [IO.Path]::GetFullPath($OutputDir)
Push-Location $root
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Falló el build frontend.' }
    dotnet publish src-native/EvoDesktop/EvoDesktop.csproj -c Release -r win-x64 --self-contained true -o $OutputDir
    if ($LASTEXITCODE -ne 0) { throw 'Falló la publicación de EvoDesktop.' }
    $engineDir = Join-Path $OutputDir 'engine'
    dotnet publish src-native/EvoNativeEngine/EvoNativeEngine.csproj -c Release -r win-x64 --self-contained true -o $engineDir
    if ($LASTEXITCODE -ne 0) { throw 'Falló la publicación del motor.' }
    $wwwroot = Join-Path $engineDir 'wwwroot'
    if (Test-Path $wwwroot) { throw 'La carpeta wwwroot ya existe. Usa un OutputDir nuevo para evitar mezclar versiones.' }
    New-Item -ItemType Directory -Force -Path $wwwroot | Out-Null
    Copy-Item (Join-Path $root 'dist\*') $wwwroot -Recurse -Force
    Write-Host "Paquete listo: $OutputDir\EvoDesktop.exe"
    Write-Host 'Requiere WebView2 Evergreen Runtime. No requiere Node ni SDK .NET en el equipo de destino.'
    Write-Host 'Inicia sin elevación. Operaciones que requieren administrador permanecerán bloqueadas.'
}
finally { Pop-Location }
