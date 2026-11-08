<#
.SYNOPSIS
    Compila y publica EvoNativeEngine como ejecutable único auto-contenido para Windows 11.
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Join-Path (Split-Path -Parent $scriptDir) "src-native\EvoNativeEngine"
$outputDir = Join-Path (Split-Path -Parent $scriptDir) "dist-native\win-x64"

Write-Host "Publicando EvoNativeEngine como binario independiente (win-x64)..." -ForegroundColor Cyan
Set-Location $projectDir

dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $outputDir

if ($LASTEXITCODE -eq 0) {
    Write-Host "[✓] Compilación completada con éxito." -ForegroundColor Green
    Write-Host "    Ejecutable generado en: $outputDir\EvoNativeEngine.exe" -ForegroundColor White
} else {
    Write-Error "Error durante la compilación de EvoNativeEngine."
}
