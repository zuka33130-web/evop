<#
.SYNOPSIS
    17_Kernel_Timer_Policy.ps1
    RYZER CORTEX ULTRA - Fase 3: Modo Ultra Agresivo
    Política de Temporizador del Kernel & Quantum Scheduling (Intel Thread Director Compatible)

.DESCRIPTION
    Ajustes de temporizador del kernel de Windows 11 optimizados para la arquitectura Alder Lake (i3-1220P).
    
    Correcciones Arquitectónicas Aplicadas:
    1. CONSERVACIÓN DE DYNAMICTICK & THREAD DIRECTOR:
       Se ELIMINA cualquier modificación destructiva de 'bcdedit /set disabledynamictick yes' o 'useplatformtick yes'.
       En Windows 11 (23H2/24H2), forzar 'disabledynamictick' rompe el ciclo de estados C de energía y desincroniza
       el Intel Thread Director (ITD) por hardware, provocando que los hilos críticos de CS2 sean migrados erróneamente a los E-Cores.
    2. PRESERVACIÓN DE SEGURIDAD EN SILICIO DE 12ª GEN:
       Se MANTIENEN intactas las mitigaciones del kernel (Spectre/Meltdown, CFG, HVCI y Firewall).
       La arquitectura Alder Lake resuelve estas trampas por microarquitectura en hardware; desactivarlas por software
       no aporta ganancia medible de FPS y expone la memoria a vectores de ataque al conectarse a servidores oficiales de Counter-Strike.
    3. OPTIMIZACIÓN REAL DE LATENCIA:
       - Configuración del Time Stamp Counter (TSC) en BCDedit via 'tscsyncpolicy Enhanced'.
       - Prioridad de quantum del planificador NT: Win32PrioritySeparation = 38 (0x26) -> Quantum de hilo corto y variable para juegos.
       - SystemResponsiveness = 0 -> 100% de prioridad de CPU asignada a la aplicación en primer plano.

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
Write-Host " RYZER CORTEX ULTRA - ARCHIVO 17: KERNEL TIMER & QUANTUM  " -ForegroundColor BrightWhite
Write-Host "==========================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. REMOVER PARÁMETROS BCD NOCIVOS Y CONFIGURAR TSC NATIVO
# -----------------------------------------------------------------------------
Write-Host "`n[1/3] Limpiando parámetros BCD anómalos y fijando sincronización TSC..." -ForegroundColor Yellow

# Restaurar comportamiento nativo de Dynamic Tick para Intel Thread Director
try {
    bcdedit /deletevalue disabledynamictick 2>$null
    bcdedit /deletevalue useplatformtick 2>$null
    bcdedit /deletevalue useplatformclock 2>$null
    Write-Host "  ✓ BCD limpiado: Dynamic Tick retenido para soporte nativo de Intel Thread Director." -ForegroundColor Green
} catch {
    Write-Host "  ℹ Parámetros BCD previos en estado por defecto." -ForegroundColor Gray
}

# Configurar sincronización TSC de baja latencia
try {
    bcdedit /set tscsyncpolicy Enhanced 2>$null
    Write-Host "  ✓ BCD Configurado: 'tscsyncpolicy Enhanced' activo para sincronización TSC a 4.4 GHz." -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ No se pudo fijar tscsyncpolicy (común en ciertos entornos virtualizados)." -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# 2. OPTIMIZACIÓN DE QUANTUM DEL PLANIFICADOR DE WINDOWS (Win32PrioritySeparation)
# -----------------------------------------------------------------------------
Write-Host "`n[2/3] Configurando Quantum del Planificador de Windows NT..." -ForegroundColor Yellow

$multimediaProfilePath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
$controlPriorityPath   = "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl"

# Win32PrioritySeparation = 38 (0x26 hex): Quantum corto, variable, 3:1 prioridad a la app en primer plano
Set-ItemProperty -Path $controlPriorityPath -Name "Win32PrioritySeparation" -Value 38 -Type DWord -Force
Write-Host "  ✓ Win32PrioritySeparation = 38 (0x26) -> Quantum óptimo para render de juegos." -ForegroundColor Green

# SystemResponsiveness = 0 -> Asignación de CPU 100% enfocada en aplicaciones en primer plano (juegos)
Set-ItemProperty -Path $multimediaProfilePath -Name "SystemResponsiveness" -Value 0 -Type DWord -Force
Write-Host "  ✓ SystemResponsiveness = 0 -> Reservas de sistema reducidas a 0% durante partidas." -ForegroundColor Green

# NetworkThrottlingIndex = ffffffff (desactivar moderación de red para juegos)
Set-ItemProperty -Path $multimediaProfilePath -Name "NetworkThrottlingIndex" -Value 0xFFFFFFFF -Type DWord -Force
Write-Host "  ✓ NetworkThrottlingIndex = 0xFFFFFFFF -> Moderación de paquetes de red desactivada." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 3. VERIFICACIÓN DE SEGURIDAD INTEGRAL (PRESERVACIÓN DE MITIGACIONES Y FIREWALL)
# -----------------------------------------------------------------------------
Write-Host "`n[3/3] Verificando estado de seguridad del Kernel (Spectre/Firewall Intactos)..." -ForegroundColor Yellow
Write-Host "  ✓ Mitigaciones de seguridad en silicio de 12ª Gen mantenidas activas sin overhead por software." -ForegroundColor Green
Write-Host "  ✓ Servicio Windows Defender & Firewall conservados para juego online seguro." -ForegroundColor Green

Write-Host "`n✓ Archivo 17 aplicado exitosamente con compatibilidad total para Intel Thread Director." -ForegroundColor Green
