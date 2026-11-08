using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using EvoNativeEngine.Models;
using Microsoft.Extensions.Logging;

#if WINDOWS
using System.Management;
#endif

namespace EvoNativeEngine.Services;

public interface IDiagnosticsService
{
    Task<SystemHardwareReport> GetSystemHardwareReportAsync(bool forceRefresh = false);
}

public class DiagnosticsService : IDiagnosticsService
{
    private readonly ILogger<DiagnosticsService> _logger;
    private readonly ISecurityService _securityService;
    private SystemHardwareReport? _cachedReport;
    private DateTime _lastScanTime = DateTime.MinValue;
    private readonly TimeSpan _cacheDuration = TimeSpan.FromSeconds(10);
    private readonly object _lock = new();

    public DiagnosticsService(ILogger<DiagnosticsService> logger, ISecurityService securityService)
    {
        _logger = logger;
        _securityService = securityService;
    }

    public Task<SystemHardwareReport> GetSystemHardwareReportAsync(bool forceRefresh = false)
    {
        lock (_lock)
        {
            if (!forceRefresh && _cachedReport != null && (DateTime.UtcNow - _lastScanTime) < _cacheDuration)
            {
                _logger.LogDebug("Devolviendo reporte de diagnóstico en caché.");
                return Task.FromResult(_cachedReport);
            }

            var sw = Stopwatch.StartNew();
            _logger.LogInformation("Iniciando escaneo de diagnóstico de hardware en el sistema...");

            bool isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
            bool isElevated = _securityService.IsElevated();

            var osInfo = QueryOperatingSystemInfo(isWindows);
            var cpuInfo = QueryProcessorInfo(isWindows);
            var memInfo = QueryMemoryInfo(isWindows);
            var gpus = QueryGpuInfo(isWindows);
            var disks = QueryDiskDrives();

            sw.Stop();
            _logger.LogInformation("Diagnóstico completado en {ElapsedMs:F2} ms.", sw.Elapsed.TotalMilliseconds);

            _cachedReport = new SystemHardwareReport(
                OperatingSystem: osInfo,
                Processor: cpuInfo,
                Memory: memInfo,
                GraphicsCards: gpus,
                StorageDrives: disks,
                QueriedAtUtc: DateTime.UtcNow,
                ExecutionTimeMs: sw.Elapsed.TotalMilliseconds,
                HostName: Environment.MachineName,
                IsWindowsPlatform: isWindows,
                IsElevated: isElevated
            );

            _lastScanTime = DateTime.UtcNow;
            return Task.FromResult(_cachedReport);
        }
    }

    private OperatingSystemInfo QueryOperatingSystemInfo(bool isWindows)
    {
        string name = RuntimeInformation.OSDescription;
        string version = Environment.OSVersion.Version.ToString();
        string build = Environment.OSVersion.Version.Build.ToString();
        string arch = RuntimeInformation.OSArchitecture.ToString();
        string edition = "Standard Edition";
        DateTime? installDate = null;
        double uptimeHours = (Environment.TickCount64 / 1000.0) / 3600.0;

        if (isWindows)
        {
            try
            {
                using var searcher = new System.Management.ManagementObjectSearcher("SELECT Caption, Version, BuildNumber, OSArchitecture, InstallDate FROM Win32_OperatingSystem");
                foreach (System.Management.ManagementObject obj in searcher.Get())
                {
                    name = obj["Caption"]?.ToString()?.Trim() ?? name;
                    version = obj["Version"]?.ToString() ?? version;
                    build = obj["BuildNumber"]?.ToString() ?? build;
                    edition = name;
                    if (obj["InstallDate"] != null)
                    {
                        try
                        {
                            installDate = System.Management.ManagementDateTimeConverter.ToDateTime(obj["InstallDate"].ToString());
                        }
                        catch
                        {
                            // Ignorar parsing de fecha si no coincide con formato DMTF
                        }
                    }
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "WMI Win32_OperatingSystem no disponible. Usando fallback de Environment.");
            }
        }

        return new OperatingSystemInfo(
            Name: name,
            Version: version,
            BuildNumber: build,
            Architecture: arch,
            WindowsEdition: edition,
            InstallDate: installDate,
            UptimeHours: Math.Round(uptimeHours, 2)
        );
    }

    private ProcessorInfo QueryProcessorInfo(bool isWindows)
    {
        string name = "Procesador Genérico";
        string manufacturer = "Desconocido";
        int cores = Environment.ProcessorCount;
        int threads = Environment.ProcessorCount;
        int maxClockMhz = 0;
        string arch = RuntimeInformation.ProcessArchitecture.ToString();
        string socket = "N/A";

        if (isWindows)
        {
            try
            {
                using var searcher = new System.Management.ManagementObjectSearcher("SELECT Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, SocketDesignation FROM Win32_Processor");
                foreach (System.Management.ManagementObject obj in searcher.Get())
                {
                    name = obj["Name"]?.ToString()?.Trim() ?? name;
                    manufacturer = obj["Manufacturer"]?.ToString()?.Trim() ?? manufacturer;
                    if (int.TryParse(obj["NumberOfCores"]?.ToString(), out int c)) cores = c;
                    if (int.TryParse(obj["NumberOfLogicalProcessors"]?.ToString(), out int t)) threads = t;
                    if (int.TryParse(obj["MaxClockSpeed"]?.ToString(), out int m)) maxClockMhz = m;
                    socket = obj["SocketDesignation"]?.ToString()?.Trim() ?? socket;
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "WMI Win32_Processor falló. Usando Environment.ProcessorCount.");
            }
        }

        return new ProcessorInfo(
            Name: name,
            Manufacturer: manufacturer,
            PhysicalCores: cores,
            LogicalProcessors: threads,
            MaxClockSpeedMhz: maxClockMhz,
            Architecture: arch,
            Socket: socket
        );
    }

    private MemoryInfo QueryMemoryInfo(bool isWindows)
    {
        ulong totalBytes = 0;
        ulong freeBytes = 0;

        if (isWindows)
        {
            try
            {
                var memStatus = new MEMORYSTATUSEX();
                memStatus.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
                if (GlobalMemoryStatusEx(ref memStatus))
                {
                    totalBytes = memStatus.ullTotalPhys;
                    freeBytes = memStatus.ullAvailPhys;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GlobalMemoryStatusEx falló. Intentando WMI Win32_OperatingSystem.");
            }

            if (totalBytes == 0)
            {
                try
                {
                    using var searcher = new System.Management.ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem");
                    foreach (System.Management.ManagementObject obj in searcher.Get())
                    {
                        if (ulong.TryParse(obj["TotalVisibleMemorySize"]?.ToString(), out ulong totalKb))
                            totalBytes = totalKb * 1024;
                        if (ulong.TryParse(obj["FreePhysicalMemory"]?.ToString(), out ulong freeKb))
                            freeBytes = freeKb * 1024;
                        break;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "WMI memoria falló.");
                }
            }
        }

        if (totalBytes == 0)
        {
            // Fallback para entornos donde no está disponible Win32
            totalBytes = (ulong)GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
            freeBytes = totalBytes > 0 ? totalBytes - (ulong)GC.GetTotalMemory(false) : 0;
        }

        double totalGb = Math.Round(totalBytes / (1024.0 * 1024.0 * 1024.0), 2);
        double availGb = Math.Round(freeBytes / (1024.0 * 1024.0 * 1024.0), 2);
        double usedGb = Math.Round(totalGb - availGb, 2);
        if (usedGb < 0) usedGb = 0;
        double usedPct = totalGb > 0 ? Math.Round((usedGb / totalGb) * 100.0, 1) : 0;

        return new MemoryInfo(
            TotalPhysicalBytes: totalBytes,
            AvailablePhysicalBytes: freeBytes,
            TotalGb: totalGb,
            AvailableGb: availGb,
            UsedGb: usedGb,
            UsedPercentage: usedPct
        );
    }

    private List<GpuInfo> QueryGpuInfo(bool isWindows)
    {
        var list = new List<GpuInfo>();

        if (isWindows)
        {
            try
            {
                using var searcher = new System.Management.ManagementObjectSearcher("SELECT Name, AdapterCompatibility, DriverVersion, AdapterRAM FROM Win32_VideoController");
                bool isFirst = true;
                foreach (System.Management.ManagementObject obj in searcher.Get())
                {
                    string gpuName = obj["Name"]?.ToString()?.Trim() ?? "Controlador de Pantalla";
                    string manufacturer = obj["AdapterCompatibility"]?.ToString()?.Trim() ?? "Desconocido";
                    string driver = obj["DriverVersion"]?.ToString()?.Trim() ?? "N/A";
                    ulong vramBytes = 0;
                    if (ulong.TryParse(obj["AdapterRAM"]?.ToString(), out ulong ram))
                    {
                        vramBytes = ram;
                    }
                    int vramMb = (int)(vramBytes / (1024 * 1024));

                    list.Add(new GpuInfo(
                        Name: gpuName,
                        Manufacturer: manufacturer,
                        DriverVersion: driver,
                        AdapterRamBytes: vramBytes,
                        AdapterRamMb: vramMb,
                        IsPrimary: isFirst
                    ));

                    isFirst = false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "WMI Win32_VideoController no disponible.");
            }
        }

        if (list.Count == 0)
        {
            list.Add(new GpuInfo(
                Name: "Controlador Gráfico del Sistema",
                Manufacturer: "Genérico",
                DriverVersion: "N/A",
                AdapterRamBytes: 0,
                AdapterRamMb: 0,
                IsPrimary: true
            ));
        }

        return list;
    }

    private List<DiskDriveInfo> QueryDiskDrives()
    {
        var list = new List<DiskDriveInfo>();
        string systemDriveRoot = Path.GetPathRoot(Environment.SystemDirectory) ?? "C:\\";

        try
        {
            var drives = DriveInfo.GetDrives();
            foreach (var d in drives)
            {
                if (!d.IsReady) continue;

                long total = d.TotalSize;
                long free = d.AvailableFreeSpace;
                long used = total - free;

                double totalGb = Math.Round(total / (1024.0 * 1024.0 * 1024.0), 2);
                double freeGb = Math.Round(free / (1024.0 * 1024.0 * 1024.0), 2);
                double usedGb = Math.Round(used / (1024.0 * 1024.0 * 1024.0), 2);
                double freePct = totalGb > 0 ? Math.Round((freeGb / totalGb) * 100.0, 1) : 0;

                bool isSystem = string.Equals(d.RootDirectory.FullName.TrimEnd('\\'), systemDriveRoot.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);

                list.Add(new DiskDriveInfo(
                    DriveLetter: d.Name,
                    VolumeLabel: string.IsNullOrWhiteSpace(d.VolumeLabel) ? (isSystem ? "Windows System" : "Disco Local") : d.VolumeLabel,
                    DriveType: d.DriveType.ToString(),
                    FileSystem: d.DriveFormat,
                    TotalBytes: total,
                    FreeBytes: free,
                    TotalGb: totalGb,
                    FreeGb: freeGb,
                    UsedGb: usedGb,
                    FreePercentage: freePct,
                    IsSystemDrive: isSystem
                ));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al consultar unidades de disco con DriveInfo.");
        }

        return list;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);
}
