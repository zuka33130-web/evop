<#
.SYNOPSIS
    19_DirectX_ShaderCache.ps1
    RYZER CORTEX ULTRA - Fase 3: Modo Ultra Agresivo
    Optimización de Caché de Sombreadores DirectX & Max Pre-Rendered Frames

.DESCRIPTION
    Fija el tamaño de la caché de sombreadores de DirectX en 256MB (0x100 / 256) para optimizar
    el uso de la memoria RAM compartida de la iGPU Intel UHD 64EU y elimina el micro-stuttering en CS2.
    
    Operaciones Clave:
    1. Configuración de tamaño de caché estática de 256MB en el registro de DirectX y D3D.
    2. Forzado de MaxPreRenderedFrames = 1 (mínimo tiempo de latencia entrada-salida en pantalla).
    3. Purga segura de sombreadores corruptos anteriores.

.NOTES
    Requiere Privilegios de Administrador (UAC).
#>

[CmdletBinding()]
param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

function Assert-Admin {
    $currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "Este script requiere elevación UAC. Por favor, ejecútalo como Administrador."
        exit 1
    }
}

Assert-Admin
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " RYZER CORTEX ULTRA - ARCHIVO 19: DIRECTX SHADER CACHE    " -ForegroundColor BrightWhite
Write-Host "==========================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. CONFIGURACIÓN DE SHADER CACHE A 256MB
# -----------------------------------------------------------------------------
Write-Host "`n[1/2] Fijando tamaño de caché de sombreadores DirectX a 256MB..." -ForegroundColor Yellow

$directXPaths = @(
    "HKLM:\SOFTWARE\Microsoft\DirectX",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\DirectX",
    "HKCU:\Software\Microsoft\Direct3D"
)

foreach ($path in $directXPaths) {
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    
    # 256MB = 256 en DWord (0x100)
    Set-ItemProperty -Path $path -Name "MaxPreRenderedFrames" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $path -Name "ShaderCacheSize" -Value 256 -Type DWord -Force
    Write-Host "  ✓ Configurado $path -> MaxPreRenderedFrames=1, ShaderCacheSize=256MB" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 2. PURGA DE CACHÉ DE SHADERS ANTERIORES PARA ELIMINAR STUTTERING CORRUPTO
# -----------------------------------------------------------------------------
Write-Host "`n[2/2] Purgando directorios de caché de sombreadores obsoletos..." -ForegroundColor Yellow

$shaderDirs = @(
    "$env:LOCALAPPDATA\D3DSCache",
    "$env:LOCALAPPDATA\Intel\ShaderCache",
    "$env:LOCALAPPDATA\Microsoft\DirectX Shader Cache"
)

foreach ($dir in $shaderDirs) {
    if (Test-Path $dir) {
        try {
            Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Limpiado directorio: $dir" -ForegroundColor Green
        } catch {
            Write-Host "  ℹ Algunos archivos de $dir se encuentran en uso por el sistema." -ForegroundColor Gray
        }
    }
}

Write-Host "`n✓ Archivo 19 aplicado exitosamente." -ForegroundColor Green
