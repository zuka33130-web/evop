<#
.SYNOPSIS
    21_Safe_Services_Policy.ps1
    RYZER CORTEX ULTRA - Fase 3: Modo Ultra Agresivo
    Política de Servicios Segura para Gaming (Preservando WSL, Hyper-V y Usabilidad General)

.DESCRIPTION
    Configuración de servicios de Windows 11 para reducir la carga de CPU en segundo plano.
    
    Correcciones Arquitectónicas Aplicadas:
    1. PRESERVACIÓN DE COMPONENTES DE WINDOWS:
       Se ELIMINAN los comandos agresivos de 'Disable-WindowsOptionalFeature' (que desinstalaban WSL, Hyper-V o Windows Media Player).
    2. DESACTIVACIÓN SEGURA DE SERVICIOS SECUNDARIOS:
       En su lugar, los servicios no esenciales para juegos (como telemetría, informes de errores WER, seguimiento de diagnóstico)
       se configuran en tipo de inicio 'Disabled' o 'Manual' mediante 'Set-Service', preservando las dependencias del PC
       para un entorno de uso general sin desinstalar características del sistema operativo.

.NOTES
    Requiere Privilegios de Administrador (UAC).
#>

[CmdletBinding()]
param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

function Assert-Admin {
    $currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "Este script requiere elevación UAC. Por favor, ejecútalo como Administrador."
        exit 1
    }
}

Assert-Admin
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " RYZER CORTEX ULTRA - ARCHIVO 21: POLÍTICA SEGURA DE SERVICIOS " -ForegroundColor BrightWhite
Write-Host "==========================================================" -ForegroundColor Cyan

# Lista de servicios secundarios a ajustar a inicio Manual o Desactivado
$safeServicesToDisable = @(
    @{ Name = "DiagTrack"; Description = "Experiencias de usuario conectadas y telemetría" },
    @{ Name = "dmwappushservice"; Description = "Servicio WAP Push de enrutamiento de mensajes" },
    @{ Name = "WerSvc"; Description = "Servicio de informe de errores de Windows" },
    @{ Name = "MapsBroker"; Description = "Administrador de mapas descargados" },
    @{ Name = "PcaSvc"; Description = "Servicio del Asistente para la compatibilidad de programas" }
)

$safeServicesToManual = @(
    @{ Name = "RemoteRegistry"; Description = "Registro remoto" },
    @{ Name = "TrkWks"; Description = "Cliente de seguimiento de vínculos distribuidos" },
    @{ Name = "SysMain"; Description = "Superfetch / Prefetch dinámico (Opcional en SSD NVMe)" }
)

Write-Host "`n[1/2] Configurando servicios secundarios en inicio 'Disabled'..." -ForegroundColor Yellow
foreach ($svc in $safeServicesToDisable) {
    $serviceInstance = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
    if ($serviceInstance) {
        try {
            Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
            Set-Service -Name $svc.Name -StartupType Disabled -ErrorAction Stop
            Write-Host "  ✓ Servicio '$($svc.Name)' ($($svc.Description)) -> StartupType = Disabled" -ForegroundColor Green
        } catch {
            Write-Host "  ℹ No se pudo modificar '$($svc.Name)' (servicio protegido)." -ForegroundColor Gray
        }
    } else {
        Write-Host "  ℹ Servicio '$($svc.Name)' no presente en la instalación actual." -ForegroundColor Gray
    }
}

Write-Host "`n[2/2] Configurando servicios en inicio 'Manual' (Bajo Demanda)..." -ForegroundColor Yellow
foreach ($svc in $safeServicesToManual) {
    $serviceInstance = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
    if ($serviceInstance) {
        try {
            Set-Service -Name $svc.Name -StartupType Manual -ErrorAction Stop
            Write-Host "  ✓ Servicio '$($svc.Name)' ($($svc.Description)) -> StartupType = Manual" -ForegroundColor Green
        } catch {
            Write-Host "  ℹ No se pudo modificar '$($svc.Name)'." -ForegroundColor Gray
        }
    }
}

Write-Host "`n✓ Archivo 21 aplicado exitosamente. WSL, Hyper-V y componentes opcionales intactos." -ForegroundColor Green
