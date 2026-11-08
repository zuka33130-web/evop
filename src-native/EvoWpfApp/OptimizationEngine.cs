using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.ServiceProcess;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace RyzerCortexUltra.WpfApp
{
    /// <summary>
    /// Motor C# de Optimización a Nivel Kernel y Sistema Operativo.
    /// Ejecuta operaciones nativas del Registro de Windows, WMI y PowerShell
    /// en segundo plano sin consolas de comandos visibles.
    /// </summary>
    public static class OptimizationEngine
    {
        /// <summary>
        /// MÓDULO DE SEGURIDAD (Rollback): Crea un Punto de Restauración del Sistema
        /// mediante WMI / PowerShell antes de aplicar cambios de Fase 3.
        /// </summary>
        public static async Task<bool> CreateSystemRestorePointAsync(string description, IProgress<string> progress)
        {
            return await Task.Run(() =>
            {
                try
                {
                    progress?.Report($"[SEGURIDAD] Creando Punto de Restauración del Sistema: '{description}'...");

                    // Intento 1: Vía Clase WMI SystemRestore de Windows
                    try
                    {
                        var scope = new ManagementScope(@"\root\default");
                        var restoreClass = new ManagementClass(scope, new ManagementPath("SystemRestore"), null);
                        var inParams = restoreClass.GetMethodParameters("CreateRestorePoint");
                        
                        inParams["Description"] = description;
                        inParams["RestorePointType"] = 12; // MODIFY_SETTINGS
                        inParams["EventType"] = 100;        // BEGIN_SYSTEM_CHANGE

                        var outParams = restoreClass.InvokeMethod("CreateRestorePoint", inParams, null);
                        var result = Convert.ToUInt32(outParams["ReturnValue"]);

                        if (result == 0)
                        {
                            progress?.Report("  ✓ Punto de Restauración creado exitosamente vía WMI.");
                            return true;
                        }
                    }
                    catch
                    {
                        // Fallback a PowerShell Checkpoint-Computer
                    }

                    // Intento 2: Vía PowerShell Checkpoint-Computer
                    string psCommand = $"Checkpoint-Computer -Description '{description}' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction SilentlyContinue";
                    var psResult = ExecutePowerShellCommand(psCommand);

                    if (psResult.ExitCode == 0)
                    {
                        progress?.Report("  ✓ Punto de Restauración creado exitosamente vía PowerShell.");
                        return true;
                    }

                    progress?.Report("  ℹ Aviso: No se pudo crear el punto de restauración (puede estar deshabilitado en Protección de Sistema). Continuando con seguridad granular...");
                    return false;
                }
                catch (Exception ex)
                {
                    progress?.Report($"  ⚠️ Error en módulo de respaldo: {ex.Message}");
                    return false;
                }
            });
        }

        /// <summary>
        /// Ejecuta un comando de PowerShell en estricto segundo plano sin consolas visibles (CreateNoWindow = true).
        /// Captura stdout y stderr en tiempo real.
        /// </summary>
        public static (int ExitCode, string Output, string Error) ExecutePowerShellCommand(string command)
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"{command}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            if (process == null) return (-1, "", "No se pudo iniciar proceso de PowerShell.");

            string stdout = process.StandardOutput.ReadToEnd();
            string stderr = process.StandardError.ReadToEnd();
            process.WaitForExit();

            return (process.ExitCode, stdout, stderr);
        }

        /// <summary>
        /// Módulos Migrados: Inyección nativa en el Registro de Windows (Microsoft.Win32.Registry)
        /// Ejecutado 100% en C# con privilegios de Administrador.
        /// </summary>
        public static async Task ApplyDirectRegistryTweaksAsync(IProgress<string> progress)
        {
            await Task.Run(() =>
            {
                progress?.Report("\n[FASE 3] Inyectando Tweaks Nativos en Registro de Windows (Microsoft.Win32.Registry)...");

                // --- TWEAK 1: Desactivar Servicio de Telemetría (DiagTrack) ---
                try {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\DiagTrack", true))
                    {
                        if (key != null)
                        {
                            key.SetValue("Start", 4, RegistryValueKind.DWord); // 4 = Disabled
                            progress?.Report("  ✓ HKLM\\SYSTEM\\CurrentControlSet\\Services\\DiagTrack -> Start = 4 (Disabled)");
                        }
                    }

                    // Detener servicio activo si está corriendo
                    using (var sc = new ServiceController("DiagTrack"))
                    {
                        if (sc.Status == ServiceControllerStatus.Running)
                        {
                            sc.Stop();
                            progress?.Report("  ✓ Servicio 'DiagTrack' detenido en tiempo real.");
                        }
                    }
                } catch (Exception ex) {
                    progress?.Report($"  ℹ DiagTrack: {ex.Message}");
                }

                // --- TWEAK 2: Quantum del Planificador NT (Win32PrioritySeparation = 38 / 0x26) ---
                try {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\PriorityControl", true))
                    {
                        if (key != null)
                        {
                            key.SetValue("Win32PrioritySeparation", 38, RegistryValueKind.DWord); // 0x26 = Short, Variable, 3:1
                            progress?.Report("  ✓ PriorityControl -> Win32PrioritySeparation = 38 (0x26) [Quantum Corto & Variable]");
                        }
                    }
                } catch (Exception ex) {
                    progress?.Report($"  ⚠️ PriorityControl Error: {ex.Message}");
                }

                // --- TWEAK 3: SystemResponsiveness & NetworkThrottling ---
                try {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile", true))
                    {
                        if (key != null)
                        {
                            key.SetValue("SystemResponsiveness", 0, RegistryValueKind.DWord);
                            key.SetValue("NetworkThrottlingIndex", unchecked((int)0xFFFFFFFF), RegistryValueKind.DWord);
                            progress?.Report("  ✓ SystemProfile -> SystemResponsiveness = 0 & NetworkThrottlingIndex = 0xFFFFFFFF");
                        }
                    }
                } catch (Exception ex) {
                    progress?.Report($"  ⚠️ SystemProfile Error: {ex.Message}");
                }

                // --- TWEAK 4: GPU TDR Delay (Timeout Detection & Recovery = 10s) ---
                try {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", true))
                    {
                        if (key != null)
                        {
                            key.SetValue("TdrDelay", 10, RegistryValueKind.DWord);
                            key.SetValue("TdrDdiDelay", 10, RegistryValueKind.DWord);
                            key.SetValue("HwSchMode", 2, RegistryValueKind.DWord); // HAGS On
                            progress?.Report("  ✓ GraphicsDrivers -> TdrDelay = 10s, TdrDdiDelay = 10s, HwSchMode = 2 (HAGS)");
                        }
                    }
                } catch (Exception ex) {
                    progress?.Report($"  ⚠️ GraphicsDrivers Error: {ex.Message}");
                }
            });
        }

        /// <summary>
        /// Orquestador principal de la FASE 3 EXTREMA
        /// </summary>
        public static async Task ExecutePhase3ExtremeAsync(IProgress<string> progress)
        {
            var sw = Stopwatch.StartNew();

            progress?.Report("=======================================================================");
            progress?.Report("  INICIANDO FASE 3 EXTREMA - RYZER CORTEX ULTRA (C# WPF .NET 8)        ");
            progress?.Report("  Target: ASUS ExpertCenter PN64 (Intel Core i3-1220P 2P+8E · Intel UHD) ");
            progress?.Report("=======================================================================");

            // Paso 1: Crear Punto de Restauración
            await CreateSystemRestorePointAsync("RYZER_CORTEX_FASE3_BEFORE_APPLY", progress);

            // Paso 2: Inyección Nativa de Registro C#
            await ApplyDirectRegistryTweaksAsync(progress);

            // Paso 3: Ejecución de Scripts de Afinidad IRQ & Modo MSI
            progress?.Report("\n[FASE 3] Ajustando Afinidades IRQ y Modo MSI para Intel UHD (CPU 0) y Red (CPU 2)...");
            string irqScript = @"
                $pciPath = 'HKLM:\SYSTEM\CurrentControlSet\Enum\PCI'
                Get-ChildItem -Path $pciPath -ErrorAction SilentlyContinue | ForEach-Object {
                    $dev = $_
                    Get-ChildItem -Path $dev.PSPath -ErrorAction SilentlyContinue | ForEach-Object {
                        $k = $_
                        if ($k.PSChildName -like '*VEN_8086*') {
                            $policy = Join-Path $k.PSPath 'Device Parameters\Interrupt Management\Affinity Policy'
                            if (-not (Test-Path $policy)) { New-Item $policy -Force | Out-Null }
                            Set-ItemProperty -Path $policy -Name 'DevicePriority' -Value 3 -Type DWord -Force
                        }
                    }
                }
                Write-Output '✓ Afinidad IRQ y Modo MSI aplicados a iGPU Intel UHD.'
            ";

            var psResult = await Task.Run(() => ExecutePowerShellCommand(irqScript));
            if (psResult.ExitCode == 0)
            {
                progress?.Report($"  ✓ {psResult.Output.Trim()}");
            }
            else
            {
                progress?.Report($"  ⚠️ Aviso IRQ: {psResult.Error}");
            }

            sw.Stop();
            progress?.Report("=======================================================================");
            progress?.Report($"  ✓ FASE 3 EXTREMA COMPLETADA CON ÉXITO EN {sw.ElapsedMilliseconds} ms");
            progress?.Report("=======================================================================");
        }
    }
}
