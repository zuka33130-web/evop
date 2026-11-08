using System;
using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace EvoNativeEngine.Services;

public interface IBackupManager
{
    string BackupDirectory { get; }
    Task<string> CreateSnapshotAsync(string name, object data);
    Task<T?> ReadSnapshotAsync<T>(string snapshotPath);
    Task SaveStateAsync<T>(string operationId, T state);
    Task<T?> GetLastStateAsync<T>(string operationId);
    bool HasBackup(string operationId);
    Task ClearBackupAsync(string operationId);
}

public class BackupManager : IBackupManager
{
    private readonly ILogger<BackupManager> _logger;
    private readonly string _backupDir;
    private static readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

    public string BackupDirectory => _backupDir;

    public BackupManager(ILogger<BackupManager> logger)
    {
        _logger = logger;
        _backupDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "EvoOptimizer",
            "Backups"
        );

        try
        {
            if (!Directory.Exists(_backupDir))
            {
                Directory.CreateDirectory(_backupDir);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear el directorio de backups en {Dir}", _backupDir);
        }
    }

    public async Task<string> CreateSnapshotAsync(string name, object data)
    {
        string timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        string safeName = Path.GetFileNameWithoutExtension(name).Replace(" ", "_");
        string filePath = Path.Combine(_backupDir, $"backup_{safeName}_{timestamp}.json");

        string json = JsonSerializer.Serialize(data, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json);
        _logger.LogInformation("Copia de respaldo generada exitosamente en: {Path}", filePath);

        return filePath;
    }

    public async Task<T?> ReadSnapshotAsync<T>(string snapshotPath)
    {
        if (!File.Exists(snapshotPath))
        {
            _logger.LogWarning("Archivo de snapshot no encontrado: {Path}", snapshotPath);
            return default;
        }

        string json = await File.ReadAllTextAsync(snapshotPath);
        return JsonSerializer.Deserialize<T>(json);
    }

    private string GetLatestBackupPath(string operationId)
    {
        string safeId = operationId.Replace(".", "_").Replace("/", "_").Replace("\\", "_");
        return Path.Combine(_backupDir, $"state_{safeId}_latest.json");
    }

    public async Task SaveStateAsync<T>(string operationId, T state)
    {
        string path = GetLatestBackupPath(operationId);
        string json = JsonSerializer.Serialize(state, _jsonOptions);
        string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await File.WriteAllTextAsync(temporary, json);
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
        _logger.LogInformation("Estado previo guardado para la operación '{OperationId}' en {Path}", operationId, path);
    }

    public async Task<T?> GetLastStateAsync<T>(string operationId)
    {
        string path = GetLatestBackupPath(operationId);
        if (!File.Exists(path))
        {
            return default;
        }

        try
        {
            string json = await File.ReadAllTextAsync(path);
            return JsonSerializer.Deserialize<T>(json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error al leer el estado previo de '{OperationId}'", operationId);
            return default;
        }
    }

    public bool HasBackup(string operationId)
    {
        string path = GetLatestBackupPath(operationId);
        return File.Exists(path);
    }

    public Task ClearBackupAsync(string operationId)
    {
        string path = GetLatestBackupPath(operationId);
        if (File.Exists(path))
        {
            try
            {
                File.Delete(path);
                _logger.LogInformation("Copia de respaldo eliminada tras restauración para '{OperationId}'", operationId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo eliminar archivo de respaldo {Path}", path);
            }
        }
        return Task.CompletedTask;
    }
}
