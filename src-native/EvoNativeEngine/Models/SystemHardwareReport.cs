using System;
using System.Collections.Generic;

namespace EvoNativeEngine.Models;

public record EngineStatusResponse(
    bool IsReady,
    string Version,
    string EngineName,
    bool IsElevated,
    int ProcessId,
    double UptimeSeconds,
    string OperatingSystem,
    string Architecture,
    DateTime StartedAtUtc,
    string[] SupportedEndpoints
);

public record OperatingSystemInfo(
    string Name,
    string Version,
    string BuildNumber,
    string Architecture,
    string WindowsEdition,
    DateTime? InstallDate,
    double UptimeHours
);

public record ProcessorInfo(
    string Name,
    string Manufacturer,
    int PhysicalCores,
    int LogicalProcessors,
    int MaxClockSpeedMhz,
    string Architecture,
    string Socket
);

public record MemoryInfo(
    ulong TotalPhysicalBytes,
    ulong AvailablePhysicalBytes,
    double TotalGb,
    double AvailableGb,
    double UsedGb,
    double UsedPercentage
);

public record GpuInfo(
    string Name,
    string Manufacturer,
    string DriverVersion,
    ulong AdapterRamBytes,
    int AdapterRamMb,
    bool IsPrimary
);

public record DiskDriveInfo(
    string DriveLetter,
    string VolumeLabel,
    string DriveType,
    string FileSystem,
    long TotalBytes,
    long FreeBytes,
    double TotalGb,
    double FreeGb,
    double UsedGb,
    double FreePercentage,
    bool IsSystemDrive
);

public record SystemHardwareReport(
    OperatingSystemInfo OperatingSystem,
    ProcessorInfo Processor,
    MemoryInfo Memory,
    List<GpuInfo> GraphicsCards,
    List<DiskDriveInfo> StorageDrives,
    DateTime QueriedAtUtc,
    double ExecutionTimeMs,
    string HostName,
    bool IsWindowsPlatform,
    bool IsElevated
);
