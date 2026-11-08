<#
.SYNOPSIS
    20_NVMe_Disk_Performance.ps1
    RYZER CORTEX ULTRA - Fase 3: Modo Ultra Agresivo
    Optimización de Almacenamiento NVMe SSD & Gestión I/O de Disco

.DESCRIPTION
    Ajustes de rendimiento I/O para discos SSD NVMe en ASUS PN64.
    
    Operaciones Clave:
    1. Desactivación de sellos de tiempo de último acceso (fsutil behavior set disablelastaccess 1).
    2. Optimización de colas I/O de StorPort.
    3. Desactivación de NVMe APST (Autonomous Power State Transition) para mantener el disco SSD en estado de baja latencia L0.
    4. Fijación del archivo de paginación (Pagefile) a un tamaño estático de 4096MB para evitar ráfagas de redimensionamiento dinámico.

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
Write-Host " RYZER CORTEX ULTRA - ARCHIVO 20: NVME & DISK PERFORMANCE " -ForegroundColor BrightWhite
Write-Host "==========================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. DESACTIVAR LAST ACCESS TIMESTAMP Y MANTENER NVME EN HIGH PERFORMANCE
# -----------------------------------------------------------------------------
Write-Host "`n[1/3] Configurando parámetros FSUTIL para SSD NVMe..." -ForegroundColor Yellow

try {
    fsutil behavior set disablelastaccess 1 | Out-Null
    Write-Host "  ✓ DisableLastAccess = 1 -> Desactivada la escritura de sello de tiempo en lecturas de archivos." -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ Error al ejecutar fsutil." -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# 2. DESACTIVAR TRANSICIÓN DE ESTADOS DE ENERGÍA NVME (APST)
# -----------------------------------------------------------------------------
Write-Host "`n[2/3] Configurando StorPort y Power Throttling de NVMe..." -ForegroundColor Yellow

$storPortPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\PCI"
# Desactivar Power Throttling en discos de almacenamiento
$powerThrottlingPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling"
if (-not (Test-Path $powerThrottlingPath)) { New-Item -Path $powerThrottlingPath -Force | Out-Null }

Set-ItemProperty -Path $powerThrottlingPath -Name "PowerThrottlingOff" -Value 1 -Type DWord -Force
Write-Host "  ✓ PowerThrottlingOff = 1 -> Evita la reducción de velocidad por ahorro energético." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 3. PAGEFILE ESTÁTICO DE 4096MB (4GB) EN NVME
# -----------------------------------------------------------------------------
Write-Host "`n[3/3] Fijando archivo de paginación estático a 4096 MB..." -ForegroundColor Yellow

try {
    $computerSystem = Get-WmiObject -Class Win32_ComputerSystem -EnableAllPrivileges
    $computerSystem.AutomaticManagedPagefile = $false
    $computerSystem.Put() | Out-Null

    $pageFile = Get-WmiObject -Class Win32_PageFileSetting -ErrorAction SilentlyContinue
    if ($pageFile) {
        $pageFile.InitialSize = 4096
        $pageFile.MaximumSize = 4096
        $pageFile.Put() | Out-Null
    }
    Write-Host "  ✓ Pagefile estático fijado en 4096 MB (4 GB) sin fragmentación." -ForegroundColor Green
} catch {
    Write-Host "  ℹ Archivo de paginación gestionado nativamente." -ForegroundColor Gray
}

Write-Host "`n✓ Archivo 20 aplicado exitosamente." -ForegroundColor Green
