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
}

public class BackupManager : IBackupManager
{
    private readonly ILogger<BackupManager> _logger;
    private readonly string _backupDir;

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

        var options = new JsonSerializerOptions { WriteIndented = true };
        string json = JsonSerializer.Serialize(data, options);

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
}
