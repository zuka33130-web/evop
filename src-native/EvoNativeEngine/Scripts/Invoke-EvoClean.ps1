<#
.SYNOPSIS
    Invoke-EvoClean.ps1
    Evo Native Engine - Motor de Limpieza Profunda del Sistema & DirectX Shader Cache
    Ruta nativa: src-native/EvoNativeEngine/Scripts/Invoke-EvoClean.ps1

.DESCRIPTION
    Script de automatización en PowerShell invocado nativamente por EvoNativeEngine (C# / .NET 8).
    Soporta los modos:
    - Scan  : Calcula el tamaño en MB de los archivos temporales y caché sin modificar el disco.
    - Clean : Elimina solo los archivos no bloqueados y calcula el espacio real liberado en MB.

    Categorías auditadas y purgadas:
    1. Archivos Temporales de Usuario (%TEMP%).
    2. Archivos Temporales del Sistema (C:\Windows\Temp).
    3. Caché de Descargas de Windows Update (C:\Windows\SoftwareDistribution\Download).
    4. Archivos Prefetch de Windows (C:\Windows\Prefetch).
    5. Caché de Sombreadores DirectX / D3DCache (Intel UHD / NVIDIA / AMD / DirectX Shader Cache).

.PARAMETER Mode
    Modo operativo: 'Scan' o 'Clean'.

.OUTPUTS
    Estructura JSON formateada: {"status": "success", "freedMB": 120.45, "details": "..."}
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("Scan", "Clean")]
    [string]$Mode = "Scan"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

# Definición de las categorías objetivas
$targets = @(
    @{ Name = "Temporales de Usuario"; Path = $env:TEMP; Filter = "*" },
    @{ Name = "Temporales de Sistema"; Path = "C:\Windows\Temp"; Filter = "*" },
    @{ Name = "Windows Update Cache"; Path = "C:\Windows\SoftwareDistribution\Download"; Filter = "*" },
    @{ Name = "Prefetch"; Path = "C:\Windows\Prefetch"; Filter = "*.pf" },
    @{ Name = "DirectX Shader Cache (Intel/NVIDIA/AMD)"; Path = "$env:LOCALAPPDATA\D3DSCache"; Filter = "*" },
    @{ Name = "NVIDIA DX Cache"; Path = "$env:LOCALAPPDATA\NVIDIA\DXCache"; Filter = "*" },
    @{ Name = "AMD DX Cache"; Path = "$env:LOCALAPPDATA\AMD\DxCache"; Filter = "*" },
    @{ Name = "Intel Shader Cache"; Path = "$env:LOCALAPPDATA\Intel\ShaderCache"; Filter = "*" },
    @{ Name = "DirectX Global Cache"; Path = "$env:LOCALAPPDATA\Microsoft\DirectX Shader Cache"; Filter = "*" }
)

$totalBytesScanned = 0L
$totalBytesCleaned = 0L
$totalFilesCleaned = 0
$totalFilesLocked = 0
$detailsList = [System.Collections.Generic.List[string]]::new()

foreach ($t in $targets) {
    $path = $t.Path
    $name = $t.Name
    $targetBytes = 0L
    $targetCleaned = 0L
    $targetLocked = 0
    $targetFilesCount = 0

    if (Test-Path $path) {
        $files = Get-ChildItem -Path $path -Recurse -File -Filter $t.Filter -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            $targetBytes += $file.Length
            $targetFilesCount++

            if ($Mode -eq "Clean") {
                try {
                    Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                    $targetCleaned += $file.Length
                    $totalFilesCleaned++
                } catch {
                    # Archivo bloqueado por un proceso activo (se omite de manera segura)
                    $targetLocked++
                    $totalFilesLocked++
                }
            }
        }
    }

    $totalBytesScanned += $targetBytes
    $totalBytesCleaned += $targetCleaned

    $mbFound = [math]::Round(($targetBytes / 1MB), 2)
    $mbCleaned = [math]::Round(($targetCleaned / 1MB), 2)

    if ($Mode -eq "Clean") {
        $detailsList.Add("$name: ${mbCleaned} MB liberados ($targetFilesCount archivos analizados, $targetLocked omitidos por estar en uso)")
    } else {
        $detailsList.Add("$name: ${mbFound} MB ocupados ($targetFilesCount archivos)")
    }
}

$freedMB = if ($Mode -eq "Clean") { [math]::Round(($totalBytesCleaned / 1MB), 2) } else { [math]::Round(($totalBytesScanned / 1MB), 2) }
$detailsString = $detailsList -join " | "

$outputJson = [ordered]@{
    status    = "success"
    mode      = $Mode
    freedMB   = $freedMB
    scannedMB = [math]::Round(($totalBytesScanned / 1MB), 2)
    details   = $detailsString
}

# Retornar JSON puro para el motor C# y React
$outputJson | ConvertTo-Json -Compress
