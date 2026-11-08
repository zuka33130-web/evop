import JSZip from 'jszip';
import { 
  HardwareProfile, 
  generateAutoexecString, 
  generateLaunchOptionsString, 
  generateVideoTxtString 
} from '../data/optimizerData';
import {
  generateStructureBat,
  generateMaster90Reg,
  generateRedReg,
  generateAhorroOffReg,
  generateDebloatPs1,
  generateRestoreVbsBat,
  generateRestoreTotalBat,
  generateV6BatchMaster,
  generateV7PowershellMaster,
  generateReadmeTxt,
  generateExtremeV2Ps1,
  generateBoosterV2Bat,
  generateExtremeUndoPs1,
  generateGodModeMonitorPs1,
  generateGodModeBat,
  generateThrottleStopGuideTxt
} from './scriptTemplates';
import {
  generateMsiInterruptBat,
  generateKernelCpuUltraBat,
  generateGpuDriverCoreBat,
  generateDirectxRuntimeProBat,
  generateIoStorageSchedulerBat,
  generateStrippingWindowsBat,
  generateMonitoringToolsBat,
  generateCs2EngineProBat,
  generateAutoPreGameBat,
  generateRamDiskGameBat,
  generateIniciarTodoV3Bat,
  generateAutoexecUltraCfg
} from './ultraScriptTemplates';
import {
  generateRestorePointBat,
  generateOptWindowsBat,
  generateOptGpuIntelBat,
  generateOptRedBat,
  generateOptMemoriaBat,
  generateLimpiarProcesosBat,
  generateConfigCs2Bat,
  generateOptArranqueBat,
  generateTareasMemoriaProBat,
  generateDispositivosCoresBat,
  generatePowerPlanProBat,
  generateAudioInputMouseBat,
  generateSteamDirectxBat,
  generateRegistryUltraBat,
  generateBiosGuidePn64Bat,
  generateRevertirTodoBat
} from './discreteModulesBat';
import { generateOptimizationReportMarkdown } from './reportGenerator';

export interface PackageFile {
  path: string;
  filename: string;
  content: string;
  type: string;
  description: string;
}

export function getAllPackageFiles(hardware: HardwareProfile): PackageFile[] {
  return [
    {
      path: "00_INFORME_OPTIMIZACION_PN64.md",
      filename: "00_INFORME_OPTIMIZACION_PN64.md",
      content: generateOptimizationReportMarkdown(hardware),
      type: "markdown",
      description: "Reporte Técnico Ejecutivo en Markdown / Imprimible con todos los ajustes y hardware activo"
    },
    {
      path: "PN64_V7_ULTIMATE.ps1",
      filename: "PN64_V7_ULTIMATE.ps1",
      content: generateV7PowershellMaster(),
      type: "powershell",
      description: "Script Maestro PowerShell V7 (15 funciones interactivas + 110 tweaks en 1 solo lenguaje)"
    },
    {
      path: "PN64_V6_ULTIMATE.bat",
      filename: "PN64_V6_ULTIMATE.bat",
      content: generateV6BatchMaster(),
      type: "batch",
      description: "Lanzador maestro Batch estilo Razer Cortex 1-Click con 14 modos"
    },
    {
      path: "00_CREAR_ESTRUCTURA.bat",
      filename: "00_CREAR_ESTRUCTURA.bat",
      content: generateStructureBat(),
      type: "batch",
      description: "Generador de carpetas en 1 clic para C:\\PN64_CS2\\"
    },
    {
      path: "01_V6_MASTER_90.reg",
      filename: "01_V6_MASTER_90.reg",
      content: generateMaster90Reg(),
      type: "registry",
      description: "90 Tweaks de registro: GameDVR OFF, MPO Fix, HAGS 2, TdrDelay 10, Prioridad GPU 8/6"
    },
    {
      path: "02_V6_RED.reg",
      filename: "02_V6_RED.reg",
      content: generateRedReg(),
      type: "registry",
      description: "Parámetros TCP/IP de baja latencia, PMTU discovery y prioridad de red"
    },
    {
      path: "03_V6_AHORRO_OFF.reg",
      filename: "03_V6_AHORRO_OFF.reg",
      content: generateAhorroOffReg(),
      type: "registry",
      description: "Desactivación de suspensión selectiva de USB y PCIe"
    },
    {
      path: "DEBLOAT_PN64_V6.ps1",
      filename: "DEBLOAT_PN64_V6.ps1",
      content: generateDebloatPs1(),
      type: "powershell",
      description: "Debloat seguro de Windows 11 sin tocar drivers ni MyASUS"
    },
    {
      path: "RESTORE_VBS_ON.bat",
      filename: "RESTORE_VBS_ON.bat",
      content: generateRestoreVbsBat(),
      type: "batch",
      description: "Restaurador de VBS e Integridad de Memoria para seguridad y juegos como Valorant"
    },
    {
      path: "RESTORE_TOTAL.bat",
      filename: "RESTORE_TOTAL.bat",
      content: generateRestoreTotalBat(),
      type: "batch",
      description: "Restaurador de emergencia al estado 100% stock de Windows"
    },
    {
      path: "cfg/autoexec.cfg",
      filename: "autoexec.cfg",
      content: generateAutoexecString(),
      type: "config",
      description: "Configuración competitiva de CS2 optimizada para la Intel UHD 64EU"
    },
    {
      path: "cfg/video.txt",
      filename: "video.txt",
      content: generateVideoTxtString(),
      type: "config",
      description: "Ajustes de video de CS2: 1280x960 4:3 Pantalla Completa + FSR Rendimiento"
    },
    {
      path: "cfg/steam_launch_options.txt",
      filename: "steam_launch_options.txt",
      content: generateLaunchOptionsString(hardware.threads > 8 ? 8 : hardware.threads),
      type: "text",
      description: "Parámetros exactos de lanzamiento para Steam (-threads 8 -high -dx11)"
    },
    {
      path: "tools/LEEME_HERRAMIENTAS.txt",
      filename: "LEEME_HERRAMIENTAS.txt",
      content: [
        'HERRAMIENTAS RECOMENDADAS PARA LA CARPETA C:\\PN64_CS2\\tools\\',
        '',
        '1. ISLC (Intelligent Standby List Cleaner de Wagnardsoft):',
        '   - Descarga gratuita desde wagnardsoft.com',
        '   - Configuracion recomendada:',
        '     * The list size is at least: 1024 MB',
        '     * Free memory is lower than: 512 MB',
        '     * Enable custom timer resolution: 0.50 ms',
        '     * Start ISLC minimized and auto-start with Windows',
        '',
        '2. EmptyStandbyList.exe (de Guru3D / Wagnardsoft):',
        '   - Permite al script Batch liberar la lista de espera de memoria en modo Bestia.',
        '========================================================================'
      ].join('\r\n'),
      type: "text",
      description: "Guía de descarga y configuración de ISLC y EmptyStandbyList"
    },
    {
      path: "LEEME_ORDEN_DE_USO.txt",
      filename: "LEEME_ORDEN_DE_USO.txt",
      content: generateReadmeTxt(),
      type: "text",
      description: "Guía detallada con el orden exacto de ejecución paso a paso"
    },
    {
      path: "FASE2_EXTREMO/EXTREME_v2.ps1",
      filename: "EXTREME_v2.ps1",
      content: generateExtremeV2Ps1(),
      type: "powershell",
      description: "Fase 2: Modo Extremo (Spectre/Meltdown OFF, IFEO Prioridad 3 cs2.exe, IDLEDISABLE 1, PageCombining OFF, MSI Mode, 8GB Pagefile fijo)"
    },
    {
      path: "FASE2_EXTREMO/CS2_Booster_v2.bat",
      filename: "CS2_Booster_v2.bat",
      content: generateBoosterV2Bat(),
      type: "batch",
      description: "Fase 2: Lanzador con auto-restauración al salir (mata Explorer/servicios, activa IDLEDISABLE 1 y restaura todo con 1 tecla)"
    },
    {
      path: "FASE2_EXTREMO/EXTREME_Undo.ps1",
      filename: "EXTREME_Undo.ps1",
      content: generateExtremeUndoPs1(),
      type: "powershell",
      description: "Fase 2: Reversor quirúrgico 100% de todos los tweaks extremos"
    },
    {
      path: "FASE3_GODMODE/GOD_MODE.bat",
      filename: "GOD_MODE.bat",
      content: generateGodModeBat(),
      type: "batch",
      description: "Fase 3: Orquestador God Mode (inicia monitor en ventana paralela, cloquea CPU sin reposo y restaura al pulsar una tecla)"
    },
    {
      path: "FASE3_GODMODE/CS2_GODMODE_MONITOR.ps1",
      filename: "CS2_GODMODE_MONITOR.ps1",
      content: generateGodModeMonitorPs1(),
      type: "powershell",
      description: "Fase 3: Monitor en tiempo real a 1s con alerta por colores (verde/amarillo/rojo) y exportación de CSV de telemetría"
    },
    {
      path: "FASE3_GODMODE/THROTTLESTOP_GUIA.txt",
      filename: "THROTTLESTOP_GUIA.txt",
      content: generateThrottleStopGuideTxt(),
      type: "text",
      description: "Fase 3: Guía de calibración de ThrottleStop TPL para PN64 (clamp PL1 a 28W, EPP 0, perfil CS2)"
    },
    {
      path: "INICIAR_TODO_V3.bat",
      filename: "INICIAR_TODO_V3.bat",
      content: generateIniciarTodoV3Bat(),
      type: "batch",
      description: "Script Maestro V3: Ejecuta en secuencia Fase 1 (1-7), Fase 2 (8-15) y Fase 3 (16-25) con punto de restauración"
    },
    {
      path: "24_AUTO_PRE_GAME.bat",
      filename: "24_AUTO_PRE_GAME.bat",
      content: generateAutoPreGameBat(),
      type: "batch",
      description: "Lanzador Pre-Game Todo-en-Uno: Cierra 20 procesos, libera RAM, fuerza Timer 0.5ms, Máxima Energía y lanza CS2 con Launch Options"
    },
    {
      path: "16_INTERRUPT_MSI_MODE.bat",
      filename: "16_INTERRUPT_MSI_MODE.bat",
      content: generateMsiInterruptBat(),
      type: "batch",
      description: "Fase 3: MSI Mode en todos los dispositivos + Afinidad IRQ (GPU/USB→CPU0, NET→CPU1, NVMe→CPU2) + Timer 0.5ms WinMM"
    },
    {
      path: "17_KERNEL_CPU_ULTRA.bat",
      filename: "17_KERNEL_CPU_ULTRA.bat",
      content: generateKernelCpuUltraBat(),
      type: "batch",
      description: "Fase 3: Kernel Memory IoPageLockLimit, Win32PrioritySeparation 38, BCD Mitigaciones OFF, Cache L2/L3 12800KB, C-States OFF"
    },
    {
      path: "18_GPU_DRIVER_CORE.bat",
      filename: "18_GPU_DRIVER_CORE.bat",
      content: generateGpuDriverCoreBat(),
      type: "batch",
      description: "Fase 3: Driver Intel Iris Xe/UHD Ultra: DVMT 1024MB, Clocks forzados, VSync/AA/AF OFF, Shader Cache 256MB, WDDM Preemptive"
    },
    {
      path: "19_DIRECTX_RUNTIME_PRO.bat",
      filename: "19_DIRECTX_RUNTIME_PRO.bat",
      content: generateDirectxRuntimeProBat(),
      type: "batch",
      description: "Fase 3: Runtime DirectX 11/12 & Vulkan ICD, Shader Pre-compilation, DXGI MaxFrameLatency 1, GpuPriority 8"
    },
    {
      path: "20_IO_STORAGE_SCHEDULER.bat",
      filename: "20_IO_STORAGE_SCHEDULER.bat",
      content: generateIoStorageSchedulerBat(),
      type: "batch",
      description: "Fase 3: NVMe WriteBack, PS0, TRIM, IoPriority 3 cs2.exe, LargePageMinimum, descompresión compact /u de archivos CS2"
    },
    {
      path: "21_STRIPPING_WINDOWS.bat",
      filename: "21_STRIPPING_WINDOWS.bat",
      content: generateStrippingWindowsBat(),
      type: "batch",
      description: "Fase 3: Stripping masivo: 40+ apps UWP, 13 features (Hyper-V, WMP), desinstalación total de OneDrive y 55+ servicios off"
    },
    {
      path: "22_MONITORING_TOOLS.bat",
      filename: "22_MONITORING_TOOLS.bat",
      content: generateMonitoringToolsBat(),
      type: "batch",
      description: "Fase 3: Generador de herramientas: PERF_MONITOR.bat, SYSTEM_DIAGNOSTIC.bat, DPC_LATENCY_CHECKER.bat, FPS_COUNTER.ps1"
    },
    {
      path: "23_CS2_ENGINE_PRO.bat",
      filename: "23_CS2_ENGINE_PRO.bat",
      content: generateCs2EngineProBat(),
      type: "batch",
      description: "Fase 3: CS2 Source 2 Engine Pro: autoexec ULTRA con 200+ comandos, 3 opciones de lanzamiento y config.cfg competitivo"
    },
    {
      path: "25_RAM_DISK_GAME.bat",
      filename: "25_RAM_DISK_GAME.bat",
      content: generateRamDiskGameBat(),
      type: "batch",
      description: "Fase 3: RAM Disk 2GB (Experimental) con ImDisk para shaders temporales y reducción del 50-80% de tiempos de carga"
    },
    {
      path: "config/autoexec_ULTRA.cfg",
      filename: "autoexec_ULTRA.cfg",
      content: generateAutoexecUltraCfg(),
      type: "config",
      description: "Fase 3: autoexec ULTRA v3.0 con 200+ comandos de rendimiento, red 128 tick, gráficos mínimos y reducción de micro-stuttering"
    },
    {
      path: "1_CREAR_PUNTO_RESTAURACION.bat",
      filename: "1_CREAR_PUNTO_RESTAURACION.bat",
      content: generateRestorePointBat(),
      type: "batch",
      description: "Módulo 1: Punto de restauración del sistema antes de comenzar optimizaciones"
    },
    {
      path: "2_OPTIMIZAR_WINDOWS.bat",
      filename: "2_OPTIMIZAR_WINDOWS.bat",
      content: generateOptWindowsBat(),
      type: "batch",
      description: "Módulo 2: Optimización de Windows, GameDVR OFF, MPO Fix y HAGS 2"
    },
    {
      path: "3_OPTIMIZAR_GPU_INTEL.bat",
      filename: "3_OPTIMIZAR_GPU_INTEL.bat",
      content: generateOptGpuIntelBat(),
      type: "batch",
      description: "Módulo 3: Optimización GPU Intel UHD 64EU / Iris Xe, DVMT 1024MB y Prioridad 8"
    },
    {
      path: "4_OPTIMIZAR_RED.bat",
      filename: "4_OPTIMIZAR_RED.bat",
      content: generateOptRedBat(),
      type: "batch",
      description: "Módulo 4: Optimización de Red y TCPNoDelay para menor ping en CS2"
    },
    {
      path: "5_OPTIMIZAR_MEMORIA.bat",
      filename: "5_OPTIMIZAR_MEMORIA.bat",
      content: generateOptMemoriaBat(),
      type: "batch",
      description: "Módulo 5: Pagefile fijo 8GB y desactivación de PageCombining en RAM"
    },
    {
      path: "6_LIMPIAR_PROCESOS.bat",
      filename: "6_LIMPIAR_PROCESOS.bat",
      content: generateLimpiarProcesosBat(),
      type: "batch",
      description: "Módulo 6: Limpieza y finalización de procesos residuales en segundo plano"
    },
    {
      path: "7_CONFIG_CS2.bat",
      filename: "7_CONFIG_CS2.bat",
      content: generateConfigCs2Bat(),
      type: "batch",
      description: "Módulo 7: Copiador de autoexec.cfg y configuraciones a la carpeta de CS2"
    },
    {
      path: "8_OPTIMIZAR_ARRANQUE.bat",
      filename: "8_OPTIMIZAR_ARRANQUE.bat",
      content: generateOptArranqueBat(),
      type: "batch",
      description: "Módulo 8: Configuración de arranque, TSC nativo a 4.4GHz y Dynamic Tick OFF"
    },
    {
      path: "9_TAREAS_MEMORIA_PRO.bat",
      filename: "9_TAREAS_MEMORIA_PRO.bat",
      content: generateTareasMemoriaProBat(),
      type: "batch",
      description: "Módulo 9: Desactivación de tareas programadas de telemetría y diagnósticos CEIP"
    },
    {
      path: "10_DISPOSITIVOS_CORES.bat",
      filename: "10_DISPOSITIVOS_CORES.bat",
      content: generateDispositivosCoresBat(),
      type: "batch",
      description: "Módulo 10: Confinamiento de CS2 a los 4 hilos rápidos de los P-Cores (Mask 15)"
    },
    {
      path: "11_POWER_PLAN_PRO.bat",
      filename: "11_POWER_PLAN_PRO.bat",
      content: generatePowerPlanProBat(),
      type: "batch",
      description: "Módulo 11: Plan de Máximo Rendimiento con 100% de CPU constante"
    },
    {
      path: "12_AUDIO_INPUT_MOUSE.bat",
      filename: "12_AUDIO_INPUT_MOUSE.bat",
      content: generateAudioInputMouseBat(),
      type: "batch",
      description: "Módulo 12: Aceleración de ratón OFF y SystemResponsiveness = 0"
    },
    {
      path: "13_STEAM_DIRECTX.bat",
      filename: "13_STEAM_DIRECTX.bat",
      content: generateSteamDirectxBat(),
      type: "batch",
      description: "Módulo 13: Optimización de Steam Overlay y depuración DirectX OFF"
    },
    {
      path: "14_REGISTRY_ULTRA.bat",
      filename: "14_REGISTRY_ULTRA.bat",
      content: generateRegistryUltraBat(),
      type: "batch",
      description: "Módulo 14: Importación en lote de los 90 tweaks de registro V6"
    },
    {
      path: "15_BIOS_GUIDE_PN64.bat",
      filename: "15_BIOS_GUIDE_PN64.bat",
      content: generateBiosGuidePn64Bat(),
      type: "batch",
      description: "Módulo 15: Guía interactiva de BIOS ASUS F2 (DVMT 1024M, Fan Full Speed)"
    },
    {
      path: "REVERTIR_TODO.bat",
      filename: "REVERTIR_TODO.bat",
      content: generateRevertirTodoBat(),
      type: "batch",
      description: "Reversor Total: Restaura todos los ajustes originales de Windows"
    }
  ];
}

export function downloadSingleFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadPackageZip(hardware: HardwareProfile): Promise<void> {
  const zip = new JSZip();
  const files = getAllPackageFiles(hardware);

  for (const file of files) {
    zip.file(`PN64_CS2/${file.path}`, file.content);
  }

  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ASUS_PN64_CS2_V7_ULTIMATE_PACK.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
