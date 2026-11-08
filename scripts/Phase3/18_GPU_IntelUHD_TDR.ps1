<#
.SYNOPSIS
    18_GPU_IntelUHD_TDR.ps1
    RYZER CORTEX ULTRA - Fase 3: Modo Ultra Agresivo
    Optimización de GPU Intel UHD (64EU) & Ajustes TDR (Timeout Detection and Recovery)

.DESCRIPTION
    Ajustes del controlador de pantalla e iGPU para Intel UHD Graphics 64EU en procesador i3-1220P.
    
    Operaciones Clave:
    1. Previene el reseteo del driver de pantalla aumentando el TDR (Timeout Detection and Recovery) a 10 segundos
       (TdrDelay=10, TdrDdiDelay=10). Evita cuelgues o pantallas negras durante compilaciones pesadas de shaders en CS2.
    2. Configuración de caché de sombreadores a nivel de controlador.
    3. Desactivación de ahorro de energía agresivo en la GPU integradas (Frame Buffer Compression / PSR).

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
Write-Host " RYZER CORTEX ULTRA - ARCHIVO 18: GPU INTEL UHD & TDR     " -ForegroundColor BrightWhite
Write-Host "==========================================================" -ForegroundColor Cyan

$graphicsControlPath = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"

# -----------------------------------------------------------------------------
# 1. AJUSTES TDR (TIMEOUT DETECTION AND RECOVERY)
# -----------------------------------------------------------------------------
Write-Host "`n[1/2] Ajustando parámetros TDR en GraphicsDrivers..." -ForegroundColor Yellow

# TdrDelay = 10 (segundos de gracia antes de reiniciar la GPU si se congela)
Set-ItemProperty -Path $graphicsControlPath -Name "TdrDelay" -Value 10 -Type DWord -Force
Write-Host "  ✓ TdrDelay = 10s -> Evita reseteos del driver durante la carga de mapas en CS2." -ForegroundColor Green

# TdrDdiDelay = 10 (segundos para llamadas DirectX DDI)
Set-ItemProperty -Path $graphicsControlPath -Name "TdrDdiDelay" -Value 10 -Type DWord -Force
Write-Host "  ✓ TdrDdiDelay = 10s -> Protección contra cuelgues en el kernel D3D." -ForegroundColor Green

# Halg (Hardware Accelerated GPU Scheduling - HAGS si aplica)
Set-ItemProperty -Path $graphicsControlPath -Name "HwSchMode" -Value 2 -Type DWord -Force
Write-Host "  ✓ HwSchMode = 2 -> HAGS (Planificación de GPU acelerada por hardware) activado." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. DESACTIVACIÓN DE AHORRO DE ENERGÍA EN INTEL UHD 64EU
# -----------------------------------------------------------------------------
Write-Host "`n[2/2] Desactivando throttling y compresión de ahorro de energía en la iGPU..." -ForegroundColor Yellow

$igpuRegistryPaths = Get-ChildItem -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}" -ErrorAction SilentlyContinue |
    Where-Object { $_.PSChildName -match "^\d{4}$" }

foreach ($key in $igpuRegistryPaths) {
    $path = $key.PSPath
    $provider = (Get-ItemProperty -Path $path -Name "ProviderName" -ErrorAction SilentlyContinue).ProviderName
    
    if ($provider -like "*Intel*") {
        # Desactivar Frame Buffer Compression (FBC)
        Set-ItemProperty -Path $path -Name "DisableFBC" -Value 1 -Type DWord -Force
        # Desactivar PSR (Panel Self Refresh si aplica)
        Set-ItemProperty -Path $path -Name "DisablePSR" -Value 1 -Type DWord -Force
        # Desactivar variaciones dinámicas de tasa de refresco
        Set-ItemProperty -Path $path -Name "DisableDisplayRefreshRateSwitch" -Value 1 -Type DWord -Force
        
        Write-Host "  ✓ Intel UHD Config (Clave: $($key.PSChildName)) -> FBC/PSR desactivados para máximo fillrate." -ForegroundColor Green
    }
}

Write-Host "`n✓ Archivo 18 aplicado exitosamente." -ForegroundColor Green
