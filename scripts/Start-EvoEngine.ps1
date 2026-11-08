<#
.SYNOPSIS
    Inicia el motor nativo de optimización C# (.NET 8) para EVOOPTIMIZER en Windows 11.
.DESCRIPTION
    Verifica que el entorno .NET 8 esté disponible, restaura dependencias y lanza el servicio
    enlace IPC en http://127.0.0.1:48120 con permisos de usuario estándar (o Administrador si se solicita).
#>

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  EVOOPTIMIZER — Motor Nativo C# .NET 8 (Windows 11)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Join-Path (Split-Path -Parent $scriptDir) "src-native\EvoNativeEngine"

if (-not (Test-Path $projectDir)) {
    Write-Error "No se encontró el directorio del proyecto en: $projectDir"
    exit 1
}

# Comprobar si dotnet está instalado
$dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetCmd) {
    Write-Host "[!] .NET 8 SDK no está instalado o no se encuentra en el PATH." -ForegroundColor Yellow
    Write-Host "    Descárgalo gratuitamente desde: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor White
    exit 1
}

$dotnetVersion = dotnet --version
Write-Host "[✓] .NET detectado: versión $dotnetVersion" -ForegroundColor Green

# Comprobar privilegios administrativos
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Host "[✓] Ejecutando con permisos de Administrador (Modo Completo)" -ForegroundColor Green
} else {
    Write-Host "[i] Ejecutando como Usuario Estándar. (Diagnóstico de solo lectura 100% operativo)" -ForegroundColor Yellow
}

Write-Host "[*] Iniciando EvoNativeEngine en http://127.0.0.1:48120..." -ForegroundColor Cyan
Set-Location $projectDir
dotnet run
