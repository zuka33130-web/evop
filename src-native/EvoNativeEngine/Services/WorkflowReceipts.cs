namespace EvoNativeEngine.Services;
internal static class WorkflowReceipts
{
    public static async Task<T[]> ReadAsync<T>(IBackupManager backups, string kind, Func<T,Guid> identity, int limit = 100) where T:class
    {
        if (kind is not ("template" or "beast" or "debloat" or "cleanup")) throw new ArgumentException("Tipo no permitido.");
        if (!Directory.Exists(backups.BackupDirectory)) return [];
        var prefix = "state_" + kind + "_";
        var list = new List<T>();
        foreach (var path in Directory.EnumerateFiles(backups.BackupDirectory, prefix + "*_latest.json").OrderByDescending(File.GetLastWriteTimeUtc).Take(limit))
        {
            var file = Path.GetFileName(path);
            var name = file.Substring(prefix.Length, file.Length - prefix.Length - "_latest.json".Length);
            if (!Guid.TryParseExact(name,"N",out var id)) continue;
            var receipt = await backups.GetLastStateAsync<T>(kind + "." + id.ToString("N"));
            if (receipt is null || identity(receipt) != id) throw new IOException("Recibo ilegible o identidad inválida: " + kind + "/" + id);
            list.Add(receipt);
        }
        return list.ToArray();
    }
}
