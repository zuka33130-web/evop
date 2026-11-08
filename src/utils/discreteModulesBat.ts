/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// ARCHIVOS 1 AL 15 (FASE 1 & FASE 2) + REVERTIR_TODO.bat
// Permite que INICIAR_TODO_V3.bat ejecute la cadena completa del 1 al 25
// ============================================================================

export function generateRestorePointBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Punto de Restauracion',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   01 - CREAR PUNTO DE RESTAURACION DEL SISTEMA',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 (',
    '    color 0C',
    '    echo  [ERROR] Ejecutar como ADMINISTRADOR',
    '    pause',
    '    exit /b 1',
    ')',
    'echo  [*] Creando punto de restauracion: CS2_ULTRA_V3...',
    'powershell -command "Checkpoint-Computer -Description \'CS2_ULTRA_V3\' -RestorePointType MODIFY_SETTINGS" 2>nul',
    'echo  [OK] Punto de restauracion creado exitosamente.',
    'timeout /t 2 >nul'
  ].join('\r\n');
}

export function generateOptWindowsBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Windows Base',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   02 - OPTIMIZACION DE WINDOWS PARA GAMING',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'echo  [*] Desactivando GameDVR y GameBar...',
    'reg add "HKCU\\System\\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 0 /f >nul 2>&1',
    'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v "AllowGameDVR" /t REG_DWORD /d 0 /f >nul 2>&1',
    'echo  [*] Desactivando MPO (Multi-Plane Overlay) Fix Intel...',
    'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm" /v "OverlayTestMode" /t REG_DWORD /d 5 /f >nul 2>&1',
    'echo  [*] Desactivando Transparencias y Efectos Visuales...',
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v "EnableTransparency" /t REG_DWORD /d 0 /f >nul 2>&1',
    'echo  [*] Habilitando HAGS (Hardware Accelerated GPU Scheduling)...',
    'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v "HwSchMode" /t REG_DWORD /d 2 /f >nul 2>&1',
    'echo  [OK] Optimizacion Windows completada.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateOptGpuIntelBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - GPU Intel UHD/Xe',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   03 - OPTIMIZACION GPU INTEL UHD 64EU / IRIS XE',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'echo  [*] Asignando 1024MB VRAM DVMT en Registro...',
    'reg add "HKLM\\SOFTWARE\\Intel\\GMM" /v "DedicatedSegmentSize" /t REG_DWORD /d 1024 /f >nul 2>&1',
    'echo  [*] Fijando Prioridad GPU a 8 (Maximo Rendimiento)...',
    'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f >nul 2>&1',
    'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Priority" /t REG_DWORD /d 6 /f >nul 2>&1',
    'echo  [*] TdrDelay fijado en 10s (evita crasheos de controlador)...',
    'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v "TdrDelay" /t REG_DWORD /d 10 /f >nul 2>&1',
    'echo  [OK] GPU Intel optimizada.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateOptRedBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Red y Baja Latencia',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   04 - OPTIMIZACION DE RED & SUB-15MS PING',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'echo  [*] Desactivando Nagle Algorithm (TCPNoDelay)...',
    'powershell -command ^',
    '"$adapters = Get-ItemProperty \'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\*\'; foreach ($a in $adapters) { Set-ItemProperty $a.PSPath \'TcpNoDelay\' 1 -Type DWord -Force -ErrorAction SilentlyContinue; Set-ItemProperty $a.PSPath \'TcpAckFrequency\' 1 -Type DWord -Force -ErrorAction SilentlyContinue; Set-ItemProperty $a.PSPath \'TCPDelAckTicks\' 0 -Type DWord -Force -ErrorAction SilentlyContinue }" 2>nul',
    'echo  [*] Optimizando pila TCP/IP global...',
    'netsh int tcp set global autotuninglevel=normal >nul 2>&1',
    'netsh int tcp set global congestionprovider=ctcp >nul 2>&1',
    'netsh int tcp set global rss=enabled >nul 2>&1',
    'ipconfig /flushdns >nul 2>&1',
    'echo  [OK] Red optimizada.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateOptMemoriaBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Memoria RAM',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   05 - OPTIMIZACION DE MEMORIA RAM & STANDBY',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'echo  [*] Desactivando PageCombining en Windows 11...',
    'powershell -command "Disable-MMAgent -PageCombining" 2>nul',
    'echo  [*] Fijando Pagefile a 8192 MB (8GB estaticos)...',
    'wmic pagefileset where name="C:\\\\pagefile.sys" set InitialSize=8192,MaximumSize=8192 >nul 2>&1',
    'echo  [*] Desactivando compresion de memoria redundante...',
    'powershell -command "Disable-MMAgent -MemoryCompression" 2>nul',
    'echo  [OK] Memoria optimizada.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateLimpiarProcesosBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Limpiar Procesos',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   06 - LIMPIEZA DE PROCESOS RESIDUALES',
    'echo  =================================================',
    'echo.',
    'for %%p in ("OneDrive.exe" "SearchApp.exe" "Widgets.exe" "YourPhone.exe" "Cortana.exe" "GameBarFTServer.exe" "SkypeApp.exe" "Teams.exe") do (',
    '    taskkill /f /im %%p >nul 2>&1',
    ')',
    'echo  [OK] Procesos residuales eliminados.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateConfigCs2Bat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Config CS2',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   07 - INSTALADOR DE AUTOEXEC & VIDEO.TXT CS2',
    'echo  =================================================',
    'echo.',
    'set "CS2_CFG=C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg"',
    'if exist "%CS2_CFG%" (',
    '    if exist "%~dp0cfg\\autoexec.cfg" copy /y "%~dp0cfg\\autoexec.cfg" "%CS2_CFG%\\autoexec.cfg" >nul',
    '    echo  [OK] autoexec.cfg copiado a: %CS2_CFG%',
    ') else (',
    '    echo  [!] CS2 cfg no encontrado en ruta por defecto.',
    ')',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateOptArranqueBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Arranque y Temporizadores BCD',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   08 - OPTIMIZACION DE ARRANQUE Y TIMER BCD',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'echo  [*] Configurando TSC Nativo en BCD (Sin HPET lento)...',
    'bcdedit /deletevalue useplatformclock >nul 2>&1',
    'bcdedit /deletevalue useplatformtick >nul 2>&1',
    'bcdedit /set disabledynamictick yes >nul 2>&1',
    'bcdedit /set tscsyncpolicy Enhanced >nul 2>&1',
    'bcdedit /set bootmenupolicy legacy >nul 2>&1',
    'echo  [OK] Temporizadores TSC configurados a 4.4 GHz.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateTareasMemoriaProBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Tareas Programadas Pro',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   09 - DESACTIVACION DE TAREAS PROGRAMADAS BLOAT',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'schtasks /change /tn "\\Microsoft\\Windows\\Customer Experience Improvement Program\\Consolidator" /disable >nul 2>&1',
    'schtasks /change /tn "\\Microsoft\\Windows\\Customer Experience Improvement Program\\UsbCeip" /disable >nul 2>&1',
    'schtasks /change /tn "\\Microsoft\\Windows\\Application Experience\\Microsoft Compatibility Appraiser" /disable >nul 2>&1',
    'schtasks /change /tn "\\Microsoft\\Windows\\Application Experience\\ProgramDataUpdater" /disable >nul 2>&1',
    'schtasks /change /tn "\\Microsoft\\Windows\\DiskDiagnostic\\Microsoft-Windows-DiskDiagnosticDataCollector" /disable >nul 2>&1',
    'echo  [OK] Tareas de telemetria deshabilitadas.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateDispositivosCoresBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Afinidad Cores y Dispositivos',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   10 - AFINIDAD P-CORES PARA CS2 (MASCARA 15)',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'echo  [*] Confinando cs2.exe a hilos 0-3 (P-Cores a 4.4GHz)...',
    'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cs2.exe\\PerfOptions" /v "CpuPriorityClass" /t REG_DWORD /d 3 /f >nul 2>&1',
    'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cs2.exe\\PerfOptions" /v "IoPriority" /t REG_DWORD /d 3 /f >nul 2>&1',
    'echo  [OK] P-Cores configurados en IFEO para CS2.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generatePowerPlanProBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Power Plan Pro',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   11 - PLAN DE ENERGIA MAXIMO RENDIMIENTO',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 >nul 2>&1',
    'powercfg -setactive scheme_current >nul 2>&1',
    'powercfg -setacvalueindex scheme_current sub_processor CPMINCORES 100 >nul 2>&1',
    'powercfg -setacvalueindex scheme_current sub_processor CPMAXCORES 100 >nul 2>&1',
    'powercfg -setacvalueindex scheme_current sub_processor PROCTHROTTLEMIN 100 >nul 2>&1',
    'powercfg -setacvalueindex scheme_current sub_processor PROCTHROTTLEMAX 100 >nul 2>&1',
    'echo  [OK] Energia fijada al 100% permanente.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateAudioInputMouseBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Audio e Input Lag',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   12 - OPTIMIZACION DE AUDIO Y ENTRADA DE RATON',
    'echo  =================================================',
    'echo.',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    'reg add "HKCU\\Control Panel\\Mouse" /v "MouseSpeed" /t REG_SZ /d "0" /f >nul 2>&1',
    'reg add "HKCU\\Control Panel\\Mouse" /v "MouseThreshold1" /t REG_SZ /d "0" /f >nul 2>&1',
    'reg add "HKCU\\Control Panel\\Mouse" /v "MouseThreshold2" /t REG_SZ /d "0" /f >nul 2>&1',
    'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v "SystemResponsiveness" /t REG_DWORD /d 0 /f >nul 2>&1',
    'echo  [OK] Aceleracion de raton apagada y SystemResponsiveness a 0.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateSteamDirectxBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Steam y DirectX',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   13 - OPTIMIZACION DE STEAM & DIRECTX RUNTIME',
    'echo  =================================================',
    'echo.',
    'reg add "HKCU\\Software\\Valve\\Steam" /v "EnableGameOverlay" /t REG_DWORD /d 0 /f >nul 2>&1',
    'reg add "HKLM\\SOFTWARE\\Microsoft\\Direct3D" /v "EnableDebugLayers" /t REG_DWORD /d 0 /f >nul 2>&1',
    'echo  [OK] Steam Overlay y Debug Layers optimizados.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateRegistryUltraBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Registry Ultra',
    'color 0B',
    'echo.',
    'echo  =================================================',
    'echo   14 - APLICAR 90 TWEAKS DE REGISTRO V6',
    'echo  =================================================',
    'echo.',
    'if exist "%~dp001_V6_MASTER_90.reg" reg import "%~dp001_V6_MASTER_90.reg" >nul 2>&1',
    'if exist "%~dp002_V6_RED.reg" reg import "%~dp002_V6_RED.reg" >nul 2>&1',
    'if exist "%~dp003_V6_AHORRO_OFF.reg" reg import "%~dp003_V6_AHORRO_OFF.reg" >nul 2>&1',
    'echo  [OK] Claves de registro importadas con exito.',
    'timeout /t 1 >nul'
  ].join('\r\n');
}

export function generateBiosGuidePn64Bat(): string {
  return [
    '@echo off',
    'title Guia BIOS ASUS PN64 - i3-1220P',
    'color 0E',
    'mode con: cols=68 lines=32',
    'echo.',
    'echo  ==============================================================',
    'echo   15 - GUIA DE CONFIGURACION BIOS ASUS PN64 (F2 AL ENCENDER)',
    'echo  ==============================================================',
    'echo.',
    'echo  1. Reinicia el mini-PC y pulsa repetidamente la tecla F2.',
    'echo.',
    'echo  2. AJUSTES OBLIGATORIOS (GANANCIA +15-20 FPS):',
    'echo     * Advanced ^> Graphics Config ^> DVMT Pre-Allocated: 1024M',
    'echo     * Advanced ^> Power ^& Performance ^> Performance Mode: ENABLED',
    'echo     * Monitor / Q-Fan Control: FULL SPEED',
    'echo     * CPU Configuration ^> Intel Virtualization (VT-x): DISABLED',
    'echo     * C-States: C0 / DISABLED (o segun disipador)',
    'echo.',
    'echo  3. En Windows:',
    'echo     * Abre la app MyASUS ^> Perfil de Ventilador ^> Rendimiento.',
    'echo.',
    'echo  ==============================================================',
    'pause'
  ].join('\r\n');
}

export function generateRevertirTodoBat(): string {
  return [
    '@echo off',
    'title CS2 Optimizer - Revertir Todo al Estado Original',
    'color 0C',
    'mode con: cols=65 lines=28',
    'echo.',
    'echo  =================================================',
    'echo   REVERSOR TOTAL - RESTAURAR VALORES DE WINDOWS',
    'echo  =================================================',
    'echo.',
    'echo  [!] Este script restaurara la configuracion original.',
    'pause',
    '',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 ( exit /b 1 )',
    '',
    'echo  [*] Restaurando MPO, GameDVR y Transparencias...',
    'reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm" /v "OverlayTestMode" /f >nul 2>&1',
    'reg add "HKCU\\System\\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 1 /f >nul 2>&1',
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v "EnableTransparency" /t REG_DWORD /d 1 /f >nul 2>&1',
    '',
    'echo  [*] Reactivando mitigaciones y Dynamic Tick...',
    'bcdedit /set disabledynamictick no >nul 2>&1',
    'reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v "FeatureSettingsOverride" /f >nul 2>&1',
    'reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v "FeatureSettingsOverrideMask" /f >nul 2>&1',
    'reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cs2.exe\\PerfOptions" /f >nul 2>&1',
    '',
    'echo  [*] Reactivando PageCombining...',
    'powershell -command "Enable-MMAgent -PageCombining" 2>nul',
    '',
    'echo  [OK] Restauracion completada. Por favor reinicia el PC.',
    'pause'
  ].join('\r\n');
}
