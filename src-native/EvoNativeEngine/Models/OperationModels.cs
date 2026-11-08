using System;
using System.Collections.Generic;

namespace EvoNativeEngine.Models;

public record OperationCatalogItem(
    string Id,
    string Name,
    string Description,
    string Category,
    bool RequiresElevation,
    bool CanRestore,
    bool IsImplemented,
    bool RequiresConfirmation = false,
    string? ConfirmationMessage = null
);

public record OperationResult(
    bool Success,
    string OperationId,
    string ActionType, // "apply" o "restore"
    DateTime TimestampUtc,
    double DurationMs,
    List<string> Logs,
    object? PreviousState,
    object? CurrentState,
    string? ErrorMessage,
    bool Restored
);

public record OperationHistoryItem(
    string Id,
    string OperationId,
    string ActionType,
    DateTime TimestampUtc,
    bool Success,
    double DurationMs,
    string Summary,
    string? ErrorMessage
);

public record OperationStatusResponse(
    string OperationId,
    bool IsImplemented,
    bool CanRestore,
    bool HasBackup,
    DateTime? LastRunUtc,
    object? CurrentState,
    string? Message
);

public record ProcessSummaryItem(
    int Id,
    string Name,
    long WorkingSetBytes,
    double WorkingSetMb,
    string PriorityClass
);

public record Cs2ProcessState(
    bool IsRunning,
    int? ProcessId,
    string? PriorityClass,
    int? ThreadCount,
    double? WorkingSetMb,
    DateTime? StartTimeUtc,
    string StatusMessage
);

public record TempCleanupState(
    int FilesDeleted,
    int FilesSkipped,
    long BytesFreed,
    double MbFreed,
    string TempDirectory
);

public record RealtimeTelemetryData(
    DateTime TimestampUtc,
    string TimeString,
    double? CpuUsagePct,
    double? CpuClockPct,
    int? CpuClockMhz,
    double? GpuUsagePct,
    double? RamFreeMb,
    double? RamTotalMb,
    double? RamUsedPct,
    double? TemperatureCelsius,
    string ThrottlingStatus, // "NO", "P-THROT", "T-THROT", "MARGINAL"
    string TelemetrySource,  // "Hardware Real (Win32/WMI)"
    bool IsCs2Running,
    int? Cs2ProcessId
);
