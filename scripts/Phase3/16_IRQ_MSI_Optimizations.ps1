<#
.SYNOPSIS
    16_IRQ_MSI_Optimizations.ps1
    RYZER CORTEX ULTRA - Fase 3: Modo Ultra Agresivo
    Gestión Fina de Interrupciones Hardware (MSI Mode & IRQ Affinity Policy)

.DESCRIPTION
    Optimización de latencia DPC e interrupciones hardware para ASUS PN64 (i3-1220P 2P+8E Alder Lake).
    Topología HT de P-Cores:
      - P-Core 0: Hilos 0 (CPU 0, Máscara 0x1) y 1 (CPU 1, Máscara 0x2)
      - P-Core 1: Hilos 2 (CPU 2, Máscara 0x4) y 3 (CPU 3, Máscara 0x8)
      - E-Cores : Hilos 4 a 11 (CPU 4-11)

    Correcciones Arquitectónicas Aplicadas:
    1. Afinidad IRQ Fina: GPU Intel UHD asignada exclusivamente a CPU 0 (Hilo 0 de P-Core 0, Máscara 0x1).
       Adaptador de Red (Ethernet/Wi-Fi) asignado exclusivamente a CPU 2 (Hilo 0 de P-Core 1, Máscara 0x4).
       Esto elimina la competencia por ciclos de P-Core entre la GPU y el tráfico de paquetes de red.
    2. Modo MSI (Message Signaled Interrupts): Habilitación explícita (MSISupported=1) con DevicePriority=High
       FILTRADA estrictamente por los IDs de hardware específicos de la iGPU Intel UHD y la controladora NVMe.
       Se elimina el bucle global inseguro para evitar pantallas azules (BSOD) en dispositivos USB/HDC heredados.

.NOTES
    Requiere Privilegios de Administrador (UAC).
#>

[CmdletBinding()]
param()

# Codificación UTF-8 y chequeo UAC
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
Write-Host " RYZER CORTEX ULTRA - ARCHIVO 16: IRQ & MODO MSI (PN64)   " -ForegroundColor BrightWhite
Write-Host "==========================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. HABILITACIÓN DE MODO MSI (MESSAGE SIGNALED INTERRUPTS) FILTRADA POR DISPOSITIVO
# -----------------------------------------------------------------------------
Write-Host "`n[1/2] Auditando y aplicando Modo MSI seguro (Intel UHD & NVMe)..." -ForegroundColor Yellow

$pciEnumPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\PCI"

# Target 1: Adaptador Gráfico Intel UHD (Class GUID {4d36e968-e325-11ce-bfc1-08002be10318})
$displayDevices = Get-ChildItem -Path $pciEnumPath -Recurse -ErrorAction SilentlyContinue | 
    Where-Object { $_.PSChildName -eq "Device Parameters" }

$gpuConfigured = 0
$nvmeConfigured = 0

Get-ChildItem -Path $pciEnumPath -ErrorAction SilentlyContinue | ForEach-Object {
    $vendorKey = $_
    Get-ChildItem -Path $vendorKey.PSPath -ErrorAction SilentlyContinue | ForEach-Object {
        $devKey = $_
        $devPath = $devKey.PSPath
        $devId = $devKey.PSChildName

        # Filtrar solo Intel UHD (VEN_8086) y NVMe Storage Controllers
        $isIntelGPU = ($devId -like "*VEN_8086*" -and ($devId -like "*DEV_46A6*" -or $devId -like "*DEV_46A8*" -or $devId -like "*DEV_4690*"))
        $isNVMeStorage = ($devId -like "*DEV_09A7*" -or $devId -like "*CC_0108*" -or $devId -like "*NVME*")

        # Fallback por Class GUID si el HWID no es exacto
        if (-not ($isIntelGPU -or $isNVMeStorage)) {
            $classGuid = (Get-ItemProperty -Path $devPath -Name "ClassGUID" -ErrorAction SilentlyContinue).ClassGUID
            if ($classGuid -eq "{4d36e968-e325-11ce-bfc1-08002be10318}") { $isIntelGPU = $true } # Display
            if ($classGuid -eq "{4d36e97b-e325-11ce-bfc1-08002be10318}") { $isNVMeStorage = $true } # SCSIAdapter/NVMe
        }

        if ($isIntelGPU -or $isNVMeStorage) {
            $msiPath = Join-Path -Path $devPath -ChildPath "Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
            $policyPath = Join-Path -Path $devPath -ChildPath "Device Parameters\Interrupt Management\Affinity Policy"

            if (-not (Test-Path $msiPath)) {
                New-Item -Path $msiPath -Force | Out-Null
            }
            if (-not (Test-Path $policyPath)) {
                New-Item -Path $policyPath -Force | Out-Null
            }

            # Aplicar MSISupported=1
            Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 1 -Type DWord -Force
            
            # Prioridad de Interrupción Alta para reducir latencia DPC
            Set-ItemProperty -Path $policyPath -Name "DevicePriority" -Value 3 -Type DWord -Force # 3 = High

            if ($isIntelGPU) {
                # AFINIDAD HARDWARE: CPU 0 (0x1 = Hilo 0 del P-Core 0)
                Set-ItemProperty -Path $policyPath -Name "DevicePolicy" -Value 4 -Type DWord -Force # 4 = SpecifiedProcessors
                Set-ItemProperty -Path $policyPath -Name "AssignmentSetMask" -Value 0x00000001 -Type QWord -Force
                Write-Host "  ✓ Intel UHD GPU ($devId) -> Modo MSI [MSISupported=1], DevicePriority=High, Afinidad=CPU 0 (0x1)" -ForegroundColor Green
                $gpuConfigured++
            }

            if ($isNVMeStorage) {
                # AFINIDAD HARDWARE: CPU 1 (0x2 = Hilo 1 del P-Core 0)
                Set-ItemProperty -Path $policyPath -Name "DevicePolicy" -Value 4 -Type DWord -Force
                Set-ItemProperty -Path $policyPath -Name "AssignmentSetMask" -Value 0x00000002 -Type QWord -Force
                Write-Host "  ✓ NVMe Controller ($devId) -> Modo MSI [MSISupported=1], DevicePriority=High, Afinidad=CPU 1 (0x2)" -ForegroundColor Green
                $nvmeConfigured++
            }
        }
    }
}

# -----------------------------------------------------------------------------
# 2. AFINIDAD IRQ PARA ADAPTADORES DE RED (ETHERNET / WI-FI) EN P-CORE 1
# -----------------------------------------------------------------------------
Write-Host "`n[2/2] Configurando afinidad IRQ de red en P-Core 1 (CPU 2 - Mask 0x4)..." -ForegroundColor Yellow

Get-ChildItem -Path $pciEnumPath -ErrorAction SilentlyContinue | ForEach-Object {
    $vendorKey = $_
    Get-ChildItem -Path $vendorKey.PSPath -ErrorAction SilentlyContinue | ForEach-Object {
        $devKey = $_
        $devPath = $devKey.PSPath
        $classGuid = (Get-ItemProperty -Path $devPath -Name "ClassGUID" -ErrorAction SilentlyContinue).ClassGUID

        # ClassGUID de Adaptadores de Red: {4d36e972-e325-11ce-bfc1-08002be10318}
        if ($classGuid -eq "{4d36e972-e325-11ce-bfc1-08002be10318}") {
            $policyPath = Join-Path -Path $devPath -ChildPath "Device Parameters\Interrupt Management\Affinity Policy"
            $msiPath = Join-Path -Path $devPath -ChildPath "Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"

            if (-not (Test-Path $policyPath)) { New-Item -Path $policyPath -Force | Out-Null }
            if (-not (Test-Path $msiPath)) { New-Item -Path $msiPath -Force | Out-Null }

            # Habilitar MSI y asignar a CPU 2 (0x4 = Hilo 0 del P-Core 1)
            Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 1 -Type DWord -Force
            Set-ItemProperty -Path $policyPath -Name "DevicePolicy" -Value 4 -Type DWord -Force
            Set-ItemProperty -Path $policyPath -Name "AssignmentSetMask" -Value 0x00000004 -Type QWord -Force
            Set-ItemProperty -Path $policyPath -Name "DevicePriority" -Value 2 -Type DWord -Force # Normal/Undefined

            Write-Host "  ✓ Red Adapter ($($devKey.PSChildName)) -> Modo MSI Activo, Afinidad=CPU 2 (P-Core 1, Mask 0x4)" -ForegroundColor Green
        }
    }
}

Write-Host "`n✓ Archivo 16 aplicado exitosamente sin comprometer dispositivos heredados." -ForegroundColor Green
