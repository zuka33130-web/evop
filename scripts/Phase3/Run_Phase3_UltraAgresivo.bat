@echo off
title RYZER CORTEX ULTRA - Fase 3: Modo Ultra Agresivo (ASUS PN64 i3-1220P)
chcp 65001 >nul
cls

echo =======================================================================
echo   RYZER CORTEX ULTRA - FASE 3: MODO ULTRA AGRESIVO (KERNEL & HARDWARE)
echo   ASUS ExpertCenter PN64 (Intel Core i3-1220P 2P+8E · Intel UHD 64EU)
echo =======================================================================
echo.

:: Verificación de privilegios de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Este ejecutable requiere Privilegios de Administrador.
    echo Re-ejecutando con elevacion UAC...
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

echo [1/6] Ejecutando Archivo 16: Interrupciones IRQ & Modo MSI Filtrado...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp016_IRQ_MSI_Optimizations.ps1"
echo.

echo [2/6] Ejecutando Archivo 17: Politica de Temporizador Kernel & Quantum...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp017_Kernel_Timer_Policy.ps1"
echo.

echo [3/6] Ejecutando Archivo 18: GPU Intel UHD 64EU & TDR Delay 10s...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp018_GPU_IntelUHD_TDR.ps1"
echo.

echo [4/6] Ejecutando Archivo 19: Cache de Sombreadores DirectX 256MB...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp019_DirectX_ShaderCache.ps1"
echo.

echo [5/6] Ejecutando Archivo 20: Almacenamiento SSD NVMe & Pagefile Static 4GB...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp020_NVMe_Disk_Performance.ps1"
echo.

echo [6/6] Ejecutando Archivo 21: Politica Segura de Servicios...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp021_Safe_Services_Policy.ps1"
echo.

echo =======================================================================
echo   ✓ FASE 3 REESCRITA Y COMPILADA CON ÉXITO SIN AFECTAR THREAD DIRECTOR
echo =======================================================================
pause
