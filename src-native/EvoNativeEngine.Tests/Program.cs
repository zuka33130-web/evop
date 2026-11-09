using EvoNativeEngine.Services;
using EvoNativeEngine.Models;
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

var tuningBackups = new MemoryBackups();
var fakeWindows = new FakeWindowsTuning();
var tuning = new WindowsTuningService(tuningBackups, fakeWindows);
Assert((await tuning.ExecuteAsync("cortex.mode.stutter", false)).Success, "Memory apply");
Assert(!fakeWindows.PageCombining, "Memory actually changed");
Assert((await tuning.ExecuteAsync("tweak.memory.pagecombining_off", false)).Success, "Alias reapply");
Assert((await tuning.ExecuteAsync("cortex.mode.stutter", true)).Success && fakeWindows.PageCombining, "Alias restore original");
Assert(!(await tuning.ExecuteAsync("cortex.mode.stutter", true)).Success, "Memory missing backup");
Assert((await tuning.ExecuteAsync("cortex.mode.services", false)).Success, "Services apply");
Assert(!fakeWindows.Services["DiagTrack"] && !fakeWindows.Services["MapsBroker"], "Services stopped");
Assert((await tuning.ExecuteAsync("cortex.mode.debloat", false)).Success, "Services alias reapply");
Assert((await tuning.ExecuteAsync("tweak.services.gaming_toggle", true)).Success, "Services restore");
Assert(fakeWindows.Services["DiagTrack"] && !fakeWindows.Services["MapsBroker"], "Do not start originally stopped services");
fakeWindows.Services["MapsBroker"] = true;
fakeWindows.FailService = "MapsBroker";
Assert(!(await tuning.ExecuteAsync("cortex.mode.services", false)).Success, "Service partial failure reported");
Assert(tuningBackups.HasBackup("verified.v1.tweak.services.gaming_toggle"), "Partial failure keeps snapshot");
fakeWindows.FailService = null;
Assert((await tuning.ExecuteAsync("cortex.mode.services", true)).Success && fakeWindows.Services["DiagTrack"], "Restore after partial failure");
fakeWindows.IgnoreMemoryWrites = true;
Assert(!(await tuning.ExecuteAsync("cortex.mode.stutter", false)).Success, "Memory verification fails honestly");
Assert(tuningBackups.HasBackup("verified.v1.tweak.memory.pagecombining_off"), "Memory snapshot retained");
Console.WriteLine("PASS: memory and service snapshots, aliases, reapply, original stopped state, partial failure and retry.");

var gameBackups = new MemoryBackups();
var gameProvider = new FakeGameProvider();
var gaming = new GameOptimizationService(gameBackups, gameProvider);
var normalGame = gameProvider.State;
Assert((await gaming.ExecuteAsync("gaming.cs2.priority", false)).Success, "Game priority apply");
Assert(gameProvider.State.Priority == System.Diagnostics.ProcessPriorityClass.High && gameProvider.State.Affinity == normalGame.Affinity, "Default preserves affinity");
Assert((await gaming.ExecuteAsync("cortex.mode.bestia", false)).Success, "Repeated priority apply");
Assert((await gaming.ExecuteAsync("tweak.cpu.affinity_15", false)).Success, "Explicit affinity apply");
Assert(gameProvider.State.Affinity == 15, "Explicit affinity verified");
Assert((await gaming.ExecuteAsync("gaming.cs2.priority", true)).Success, "Game combined restore");
Assert(gameProvider.State == normalGame, "Original process values preserved across aliases");
Assert(!(await gaming.ExecuteAsync("gaming.cs2.priority", true)).Success, "Game missing backup fails");
Assert((await gaming.ExecuteAsync("gaming.cs2.priority", false)).Success, "Apply before PID reuse");
gameProvider.State = normalGame with { StartedUtcTicks = normalGame.StartedUtcTicks + 1 };
Assert(!(await gaming.ExecuteAsync("gaming.cs2.priority", true)).Success, "Same PID different start time must not restore");
Assert(gameProvider.State.Priority == normalGame.Priority && gameBackups.HasBackup(GameOptimizationService.BackupKey), "PID reuse untouched and backup kept");
gameProvider.State = normalGame;
gameProvider.IgnoreWrites = true;
Assert(!(await gaming.ExecuteAsync("gaming.cs2.priority", false)).Success, "Game verification failure");
Assert(gameBackups.HasBackup(GameOptimizationService.BackupKey), "Game failure keeps recovery data");
gameProvider.IgnoreWrites = false;
Assert((await gaming.ExecuteAsync("gaming.cs2.priority.restore", false)).Success, "Restore action alias");
Console.WriteLine("PASS: game priority preserves affinity, explicit affinity, shared original state, PID reuse, verification and recovery.");

var distribution = Enumerable.Repeat(10.0, 990).Concat(Enumerable.Repeat(100.0, 10)).ToArray();
var frameStats = FrameBenchmarkService.Calculate(distribution, 60);
Assert(Math.Abs(frameStats.OnePercentLowFps - 10) < .000001, "1% low tail mean exact fixture");
Assert(frameStats.P99Ms == 10 && frameStats.P999Ms == 100, "Nearest rank percentiles distinguish P99 from low");
Assert(Math.Abs(frameStats.AverageFps - 1000.0 / 10.9) < .000001, "FPS over total time, not average instantaneous FPS");
Assert(frameStats.BudgetMissPercent == 1 && frameStats.StutterPercent == 1, "Budget misses and real hitches retained");
var realCsv = "Application,ProcessID,SwapChainAddress,MsBetweenPresents\n" +
    string.Concat(Enumerable.Range(0, 1200).Select(_ => "cs2.exe,10,0x123,40\n"));
var benchmarkInput = new BenchmarkInput(realCsv, "cs2.exe", "fixed-route", "baseline", 1280, 720, 0, 20, 5);
var benchmark = FrameBenchmarkService.Analyze(benchmarkInput);
Assert(benchmark.Metrics.Frames >= 1074 && benchmark.Metrics.Frames <= 1076, "CSV warmup in seconds");
Assert(benchmark.Metrics.OnePercentLowFps == 25 && benchmark.SourceColumn == "MsBetweenPresents", "CSV actual intervals analyzed");
var comparisonRuns = Enumerable.Range(0, 6).Select(i => benchmark with {
    Id = Guid.NewGuid(), Width = i < 3 ? 1280 : 1920, Height = i < 3 ? 720 : 1080,
    Configuration = i < 3 ? "720p" : "1080p", SourceSha256 = "fixture" + i }).ToArray();
var ranked = FrameBenchmarkService.Compare(comparisonRuns);
Assert(ranked.Rankings[0].Width == 1920 && ranked.Rankings.All(r => !r.Provisional && r.MeetsTarget), "Prefer resolution among stable repeated candidates");
bool rejectedMixed = false;
try { FrameBenchmarkService.Analyze(benchmarkInput with { Csv = realCsv + "cs2.exe,11,0x456,20\n" }); }
catch (ArgumentException) { rejectedMixed = true; }
Assert(rejectedMixed, "Never merge different process instances or swapchains");
bool rejectedDuplicate = false;
try { FrameBenchmarkService.Compare([benchmark, benchmark with { Id = Guid.NewGuid() }]); }
catch (ArgumentException) { rejectedDuplicate = true; }
Assert(rejectedDuplicate, "Same trace cannot count as independent repetitions");
bool rejectedContext = false;
try { FrameBenchmarkService.Compare([benchmark, benchmark with { Scenario = "different-route", SourceSha256 = "other" }]); }
catch (ArgumentException) { rejectedContext = true; }
Assert(rejectedContext, "Never compare incompatible scene contexts");
Console.WriteLine("PASS: CSV validation, warmup, exact fixture metrics, percentile definition, stable candidate ranking, duplicate and context rejection.");

var control = Enumerable.Range(0, 5).Select(i => benchmark with { Id = Guid.NewGuid(), SourceSha256 = "control" + i }).ToArray();
var improved = Enumerable.Range(0, 5).Select(i => benchmark with {
    Id = Guid.NewGuid(), SourceSha256 = "improved" + i,
    Metrics = benchmark.Metrics with { OnePercentLowFps = 30, AverageFps = 30, P99Ms = 33 }
}).ToArray();
Assert(BeforeAfterAnalyzer.Analyze(control, improved, true).Verdict == "Señal de mejora", "Detect run-level improvement with stable tails");
Assert(BeforeAfterAnalyzer.Analyze(control, improved, false).Verdict == "Inconcluso", "Imported or confounded experiment cannot claim a verified effect");
Assert(BeforeAfterAnalyzer.Analyze(control.Take(3).ToArray(), improved.Take(3).ToArray(), true).Verdict == "Inconcluso", "Too few runs stay inconclusive");
var unchanged = control.Select((r, i) => r with { Id = Guid.NewGuid(), SourceSha256 = "unchanged" + i }).ToArray();
Assert(BeforeAfterAnalyzer.Analyze(control, unchanged, true).Verdict == "Sin cambio relevante observado", "No invented improvement");
var regressed = improved.Select((r, i) => r with { SourceSha256 = "regressed" + i,
    Metrics = r.Metrics with { OnePercentLowFps = 20, P99Ms = 50 } }).ToArray();
Assert(BeforeAfterAnalyzer.Analyze(control, regressed, true).Verdict == "Señal de regresión", "Regression despite possible average FPS improvement");
var changedResolution = improved.Select(r => r with { Width = 1920 }).ToArray();
var contextRejected = false;
try { BeforeAfterAnalyzer.Analyze(control, changedResolution, true); }
catch (ArgumentException) { contextRejected = true; }
Assert(contextRejected, "Cannot attribute resolution change to a system tweak");
var revisionJournal = new OperationJournal();
Parallel.For(0, 100, _ => revisionJournal.Touch());
Assert(revisionJournal.Revision == 100, "Concurrent operation revision tracking");
Console.WriteLine("PASS: A/B improvement, unchanged, regression, inconclusive data/provenance, context validation and revision counter.");

var session = new SessionAuthentication(new string('a', 64));
Assert(session.Required && session.Authorize(new string('a', 64)), "Session authorizes exact token");
Assert(!session.Authorize(null) && !session.Authorize(new string('b', 64)) && !session.Authorize("short"), "Reject missing/wrong token");
Assert(!new SessionAuthentication(null).Required, "Standalone compatibility is explicit");
Assert(SessionAuthentication.IsLocalOrigin("http://127.0.0.1:48120", 48120), "Desktop origin allowed");
Assert(!SessionAuthentication.IsLocalOrigin("http://127.0.0.1:3000", 48120), "Different port denied in desktop mode");
Assert(!SessionAuthentication.IsLocalOrigin("https://localhost.evil.example:48120", 48120), "Reject suffix spoofing");
Assert(!SessionAuthentication.IsLocalOrigin("http://localhost:48120@evil.example", 48120), "Reject userinfo spoofing");
Assert(!SessionAuthentication.IsLocalOrigin("null", 48120), "Opaque origin denied");
Console.WriteLine("PASS: per-session authentication and exact local-origin validation.");

var fixtureRoot = Path.Combine(Path.GetTempPath(), "evo-safe-path-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(fixtureRoot);
try
{
    Assert(SmartCleanupService.SafePath(fixtureRoot, Path.Combine(fixtureRoot, "inside.tmp")), "Allow child file");
    Assert(!SmartCleanupService.SafePath(fixtureRoot, fixtureRoot), "Never operate on root itself");
    Assert(!SmartCleanupService.SafePath(fixtureRoot, Path.Combine(fixtureRoot, "..", "outside.tmp")), "Reject path traversal");
}
finally { Directory.Delete(fixtureRoot); }
if (OperatingSystem.IsWindows())
{
    var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer", "TestFixtures-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(root);
    try
    {
        var file = Path.Combine(root, "old.tmp");
        await File.WriteAllTextAsync(file, "recoverable-test-payload");
        File.SetLastWriteTimeUtc(file, DateTime.UtcNow.AddDays(-10));
        var recent = Path.Combine(root, "recent.tmp"); await File.WriteAllTextAsync(recent, "keep");
        var cleaner = new SmartCleanupService(new MemoryBackups(), new OperationJournal(), new() { ["fixture"] = root });
        var plan = await cleaner.ScanAsync();
        var candidate = plan.Items.Single(i => i.Path == file);
        Assert(!plan.Items.Any(i => i.Path == recent), "Do not clean recent files");
        var quarantined = await cleaner.QuarantineAsync(new(plan.Id, [candidate.Id]));
        Assert(!File.Exists(file) && quarantined.BytesQuarantined > 0, "Actually moved to quarantine, not fabricated freed bytes");
        var restored = await cleaner.RestoreAsync(quarantined.Id);
        Assert(restored.Errors.Count == 0 && await File.ReadAllTextAsync(file) == "recoverable-test-payload", "Restore exact file content");
        File.SetLastWriteTimeUtc(file, DateTime.UtcNow.AddDays(-10));
        plan = await cleaner.ScanAsync(); candidate = plan.Items.Single(i => i.Path == file);
        await File.WriteAllTextAsync(file, "changed-since-scan");
        var skipped = await cleaner.QuarantineAsync(new(plan.Id, [candidate.Id]));
        Assert(skipped.Errors.Count > 0 && File.Exists(file), "Revalidate changed file before moving");
        File.SetLastWriteTimeUtc(file, DateTime.UtcNow.AddDays(-10));
        plan = await cleaner.ScanAsync(); candidate = plan.Items.Single(i => i.Path == file);
        quarantined = await cleaner.QuarantineAsync(new(plan.Id, [candidate.Id]));
        var refusedPurge = false;
        try { await cleaner.PurgeAsync(quarantined.Id, "wrong"); } catch (ArgumentException) { refusedPurge = true; }
        Assert(refusedPurge, "Irreversible purge requires exact confirmation");
        var purged = await cleaner.PurgeAsync(quarantined.Id, "ELIMINAR DEFINITIVAMENTE");
        Assert(purged.Errors.Count == 0 && purged.BytesQuarantined == 0 && !File.Exists(file), "Purge real quarantined file");
        Assert(purged.Action == "purge" && purged.BytesDeleted > 0, "Persist measured logical deletion, not fabricated disk free space");
        await File.WriteAllTextAsync(file, "original-payload"); File.SetLastWriteTimeUtc(file, DateTime.UtcNow.AddDays(-10));
        plan = await cleaner.ScanAsync(); candidate = plan.Items.Single(i => i.Path == file);
        quarantined = await cleaner.QuarantineAsync(new(plan.Id, [candidate.Id]));
        Assert(quarantined.Errors.Count == 0 && quarantined.Items.Single().Sha256 is not null, "Quarantine includes original SHA256 and verifies move");
        var stored = quarantined.Items.Single().StoredPath!;
        await File.WriteAllTextAsync(stored, "tampered-payload"); // Same length: size alone cannot certify identity.
        restored = await cleaner.RestoreAsync(quarantined.Id);
        Assert(restored.Errors.Count > 0 && restored.Items.Count == 1 && !File.Exists(file), "Tampered quarantine cannot be reported restored");
        var refusedTampered = await cleaner.PurgeAsync(quarantined.Id, "ELIMINAR DEFINITIVAMENTE");
        Assert(refusedTampered.Errors.Count > 0 && File.Exists(stored), "Tampered file and manifest retained for inspection");
        await File.WriteAllTextAsync(stored, "original-payload");
        await File.WriteAllTextAsync(file, "occupied");
        restored = await cleaner.RestoreAsync(quarantined.Id);
        Assert(restored.Items.Count == 1 && await File.ReadAllTextAsync(file) == "occupied", "Restore does not overwrite externally occupied original");
        File.Delete(file);
        restored = await cleaner.RestoreAsync(quarantined.Id);
        Assert(restored.Action == "restore" && restored.Errors.Count == 0 && restored.Items.Count == 0 && await File.ReadAllTextAsync(file) == "original-payload", "Retry after conflict verifies exact content");
        Assert(SmartCleanupService.MissingLocalExecutable("rundll32.exe something.dll") is null, "Do not guess relative command or COM/DLL targets");
        Assert(SmartCleanupService.MissingLocalExecutable(@"\\server\share\absent.exe") is null, "Do not classify offline network programs as orphaned");
    }
    finally { Directory.Delete(root, true); }
}
// Real Windows filesystem acceptance fixtures: no mock filesystem and no deletion in user directories.
if (OperatingSystem.IsWindows())
{
    var cleanFixture = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer", "CleanAcceptance-" + Guid.NewGuid().ToString("N"));
    var tempRoot = Path.Combine(cleanFixture, "temp"); var thumbnailRoot = Path.Combine(cleanFixture, "thumbnails");
    var recycleRoot = Path.Combine(cleanFixture, "recycle"); var personalRoot = Path.Combine(cleanFixture, "personal");
    foreach (var directory in new[] { tempRoot, thumbnailRoot, recycleRoot, personalRoot }) Directory.CreateDirectory(directory);
    async Task<string> Old(string directory, string name, string content)
    {
        var path = Path.Combine(directory, name); await File.WriteAllTextAsync(path, content);
        File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddDays(-10)); return path;
    }
    var readOnly = "";
    try
    {
        var exact = await Old(tempRoot, "exact.tmp", "known recoverable bytes");
        var locked = await Old(tempRoot, "locked.tmp", "must not delete");
        readOnly = await Old(tempRoot, "readonly.tmp", "protected"); File.SetAttributes(readOnly, FileAttributes.ReadOnly);
        var recent = Path.Combine(tempRoot, "recent.tmp"); await File.WriteAllTextAsync(recent, "recent");
        var thumbnail = await Old(thumbnailRoot, "thumbcache_fixture.db", "thumbnail payload");
        var notThumbnail = await Old(thumbnailRoot, "personal.docx", "never selected by thumbnail scanner");
        var personal = await Old(personalRoot, "family.jpg", "never scanned");
        var hardLink = Path.Combine(tempRoot, "shared-personal.tmp");
        NativeCleanupFixture.HardLink(hardLink, personal);
        var recyclePayload = await Old(recycleRoot, "$Rfixture.tmp", "recycled-payload");
        var recycleMetadata = await Old(recycleRoot, "$Ifixture.tmp", "recycle-metadata-fixture");
        var large = Path.Combine(tempRoot, "large.tmp");
        using (var big = new FileStream(large, FileMode.CreateNew, FileAccess.Write)) { big.SetLength(70L * 1024 * 1024); }
        File.SetLastWriteTimeUtc(large, DateTime.UtcNow.AddDays(-10));
        var store = new MemoryBackups();
        var service = new SmartCleanupService(store, new OperationJournal(), new() {
            ["Temporales de usuario"] = tempRoot, ["Miniaturas de usuario"] = thumbnailRoot,
            ["Papelera de usuario · fixture"] = recycleRoot });
        CleanupPlan scan;
        using (var busyFile = new FileStream(locked, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
        {
            scan = await service.ScanAsync();
            Assert(!scan.Items.Any(i => i.Path == locked), "Real sharing violation excludes a file in use");
            Assert(scan.Outcomes!.Any(o => o.Path == locked && o.Status == "skipped"), "Locked-file reason is not silently discarded");
        }
        Assert(scan.Items.Any(i => i.Path == large && i.Bytes == 70L * 1024 * 1024), "Analysis includes large files, no historical 64MB estimate/cap");
        Assert(!scan.Items.Any(i => i.Path == personal || i.Path == hardLink || i.Path == notThumbnail || i.Path == recent || i.Path == readOnly), "Personal/outside-category/recent/read-only files protected");
        var recycled = scan.Items.Single(i => i.Path == recyclePayload);
        Assert(recycled.Companion?.Path == recycleMetadata, "Recycle payload is inseparable from its user metadata in selection");
        Assert(scan.LogicalBytes == scan.Items.Where(i => i.Kind == "File").Sum(i => i.Bytes + (i.Companion?.Bytes ?? 0)), "Exact observed logical sum including recycle metadata");
        Assert(scan.Items.Where(i => i.Kind == "File").All(i => i.FileIdentity is not null && i.ScannedSha256 is not null && i.AllocatedBytes.HasValue), "Real handle identity, SHA256 and Windows allocation for every candidate");
        var recycleReceipt = await service.QuarantineAsync(new(scan.Id, [recycled.Id]));
        Assert(recycleReceipt.Errors.Count == 0 && !File.Exists(recyclePayload) && !File.Exists(recycleMetadata) && recycleReceipt.Items.Count == 2, "Actually quarantine both recycle files, not just Shell display");
        var recovered = await service.RestoreAsync(recycleReceipt.Id);
        Assert(recovered.Errors.Count == 0 && await File.ReadAllTextAsync(recyclePayload) == "recycled-payload" && await File.ReadAllTextAsync(recycleMetadata) == "recycle-metadata-fixture", "Actually restore recycle payload and metadata");
        scan = await service.ScanAsync();
        var originalCandidate = scan.Items.Single(i => i.Path == exact);
        var previousTime = File.GetLastWriteTimeUtc(exact);
        await File.WriteAllTextAsync(exact, new string('x', (int)originalCandidate.Bytes)); File.SetLastWriteTimeUtc(exact, previousTime);
        var changed = await service.QuarantineAsync(new(scan.Id, [originalCandidate.Id]));
        Assert(changed.Errors.Count > 0 && File.Exists(exact), "Same identity/size/timestamp but changed content is caught by scan SHA256");
        scan = await service.ScanAsync();
        using (var cancelled = new CancellationTokenSource())
        {
            cancelled.Cancel();
            var cancelledScan = await service.ScanAsync(cancelled.Token);
            Assert(cancelledScan.Cancelled && !cancelledScan.Complete && cancelledScan.Items.Count == 0, "Scan cancellation returns honest partial inventory");
        }
        var cancelA = await Old(tempRoot, "cancel-a.tmp", "first payload");
        var cancelB = await Old(tempRoot, "cancel-b.tmp", "second payload");
        scan = await service.ScanAsync();
        Action<CleanupProgress> stopAfterOne = p => { if (p.Processed == 1) service.RequestCancellation(); };
        service.ProgressChanged += stopAfterOne;
        var cancelledMove = await service.QuarantineAsync(new(scan.Id, [scan.Items.Single(i => i.Path == cancelA).Id, scan.Items.Single(i => i.Path == cancelB).Id]));
        service.ProgressChanged -= stopAfterOne;
        Assert(cancelledMove.Cancelled && cancelledMove.Status == "cancelled" && !File.Exists(cancelA) && File.Exists(cancelB), "Mid-operation cancellation commits one file and leaves next untouched");
        Assert((await service.RestoreAsync(cancelledMove.Id)).Errors.Count == 0 && File.Exists(cancelA), "Cancelled cleanup still recovers completed files");
        scan = await service.ScanAsync();
        var purgeSource = await service.QuarantineAsync(new(scan.Id, [scan.Items.Single(i => i.Path == cancelA).Id, scan.Items.Single(i => i.Path == cancelB).Id]));
        var exclusive = new FileStream(purgeSource.Items[0].StoredPath!, FileMode.Open, FileAccess.Read, FileShare.None);
        var blockedPurge = await service.PurgeAsync(purgeSource.Id, "ELIMINAR DEFINITIVAMENTE");
        exclusive.Dispose();
        Assert(blockedPurge.Errors.Count > 0 && blockedPurge.Items.Count == 1 && blockedPurge.BytesDeleted == purgeSource.Items[1].Original.Bytes, "DELETE handle rejects an in-use file while other files continue");
        Assert(blockedPurge.Volumes!.Count == 1 && blockedPurge.Volumes[0].FreeBefore.HasValue && blockedPurge.Volumes[0].FreeAfter.HasValue &&
            blockedPurge.Volumes[0].ObservedFreeDelta == blockedPurge.Volumes[0].FreeAfter - blockedPurge.Volumes[0].FreeBefore, "Read actual Windows free-space before/after, retain signed delta without invented attribution");
        var retriedPurge = await service.PurgeAsync(purgeSource.Id, "ELIMINAR DEFINITIVAMENTE");
        Assert(retriedPurge.Errors.Count == 0 && retriedPurge.Items.Count == 0 && retriedPurge.BytesDeleted == purgeSource.Items[0].Original.Bytes, "Retry only deletes previously blocked file and counts this call exactly");
        scan = await service.ScanAsync();
        var cancellationPurgeSource = await service.QuarantineAsync(new(scan.Id, [scan.Items.Single(i=>i.Path==thumbnail).Id, scan.Items.Single(i=>i.Path==exact).Id]));
        service.ProgressChanged += stopAfterOne;
        var stoppedPurge = await service.PurgeAsync(cancellationPurgeSource.Id, "ELIMINAR DEFINITIVAMENTE");
        service.ProgressChanged -= stopAfterOne;
        Assert(stoppedPurge.Cancelled && stoppedPurge.Items.Count == 1 && stoppedPurge.BytesDeleted == cancellationPurgeSource.Items[0].Original.Bytes, "Purge cancellation retains remaining recovery data and exact completed bytes");
        Assert((await service.RestoreAsync(stoppedPurge.Id)).Errors.Count == 0 && File.Exists(exact) && !File.Exists(thumbnail), "Recovery restores only non-purged files after cancellation");
        Assert(!service.RequestCancellation() && service.Progress.Action == "idle", "No stale cancellation token after an operation");
        // Exercise the actual Windows Shell recycle bin for this uniquely named test file only.
        var shellOriginal = Path.Combine(personalRoot, "evo-shell-" + Guid.NewGuid().ToString("N") + ".tmp");
        await File.WriteAllTextAsync(shellOriginal, "actual Windows recycled payload");
        NativeCleanupFixture.Recycle(shellOriginal);
        Assert(!File.Exists(shellOriginal), "Windows Shell actually recycled the fixture");
        var realBin = SmartCleanupService.Roots().Single(r => r.Key.StartsWith("Papelera de usuario") &&
            string.Equals(Path.GetPathRoot(r.Value), Path.GetPathRoot(shellOriginal), StringComparison.OrdinalIgnoreCase));
        string? realMetadata = null;
        foreach (var path in Directory.EnumerateFiles(realBin.Value, "$I*"))
        {
            var data = await File.ReadAllBytesAsync(path);
            if (data.Length < 28) continue;
            var offset = BitConverter.ToInt64(data, 0) == 2 ? 28 : 24;
            var shellPathFromMetadata = System.Text.Encoding.Unicode.GetString(data, offset, data.Length - offset).TrimEnd('\0');
            if (string.Equals(shellPathFromMetadata, shellOriginal, StringComparison.OrdinalIgnoreCase)) { realMetadata = path; break; }
        }
        Assert(realMetadata is not null, "Found real Shell $I metadata referencing only our fixture path");
        var realPayload = Path.Combine(realBin.Value, "$R" + Path.GetFileName(realMetadata!)[2..]);
        var metadataBytes = await File.ReadAllBytesAsync(realMetadata!);
        File.SetLastWriteTimeUtc(realPayload, DateTime.UtcNow.AddDays(-10));
        File.SetLastWriteTimeUtc(realMetadata!, DateTime.UtcNow.AddDays(-10));
        var realBinService = new SmartCleanupService(store, new OperationJournal(), new() { [realBin.Key] = realBin.Value });
        var realBinPlan = await realBinService.ScanAsync();
        var realEntry = realBinPlan.Items.Single(i => i.Path == realPayload);
        var realBinQuarantine = await realBinService.QuarantineAsync(new(realBinPlan.Id, [realEntry.Id]));
        Assert(realBinQuarantine.Errors.Count == 0 && !File.Exists(realMetadata!) && !File.Exists(realPayload), "Actually quarantine the Shell-generated recycle pair");
        Assert((await realBinService.RestoreAsync(realBinQuarantine.Id)).Errors.Count == 0 &&
            (await File.ReadAllBytesAsync(realMetadata!)).SequenceEqual(metadataBytes) &&
            await File.ReadAllTextAsync(realPayload) == "actual Windows recycled payload", "Actual recycle entry restored byte-for-byte, including original $I metadata");
        realBinPlan = await realBinService.ScanAsync();
        realBinQuarantine = await realBinService.QuarantineAsync(new(realBinPlan.Id, [realBinPlan.Items.Single(i=>i.Path==realPayload).Id]));
        var realBinPurged = await realBinService.PurgeAsync(realBinQuarantine.Id, "ELIMINAR DEFINITIVAMENTE");
        Assert(realBinPurged.Errors.Count == 0 && realBinPurged.Items.Count == 0 && !File.Exists(realMetadata!) && !File.Exists(realPayload), "Purge actually removes only our recycled entry and its metadata");
        Console.WriteLine("::notice title=EvoClean real Windows acceptance::" + JsonSerializer.Serialize(new {
            RealFileSystem = true, RealShellRecycle = true, LargeFileBytes = 70L * 1024 * 1024,
            LogicalDeletedBlockedPurge = blockedPurge.BytesDeleted, LogicalDeletedRetry = retriedPurge.BytesDeleted,
            FreeBefore = blockedPurge.Volumes![0].FreeBefore, FreeAfter = blockedPurge.Volumes[0].FreeAfter,
            SignedObservedDelta = blockedPurge.Volumes[0].ObservedFreeDelta,
            CancelledPurgeRetainedItems = stoppedPurge.Items.Count, ShellDeletedBytes = realBinPurged.BytesDeleted,
            LockedReadonlyPersonalAndHardLinksProtected = true
        }));
        var evidencePath = Environment.GetEnvironmentVariable("EVO_CLEANUP_EVIDENCE");
        if (!string.IsNullOrWhiteSpace(evidencePath))
            await File.WriteAllTextAsync(evidencePath, JsonSerializer.Serialize(new {
                TestedAtUtc = DateTime.UtcNow, Windows = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                Filesystem = new DriveInfo(Path.GetPathRoot(cleanFixture)!).DriveFormat,
                InitialLogicalBytes = scan.LogicalBytes, AnalysisOf70MiBFile = true, LockedAndProtectedFilesSkipped = true,
                SameSizeTimestampContentTamperingRejected = true, CancellationBetweenFilesVerified = true,
                RealShellRecycleQuarantineRestorePurge = true,
                PartialPurge = blockedPurge, RetryPurge = retriedPurge, CancelledPurge = stoppedPurge,
                ShellPurge = realBinPurged
            }, new JsonSerializerOptions { WriteIndented = true }));

    }
    finally
    {
        if (File.Exists(readOnly)) File.SetAttributes(readOnly, FileAttributes.Normal);
        Directory.Delete(cleanFixture, true);
    }
    Console.WriteLine("PASS: actual Windows EvoClean categories, 70MB analysis, allocation, locked/protected files, recycle pair restoration, content revalidation and safe cancellation.");
}

var advisorHardware = new EvoNativeEngine.Models.SystemHardwareReport(
    new("Windows", "11", "test", "x64", "test", null, 1), new("Test CPU", "Test", 4, 8, 3000, "x64", "test"),
    new(8UL * 1024 * 1024 * 1024, 512UL * 1024 * 1024, 8, .5, 7.5, 93.75), [],
    [new("C:", "System", "Fixed", "NTFS", 1000, 50, 100, 5, 95, 5, true)], DateTime.UtcNow, 1, "test", true, false);
var advice = LocalAuditAdvisor.Recommend(advisorHardware, [new("cs2", 1024)], 12);
Assert(advice.Any(a => a.Id == "memory-pressure") && advice.Any(a => a.Id.StartsWith("disk-")), "Advice tied to measured pressure and disk space");
Assert(advice.Any(a => a.OperationId == "gaming.cs2.priority" && a.RequiresAbTest), "Never advertise priority as a proven win");
Console.WriteLine("PASS: path boundaries, real quarantine/restore/purge fixtures, stale preview checks and evidence-based local recommendations.");

Assert((await gaming.ExecuteAsync("gaming.cs2.priority", false)).Success, "Prepare stale session test");
var refusedActive = false;
try { await gaming.RetireExpiredAsync(); } catch (InvalidOperationException) { refusedActive = true; }
Assert(refusedActive && gameBackups.HasBackup(GameOptimizationService.BackupKey), "Cannot discard backup for a living game instance");
gameProvider.Alive = false;
var priorState = gameProvider.State;
await gaming.RetireExpiredAsync();
Assert(!gameBackups.HasBackup(GameOptimizationService.BackupKey) && gameBackups.Archives > 0 && priorState == gameProvider.State, "Archive expired snapshot without modifying a new process");
Console.WriteLine("PASS: expired game recovery keeps archives and refuses active-instance discard.");

var timelineTest = FrameBenchmarkService.BuildTimeline(Enumerable.Repeat(10d, 200).ToArray());
Assert(timelineTest.Length == 2 && timelineTest.All(p => p.Frames == 100 && Math.Abs(p.AverageFps - 100) < .000001), "Timeline uses measured intervals rather than arithmetic instant FPS");
var measuredIntervals = new[] { 10d, 20d, 30d };
Assert(Math.Abs(FrameBenchmarkService.Calculate(measuredIntervals, 60).AverageFps - 50) < .000001, "Average FPS equals frame intervals / measured time, not average of reciprocal intervals");
Console.WriteLine("PASS: FPS formula and timeline bins are deterministic over measured intervals.");

// All new actions execute through a typed provider; these fixtures never modify Windows.
Assert(OptimizationLibrary.Definitions.Count >= 50, "At least fifty distinct new native actions");
Assert(OptimizationLibrary.Definitions.Values.Select(d => (d.Kind,d.Hive,d.Path,d.ValueName)).Distinct().Count() == OptimizationLibrary.Definitions.Count, "Do not count duplicate aliases as independent optimizations");
var librarySecurity = new FakeLibrarySecurity();
foreach (var definition in OptimizationLibrary.Definitions.Values)
{
    var store = new MemoryBackups(); var backend = new FakeLibraryBackend();
    var service = new LibraryOptimizationService(store, librarySecurity, backend);
    var originalValue = backend.Read(definition);
    Assert((await service.ExecuteAsync(definition.Id, false)).Success, "Native library apply " + definition.Id);
    Assert((await service.ExecuteAsync(definition.Id, false)).Success, "Native library reapply " + definition.Id);
    Assert((await service.ExecuteAsync(definition.Id, true)).Success && backend.Read(definition, originalValue.Context) == originalValue, "Native library exact restore " + definition.Id);
    Assert(!(await service.ExecuteAsync(definition.Id, true)).Success, "Missing backup is not guessed " + definition.Id);
}
var errorBackups = new MemoryBackups(); var errorBackend = new FakeLibraryBackend { IgnoreWrites = true };
var errorLibrary = new LibraryOptimizationService(errorBackups, librarySecurity, errorBackend);
Assert(!(await errorLibrary.ExecuteAsync("library.gaming.game_mode", false)).Success && errorBackups.HasBackup(LibraryOptimizationService.BackupKey("library.gaming.game_mode")), "Keep original backup on readback failure");
errorBackend.IgnoreWrites = false;
Assert((await errorLibrary.ExecuteAsync("library.gaming.game_mode", true)).Success, "Retry recovery after library failure");
var powerDefinition = OptimizationLibrary.Definitions["library.power.epp"];
var schemeBackups = new MemoryBackups(); var schemeBackend = new FakeLibraryBackend();
var schemeLibrary = new LibraryOptimizationService(schemeBackups, librarySecurity, schemeBackend);
var initialScheme = schemeBackend.Scheme;
Assert((await schemeLibrary.ExecuteAsync(powerDefinition.Id, false)).Success, "Power setting applies to original scheme");
schemeBackend.Scheme = Guid.NewGuid().ToString();
Assert(!(await schemeLibrary.ExecuteAsync(powerDefinition.Id, false)).Success, "No redirect to a different plan");
Assert((await schemeLibrary.ExecuteAsync(powerDefinition.Id, true)).Success && schemeBackend.Scheme != initialScheme, "Restoring old plan must not switch unrelated active plan");
librarySecurity.Elevated = false;
Assert(!(await new LibraryOptimizationService(new MemoryBackups(), librarySecurity, new FakeLibraryBackend()).ExecuteAsync("library.power.epp", false)).Success, "Admin actions denied before write");
librarySecurity.Elevated = true;
Assert(!WindowsOptionalApplications.AllowedName("steam") && !WindowsOptionalApplications.AllowedName("cs2") && !WindowsOptionalApplications.AllowedName("svchost") && WindowsOptionalApplications.AllowedName("chrome"), "Beast allowlist protects dependencies");
var workflowBackups = new MemoryBackups(); var workflowOps = new FakeWorkflowOperations();
var workflowTemplates = new OptimizationTemplateService(workflowOps, workflowBackups, librarySecurity);
var optionalApps = new FakeOptionalApplications();
var beast = new BeastSessionService(optionalApps, workflowOps, workflowTemplates, workflowBackups, new OperationJournal());
var beastPlan = beast.Preview();
var beastResult = await beast.StartAsync(new(beastPlan.Id, [], false, false, true, "INICIAR MODO BESTIA"));
Assert(beastResult.Finished && optionalApps.Closed == 0 && workflowOps.Applied.SequenceEqual(new[] { "gaming.cs2.launch", "gaming.cs2.priority" }), "Beast closes nothing by default and uses only launch/High without affinity");
var replayDenied = false;
try { await beast.StartAsync(new(beastPlan.Id, [], false, false, false, "INICIAR MODO BESTIA")); } catch (ArgumentException) { replayDenied = true; }
Assert(replayDenied, "Beast preview cannot be replayed");
var ownerBackups = new MemoryBackups(); var ownerBackend = new FakeLibraryBackend();
var ownerOps = new FakeWorkflowOperations { Library = new LibraryOptimizationService(ownerBackups, librarySecurity, ownerBackend), Store = ownerBackups };
var ownerTemplates = new OptimizationTemplateService(ownerOps, ownerBackups, librarySecurity);
var ownerReceipt = await ownerTemplates.ApplyAsync("gaming", new(["library.gaming.game_mode"], "APLICAR PLANTILLA"));
ownerOps.OnRestore = async id => {
    var snapshot = await ownerBackups.GetLastStateAsync<LibraryOptimizationService.Snapshot>(LibraryOptimizationService.BackupKey(id));
    await ownerBackups.SaveStateAsync(LibraryOptimizationService.BackupKey(id), snapshot! with { OwnerId = "foreign-replaced-between-check-and-write" });
};
var ownerRestore = await ownerTemplates.RestoreAsync(ownerReceipt.Id);
Assert(!ownerRestore.Restored && ownerBackups.HasBackup(LibraryOptimizationService.BackupKey("library.gaming.game_mode")) && ownerBackend.Read(OptimizationLibrary.Definitions["library.gaming.game_mode"]).Value == "1", "Template revalidates snapshot ownership under mutation lock, even when replaced after preview check");
var packageProvider = new FakeOptionalPackages();
var debloat = new DebloatService(packageProvider, new MemoryBackups(), new OperationJournal());
var packagePlan = JsonSerializer.SerializeToElement(await debloat.PreviewAsync()).GetProperty("Plan");
Assert(packagePlan.GetProperty("Candidates").GetArrayLength() == 1, "Debloat excludes Store even if provider returns it");
var packageReceipt = await debloat.RemoveAsync(new(packagePlan.GetProperty("Id").GetGuid(), ["Microsoft.BingNews"], "DESINSTALAR APLICACIONES"));
Assert(packageReceipt.Results.All(r => r.Success) && (await packageProvider.ListAsync()).All(p => p.Name != "Microsoft.BingNews"), "Optional package removal verified");
Assert((await debloat.RestoreAsync(packageReceipt.Id)).Results.Last().Success, "Optional package restore verified without claiming data recovery");
Console.WriteLine($"PASS: {OptimizationLibrary.Definitions.Count} new actions, exact backups, permissions, plan isolation, Beast dependencies and Appx allowlist.");

if (OperatingSystem.IsWindows())
{
    var fixturePath = @"Software\EvoOptimizerTests\Library_" + Guid.NewGuid().ToString("N");
    var windowsBackend = new WindowsLibraryBackend();
    var fixture = new LibraryDefinition("fixture.registry", "Isolated registry test", "Tests", "RegistryDword", "HKCU", fixturePath, "Value", "1", "fixture", "fixture");
    try
    {
        var absent = windowsBackend.Read(fixture);
        Assert(!absent.Exists, "Isolated HKCU fixture starts absent");
        windowsBackend.Write(fixture, new(true,"RegistryDword","1"));
        Assert(windowsBackend.Read(fixture) == new LibraryValue(true,"RegistryDword","1"), "Real Windows DWORD write/read");
        windowsBackend.Write(fixture, new(true,"RegistryString","original exact string"));
        Assert(windowsBackend.Read(fixture) == new LibraryValue(true,"RegistryString","original exact string"), "Real Windows string type/value readback");
        windowsBackend.Write(fixture, absent);
        Assert(windowsBackend.Read(fixture) == absent, "Real Windows restore original absence");
    }
    finally { Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(fixturePath, false); }
    Console.WriteLine("PASS: actual isolated Windows HKCU backend write/read/type/absence fixture.");
}

var toggleStore = new MemoryBackups(); var toggleBackend = new FakeLibraryBackend();
var toggleOps = new FakeWorkflowOperations { Library = new LibraryOptimizationService(toggleStore, librarySecurity, toggleBackend), Store = toggleStore };
var toggleService = new OptimizationTemplateService(toggleOps, toggleStore, librarySecurity, toggleBackend);
var toggleDefinition = OptimizationLibrary.Definitions["library.gaming.game_mode"];
var toggleOriginal = toggleBackend.Read(toggleDefinition);
Assert(!(await toggleService.SwitchStatesAsync()).Single(s => s.TemplateId == "gaming").Checked, "Slider starts without owned changes");
var toggleOn = await toggleService.ToggleAsync("gaming", new(true,"ACTIVAR PLANTILLA",[toggleDefinition.Id]));
Assert(toggleOn.Success && toggleOn.Status.Checked && toggleBackend.Read(toggleDefinition).Value == "1", "Slider ON executes real backend path");
var toggleOff = await toggleService.ToggleAsync("gaming", new(false,"DESACTIVAR PLANTILLA"));
Assert(toggleOff.Success && !toggleOff.Status.Checked && toggleBackend.Read(toggleDefinition) == toggleOriginal, "Slider OFF restores exact original, not guessed inverse");
await toggleService.ToggleAsync("gaming", new(true,"ACTIVAR PLANTILLA",[toggleDefinition.Id]));
toggleBackend.IgnoreWrites = true;
var toggleFailure = await toggleService.ToggleAsync("gaming", new(false,"DESACTIVAR PLANTILLA"));
Assert(!toggleFailure.Success && toggleFailure.Status.Checked && toggleStore.HasBackup(LibraryOptimizationService.BackupKey(toggleDefinition.Id)), "Failed OFF remains checked with recovery backup");
toggleBackend.IgnoreWrites = false;
Assert((await toggleService.ToggleAsync("gaming", new(false,"DESACTIVAR PLANTILLA"))).Success, "Retry OFF recovers original");
foreach (var action in OptimizationTemplateService.Templates.Single(t => t.Id == "gaming").Operations)
{
    var definition = OptimizationLibrary.Definitions[action];
    toggleBackend.Write(definition, new(true,definition.Kind,definition.Target));
}
var externallyConfigured = (await toggleService.SwitchStatesAsync()).Single(s => s.TemplateId == "gaming");
Assert(!externallyConfigured.Checked && externallyConfigured.State == "configured", "Matching external settings are not owned or guessed reversible");
Console.WriteLine("PASS: native template switches ON/OFF, exact restore, partial failure, retry and external configuration.");

// Persisted inventory and global best-effort recovery use the production file-backed backup manager.
var recoveryRoot = Path.Combine(Path.GetTempPath(), "evo-recovery-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(recoveryRoot);
try
{
    var disk = new BackupManager(Microsoft.Extensions.Logging.Abstractions.NullLogger<BackupManager>.Instance, recoveryRoot);
    var cleanRecovery = new SmartCleanupService(disk, new OperationJournal());
    var recoveryOps = new FakeWorkflowOperations { FailRecovery = true };
    var recoveryPackages = new FakeOptionalPackages();
    var recoveryDebloat = new DebloatService(recoveryPackages, disk, new OperationJournal());
    var recoveryPackagePlan = JsonSerializer.SerializeToElement(await recoveryDebloat.PreviewAsync()).GetProperty("Plan");
    var removed = await recoveryDebloat.RemoveAsync(new(recoveryPackagePlan.GetProperty("Id").GetGuid(), ["Microsoft.BingNews"], "DESINSTALAR APLICACIONES"));
    var globalRecovery = new RecoveryService(recoveryOps, cleanRecovery, recoveryDebloat, disk);
    bool confirmationRefused = false;
    try { await globalRecovery.RestoreAllAsync(new("incorrecta")); } catch (ArgumentException) { confirmationRefused = true; }
    Assert(confirmationRefused, "Global recovery requires explicit confirmation before changes");
    var globalResult = await globalRecovery.RestoreAllAsync(new("RESTAURAR TODO"));
    Assert(!globalResult.Success && !globalResult.Restored, "Global failure never reported fully restored");
    Assert((await recoveryPackages.ListAsync()).Any(p => p.Name == "Microsoft.BingNews"), "Global recovery continues Appx after operation failure");
    recoveryOps.FailRecovery = false;
    Assert((await globalRecovery.RestoreAllAsync(new("RESTAURAR TODO"))).Success, "Global retry succeeds for remaining operations");
    for (int n = 0; n < 105; n++)
    {
        var id = Guid.NewGuid();
        await disk.SaveStateAsync("cleanup." + id.ToString("N"), new CleanupReceipt(id, DateTime.UtcNow, [], 0, [], "fixture"));
    }
    var reopened = new BackupManager(Microsoft.Extensions.Logging.Abstractions.NullLogger<BackupManager>.Instance, recoveryRoot);
    Assert((await new SmartCleanupService(reopened, new OperationJournal()).ReceiptsAsync()).Length == 105, "Inventory persists across service restart with no latest-100 truncation");
    var corruptId = Guid.NewGuid();
    await File.WriteAllTextAsync(Path.Combine(recoveryRoot, "state_cleanup_" + corruptId.ToString("N") + "_latest.json"), "{broken");
    Assert(!(await globalRecovery.RestoreAllAsync(new("RESTAURAR TODO"))).Success, "Unreadable inventory does not become empty successful recovery");
    Assert(!Directory.EnumerateFiles(recoveryRoot, "*.tmp").Any(), "Atomic backup writes leave no temporary snapshots");
}
finally { Directory.Delete(recoveryRoot, true); }
Console.WriteLine("PASS: global confirmation, partial failure, continued recovery, persistent untruncated inventory and corrupt-backup honesty.");

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
    public int Archives;
    public Task<string> CreateSnapshotAsync(string name, object data) { Archives++; return Task.FromResult(name); }
    public Task<T?> ReadSnapshotAsync<T>(string path) => throw new NotSupportedException();
    public Task SaveStateAsync<T>(string id, T state) { values[id] = JsonSerializer.Serialize(state); return Task.CompletedTask; }
    public Task<T?> GetLastStateAsync<T>(string id) => Task.FromResult(values.TryGetValue(id, out var json) ? JsonSerializer.Deserialize<T>(json) : default);
    public bool HasBackup(string id) => values.ContainsKey(id);
    public Task ClearBackupAsync(string id) { values.Remove(id); return Task.CompletedTask; }
}

sealed class FakeWindowsTuning : IWindowsTuning
{
    public bool PageCombining = true, IgnoreMemoryWrites;
    public string? FailService;
    public Dictionary<string, bool> Services = new() { ["DiagTrack"] = true, ["MapsBroker"] = false };
    public Task<bool> ReadPageCombiningAsync() => Task.FromResult(PageCombining);
    public Task SetPageCombiningAsync(bool enabled) { if (!IgnoreMemoryWrites) PageCombining = enabled; return Task.CompletedTask; }
    public bool? ReadService(string name) => Services.TryGetValue(name, out var state) ? state : null;
    public void SetService(string name, bool running)
    {
        if (name == FailService) throw new IOException("Service failure");
        Services[name] = running;
    }
}

sealed class FakeGameProvider : IGameProcessProvider, IGameProcess
{
    public GameProcessState State = new(42, 1234567, "cs2", System.Diagnostics.ProcessPriorityClass.Normal, 255);
    public bool IgnoreWrites;
    public bool Alive = true;
    public bool OriginalAlive(GameProcessState original) => Alive;
    public IGameProcess OpenCs2() => this;
    public GameProcessState Read() => State;
    public void SetPriority(System.Diagnostics.ProcessPriorityClass priority) { if (!IgnoreWrites) State = State with { Priority = priority }; }
    public void SetAffinity(long mask) { if (!IgnoreWrites) State = State with { Affinity = mask }; }
    public void Dispose() { }
}

sealed class FakeLibrarySecurity : ISecurityService
{
    public bool Elevated = true;
    public bool IsElevated() => Elevated;
    public bool ValidateWhitelistedAction(string id) => true;
    public bool IsCriticalProcess(string name) => false;
    public bool IsCriticalService(string name) => false;
    public IReadOnlySet<string> AllowedActions => new HashSet<string>();
}
sealed class FakeLibraryBackend : ILibraryBackend
{
    public string Scheme = Guid.NewGuid().ToString();
    public bool IgnoreWrites;
    private readonly Dictionary<string,LibraryValue> values = new();
    public LibraryValue Read(LibraryDefinition d, string? context = null)
    {
        var key = d.Id + (d.Kind == "Power" ? context ?? Scheme : "");
        return values.GetValueOrDefault(key) ?? new(true, d.Kind, d.Kind == "Service" ? "1" : d.Kind == "RegistryString" ? "original text" : "17", d.Kind == "Power" ? context ?? Scheme : null);
    }
    public void Write(LibraryDefinition d, LibraryValue value) { if (!IgnoreWrites) values[d.Id + (d.Kind == "Power" ? value.Context : "")] = value; }
}
sealed class FakeOptionalApplications : IOptionalApplications
{
    public int Closed;
    public OptionalProcess[] Scan() => [new(42, 123456, "chrome", @"C:\Apps\chrome.exe", 200)];
    public Task<ClosedApplication> CloseAsync(OptionalProcess p, bool force) { Closed++; return Task.FromResult(new ClosedApplication(p.Pid,p.Name,"closed",true)); }
}
sealed class FakeWorkflowOperations : IOptimizationService
{
    public bool FailRecovery;
    public LibraryOptimizationService? Library;
    public MemoryBackups? Store;
    public Func<string,Task>? OnRestore;
    public List<string> Applied = [];
    public Task<OperationResult> ApplyOperationAsync(string id) { Applied.Add(id); if (Library is not null && OptimizationLibrary.Definitions.ContainsKey(id)) return Library.ExecuteAsync(id,false); return Task.FromResult(new OperationResult(true,id,"apply",DateTime.UtcNow,0,[],null,null,null,false)); }
    public async Task<OperationResult> RestoreOperationAsync(string id) {
        if (OnRestore is not null) await OnRestore(id);
        if (Library is not null && OptimizationLibrary.Definitions.ContainsKey(id)) return await Library.ExecuteAsync(id,true);
        return new(true,id,"restore",DateTime.UtcNow,0,[],null,null,null,true);
    }
    public Task<OperationResult> RestoreVerifiedAsync() => FailRecovery ? Task.FromResult(new OperationResult(false,"all","restore",DateTime.UtcNow,0,["Fixture readback failure"],null,null,"Readback failure",false)) : RestoreOperationAsync("all");
    public Task<IReadOnlyList<OperationCatalogItem>> GetCatalogAsync() => Task.FromResult<IReadOnlyList<OperationCatalogItem>>([]);
    public Task<IReadOnlyList<OperationHistoryItem>> GetHistoryAsync() => Task.FromResult<IReadOnlyList<OperationHistoryItem>>([]);
    public Task<OperationStatusResponse> GetOperationStatusAsync(string id) => Task.FromResult(new OperationStatusResponse(id,true,true,Store?.HasBackup(LibraryOptimizationService.BackupKey(id)) ?? false,null,new Cs2ProcessState(true,123,"Normal",10,100,DateTime.UtcNow,"test"),null));
    public Task<RealtimeTelemetryData> GetRealtimeTelemetryAsync() => throw new NotSupportedException();
}
sealed class FakeOptionalPackages : IOptionalPackages
{
    private List<PackageState> states = [new("Microsoft.BingNews","news_1",@"C:\Program Files\WindowsApps\news_1",false,false),new("Microsoft.WindowsStore","store_1",@"C:\Program Files\WindowsApps\store_1",false,false)];
    public Task<PackageState[]> ListAsync() => Task.FromResult(states.ToArray());
    public Task RemoveAsync(PackageState p) { states.Remove(p); return Task.CompletedTask; }
    public Task RestoreAsync(PackageState p) { states.Add(p); return Task.CompletedTask; }
}

sealed class NativeCleanupFixture
{
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential, CharSet=System.Runtime.InteropServices.CharSet.Unicode)]
    private struct ShellOperation
    {
        public IntPtr Window; public uint Function;
        [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPWStr)] public string From;
        public IntPtr To; public ushort Flags;
        [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)] public bool Aborted;
        public IntPtr Mappings, Title;
    }
    [System.Runtime.InteropServices.DllImport("shell32.dll", CharSet=System.Runtime.InteropServices.CharSet.Unicode, ExactSpelling=true)]
    private static extern int SHFileOperationW(ref ShellOperation operation);
    [System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet=System.Runtime.InteropServices.CharSet.Unicode, SetLastError=true)]
    [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
    private static extern bool CreateHardLinkW(string path, string target, IntPtr attributes);
    public static void HardLink(string path, string target)
    {
        if (!CreateHardLinkW(path, target, IntPtr.Zero)) throw new IOException("Hardlink fixture creation failed.");
    }
    public static void Recycle(string path)
    {
        var operation = new ShellOperation { Function = 3, From = path + "\0\0", Flags = 0x0454 };
        var code = SHFileOperationW(ref operation);
        if (code != 0 || operation.Aborted) throw new IOException("Windows Shell recycle fixture failed: " + code);
    }
}
