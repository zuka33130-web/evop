using EvoNativeEngine.Services;
using System.Text.Json;

static void Assert(bool value, string message)
{
    if (!value) throw new Exception(message);
}
var backups = new MemoryBackups();
var power = new FakePower();
var engine = new PowerOptimizationService(backups, power);
var original = power.Active;
Assert((await engine.ExecuteAsync("cortex.mode.nucleo", false)).Success, "Apply power");
Assert(power.Active != original, "Power must change");
Assert((await engine.ExecuteAsync("cortex.mode.nucleo", false)).Success, "Reapply power");
Assert((await engine.ExecuteAsync("cortex.mode.nucleo", true)).Success, "Restore power");
Assert(power.Active == original, "Repeated apply must preserve original scheme");
Assert(!(await engine.ExecuteAsync("cortex.mode.nucleo", true)).Success, "No snapshot must fail");
Assert((await engine.ExecuteAsync("tweak.cpu.idledisable", false)).Success, "Apply idle");
Assert(power.Idle[original] == 1, "Idle changed");
var unrelated = Guid.NewGuid();
power.Active = unrelated;
Assert(!(await engine.ExecuteAsync("tweak.cpu.idledisable", false)).Success, "Do not modify another scheme");
Assert((await engine.ExecuteAsync("tweak.cpu.idledisable", true)).Success, "Restore inactive scheme");
Assert(power.Idle[original] == 0 && power.Active == unrelated, "Restore must not activate another scheme");
power.Active = original;
Assert((await engine.ExecuteAsync("tweak.cpu.idledisable", false)).Success, "Apply before failure");
power.IgnoreWrites = true;
Assert(!(await engine.ExecuteAsync("tweak.cpu.idledisable", true)).Success, "Verification failure");
Assert(backups.HasBackup("verified.v1.tweak.cpu.idledisable"), "Keep backup on verification failure");
power.IgnoreWrites = false;
Assert((await engine.ExecuteAsync("tweak.cpu.idledisable", true)).Success, "Retry restore");
power.FailActivation = true;
Assert(!(await engine.ExecuteAsync("cortex.mode.nucleo", false)).Success, "Unavailable power scheme must fail");
Assert(backups.HasBackup("verified.v1.cortex.mode.nucleo"), "Keep backup on API error");
Console.WriteLine("PASS: power apply/reapply/restore, missing backup, changed plan, verification failure, retry, API failure.");

sealed class FakePower : IPowerSettings
{
    public Guid Active = Guid.NewGuid();
    public Dictionary<Guid, uint> Idle = new();
    public bool IgnoreWrites, FailActivation;
    public Guid ActiveScheme() => Active;
    public void Activate(Guid scheme)
    {
        if (FailActivation) throw new IOException("API failure");
        Active = scheme;
    }
    public uint ReadIdle(Guid scheme) => Idle.GetValueOrDefault(scheme);
    public void WriteIdle(Guid scheme, uint value) { if (!IgnoreWrites) Idle[scheme] = value; }
}
sealed class MemoryBackups : IBackupManager
{
    readonly Dictionary<string, string> values = new();
    public string BackupDirectory => "memory";
    public Task<string> CreateSnapshotAsync(string name, object data) => throw new NotSupportedException();
    public Task<T?> ReadSnapshotAsync<T>(string path) => throw new NotSupportedException();
    public Task SaveStateAsync<T>(string id, T state) { values[id] = JsonSerializer.Serialize(state); return Task.CompletedTask; }
    public Task<T?> GetLastStateAsync<T>(string id) => Task.FromResult(values.TryGetValue(id, out var json) ? JsonSerializer.Deserialize<T>(json) : default);
    public bool HasBackup(string id) => values.ContainsKey(id);
    public Task ClearBackupAsync(string id) { values.Remove(id); return Task.CompletedTask; }
}
