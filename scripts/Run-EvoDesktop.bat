@echo off
title EVOOPTIMIZER - Lanzador Windows 11
color 0A

echo ==========================================================
echo   EVOOPTIMIZER - Optimizador Real Windows 11
echo ==========================================================
echo.
echo [1/2] Iniciando Motor Nativo C# .NET en segundo plano...
cd /d "%~dp0..\src-native\EvoNativeEngine"
start "EvoNativeEngine C# Backend" dotnet run

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Interfaz Frontend (Vite + React)...
cd /d "%~dp0.."
start "EVOOPTIMIZER UI" npm run dev

echo.
echo Ambos servicios estan iniciando:
echo - Motor Nativo C#: http://127.0.0.1:48120
echo - Interfaz Web:    http://localhost:3000
echo.
echo Presione cualquier tecla para salir del lanzador...
pause >nul
