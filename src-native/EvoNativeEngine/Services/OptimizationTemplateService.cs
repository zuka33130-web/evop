using EvoNativeEngine.Models;
namespace EvoNativeEngine.Services;

public sealed record OptimizationTemplate(string Id, string Name, string Description, string Risk, string[] Operations);
public sealed record TemplateRequest(string[] SelectedIds, string Confirmation);
public sealed record TemplateReceipt(Guid Id, string TemplateId, DateTime CreatedUtc, List<string> Attempted,
    List<OperationResult> Results, bool Finished, bool Restored = false);
public sealed record TemplatePreviewItem(LibraryDefinition Definition, bool Available, string? Reason, bool HasBackup, LibraryValue? Current);
public sealed record TemplatePreview(OptimizationTemplate Template, List<TemplatePreviewItem> Items, string Note);
public sealed record TemplateSwitchState(string TemplateId, bool Checked, string State, int AtTarget, int Total,
    Guid[] ReceiptIds, string Message);
public sealed record TemplateToggleRequest(bool Enabled, string Confirmation, string[]? SelectedIds = null);
public sealed record TemplateToggleResult(bool Success, TemplateSwitchState Status, List<TemplateReceipt> Receipts, string Message);
public sealed class OptimizationTemplateService(IOptimizationService operations, IBackupManager backups, ISecurityService security, ILibraryBackend? statusBackend = null)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    public static readonly OptimizationTemplate[] Templates = [
        new("gaming", "Gaming · base limpia", "Game Mode y Game DVR sin grabación de fondo. No cierra aplicaciones.", "Pierdes grabación de Windows; no toca OBS ni anticheat.", ["library.gaming.game_mode","library.gaming.background_recording","library.gaming.capture","library.gaming.controller_bar"]),
        new("focus", "Gaming · concentración", "Reduce avisos, Widgets y apps Windows de fondo compatibles.", "Puede ocultar avisos importantes y detener tareas de apps Store. No cierra Win32.", ["library.focus.notifications","library.focus.lock_notifications","library.focus.setup_nudges","library.background.widgets","library.background.store_apps"]),
        new("performance", "Rendimiento AC · prueba avanzada", "Prueba parámetros energéticos del plan activo, sin desactivar protección térmica.", "Más calor, consumo y posible pérdida de FPS por throttling. No aplicar a ciegas ni en batería.", ["library.power.maximum","library.power.epp","library.power.boost","library.power.frequency","library.power.parking_max","library.power.pcie"]),
        new("maximum", "Máximo rendimiento AC · experimental", "Añade mínimo CPU y core parking al 100% a una sesión alimentada por corriente.", "Mayor consumo y temperatura. Puede empeorar estabilidad. Selección avanzada, no recomendación automática.", ["library.power.maximum","library.power.minimum","library.power.epp","library.power.boost","library.power.parking_min","library.power.parking_max","library.power.pcie","library.power.usb"]),
        new("privacy", "Privacidad · diagnóstico mínimo compatible", "Diagnóstico requerido, sin personalización publicitaria ni aprendizaje implícito.", "No elimina toda telemetría; puede limitar personalización. Políticas pueden ser ignoradas en Home o gestionadas por organización.", ["library.privacy.required_diagnostics","library.privacy.device_name","library.privacy.feedback","library.privacy.advertising","library.privacy.tailored","library.privacy.ink","library.privacy.typing"]),
        new("background", "Debloat reversible · segundo plano", "Reduce precarga de navegadores e instalaciones sugeridas sin desinstalar paquetes.", "Notificaciones/extensiones de navegadores cerrados pueden dejar de funcionar; no elimina aplicaciones.", ["library.browser.edge_background","library.browser.edge_startup","library.browser.chrome_background","library.browser.edge_sleep","library.browser.edge_sleep_delay","library.background.suggested_installs"]),
        new("desktop", "Escritorio ligero", "Reduce animaciones y redibujado del escritorio.", "Cambia apariencia y legibilidad; no equivale a ganar FPS en el juego. Puede necesitar nueva sesión.", ["library.visual.menu_delay","library.visual.drag_outline","library.visual.window_animation","library.visual.taskbar_animation","library.visual.icon_shadow","library.visual.desktop_preview"]),
        new("network", "Sesión de red y periféricos", "Sin P2P de actualizaciones y pruebas de políticas Wi-Fi/USB AC.", "No mejora el ping de Internet por sí mismo; mayor consumo y políticas sujetas al hardware.", ["library.network.delivery_peers","library.power.wifi","library.power.usb"]),
        new("disk_diagnosis", "Disco ocupado · diagnóstico temporal", "Prueba pausa de búsqueda y SysMain; evita apagado del disco en AC.", "Puede empeorar búsqueda y apertura de apps. No desactiva inicio de servicios ni Windows Update.", ["library.service.search","library.service.sysmain","library.power.disk"])
    ];
    public async Task<TemplatePreview> PreviewAsync(string id)
    {
        var template = Templates.SingleOrDefault(t => t.Id == id) ?? throw new ArgumentException("Plantilla desconocida.");
        var rows = new List<TemplatePreviewItem>(); var backend = statusBackend ?? new WindowsLibraryBackend();
        foreach (var operationId in template.Operations)
        {
            var d = OptimizationLibrary.Definitions[operationId];
            bool available = true; string? reason = null; LibraryValue? current = null;
            var hasBackup = (await operations.GetOperationStatusAsync(operationId)).HasBackup;
            try {
                if (d.Admin && !security.IsElevated()) throw new UnauthorizedAccessException("Necesita administrador.");
                if (hasBackup) throw new InvalidOperationException("Ya tiene respaldo: restaura antes de incluirlo en otra plantilla.");
                current = backend.Read(d);
                if (current.Exists && current.Kind == d.Kind && current.Value == d.Target)
                    throw new InvalidOperationException("Ya tiene el valor objetivo. No se necesita una escritura ni se atribuye una mejora.");
            } catch (Exception ex) { available = false; reason = ex.Message; }
            rows.Add(new(d, available, reason, hasBackup, current));
        }
        return new(template, rows, "Vista previa orientativa, revalidada al aplicar. No todos los valores leídos tienen efecto en esta versión/hardware.");
    }
    public async Task<TemplateReceipt> ApplyAsync(string id, TemplateRequest request)
    {
        if (request.Confirmation != "APLICAR PLANTILLA") throw new ArgumentException("Confirmación explícita requerida.");
        var template = Templates.SingleOrDefault(t => t.Id == id) ?? throw new ArgumentException("Plantilla desconocida.");
        var selected = request.SelectedIds ?? [];
        if (selected.Length == 0 || selected.Length != selected.Distinct().Count() || selected.Any(x => !template.Operations.Contains(x)))
            throw new ArgumentException("Selecciona únicamente acciones de esta plantilla, sin duplicados.");
        await gate.WaitAsync();
        try
        {
            var receipt = new TemplateReceipt(Guid.NewGuid(), id, DateTime.UtcNow, [], [], false);
            await backups.SaveStateAsync("template." + receipt.Id.ToString("N"), receipt);
            foreach (var action in template.Operations.Where(selected.Contains))
            {
                if ((await operations.GetOperationStatusAsync(action)).HasBackup)
                {
                    receipt.Results.Add(new(false, action, "apply", DateTime.UtcNow, 0, ["Respaldo previo: acción omitida para no apropiarse de otra sesión."], null, null, "Restaura primero el módulo previo.", false));
                    break;
                }
                // Durable intent before mutation: a crash never loses the list needed for recovery.
                receipt.Attempted.Add(action);
                await backups.SaveStateAsync("template." + receipt.Id.ToString("N"), receipt);
                OperationResult result;
                LibraryOptimizationService.ReceiptOwner.Value = receipt.Id.ToString("N");
                try { result = await operations.ApplyOperationAsync(action); }
                finally { LibraryOptimizationService.ReceiptOwner.Value = null; }
                receipt.Results.Add(result);
                await backups.SaveStateAsync("template." + receipt.Id.ToString("N"), receipt);
                if (!result.Success) break;
            }
            receipt = receipt with { Finished = true };
            await backups.SaveStateAsync("template." + receipt.Id.ToString("N"), receipt);
            return receipt;
        }
        finally { gate.Release(); }
    }
    public async Task<TemplateReceipt> RestoreAsync(Guid id)
    {
        await gate.WaitAsync();
        try
        {
            var key = "template." + id.ToString("N");
            var receipt = await backups.GetLastStateAsync<TemplateReceipt>(key) ?? throw new ArgumentException("Recibo desconocido.");
            var definition = Templates.SingleOrDefault(t => t.Id == receipt.TemplateId);
            if (receipt.Id != id || definition is null || receipt.Attempted.Any(a => !definition.Operations.Contains(a))) throw new IOException("Recibo no válido.");
            var results = new List<OperationResult>();
            foreach (var action in receipt.Attempted.AsEnumerable().Reverse())
                if ((await operations.GetOperationStatusAsync(action)).HasBackup)
                {
                    var snapshot = await backups.GetLastStateAsync<LibraryOptimizationService.Snapshot>(LibraryOptimizationService.BackupKey(action));
                    if (snapshot?.OwnerId != receipt.Id.ToString("N"))
                        results.Add(new(false, action, "restore", DateTime.UtcNow, 0, ["Respaldo de otra sesión: no se toca."], null, null, "No se acredita propiedad del respaldo.", false));
                    else
                    {
                        LibraryOptimizationService.ReceiptOwner.Value = receipt.Id.ToString("N");
                        try { results.Add(await operations.RestoreOperationAsync(action)); }
                        finally { LibraryOptimizationService.ReceiptOwner.Value = null; }
                    }
                }
                else results.Add(new(true, action, "restore", DateTime.UtcNow, 0, ["Sin respaldo pendiente: no se modificó Windows ni se certifica una restauración externa."], null, null, null, false));
            // Preserve original application audit, append restoration; never erase failed recovery information.
            receipt = receipt with { Results = receipt.Results.Concat(results).ToList(), Restored = results.All(r => r.Success) };
            await backups.SaveStateAsync(key, receipt);
            return receipt;
        }
        finally { gate.Release(); }
    }
    public async Task<TemplateSwitchState[]> SwitchStatesAsync()
    {
        // Read ownership + current values under the same lock as native mutations. Never infer ON from localStorage.
        await LibraryOptimizationService.Gate.WaitAsync();
        try
        {
            var backend = statusBackend ?? new WindowsLibraryBackend();
            var states = new List<TemplateSwitchState>();
            foreach (var template in Templates)
            {
                var owners = new HashSet<Guid>(); int targets = 0, foreign = 0, errors = 0;
                foreach (var id in template.Operations)
                {
                    var d = OptimizationLibrary.Definitions[id];
                    var key = LibraryOptimizationService.BackupKey(id);
                    var snapshot = backups.HasBackup(key) ? await backups.GetLastStateAsync<LibraryOptimizationService.Snapshot>(key) : null;
                    bool owned = false;
                    if (snapshot?.Version == 1 && snapshot.Id == id && Guid.TryParseExact(snapshot.OwnerId, "N", out var owner))
                    {
                        var receipt = await backups.GetLastStateAsync<TemplateReceipt>("template." + owner.ToString("N"));
                        if (receipt?.Id == owner && receipt.TemplateId == template.Id && receipt.Attempted?.Contains(id) == true)
                        { owners.Add(owner); owned = true; }
                    }
                    if (backups.HasBackup(key) && !owned) foreign++;
                    try
                    {
                        var current = backend.Read(d);
                        bool activePlan = d.Kind != "Power" || !owned || current.Context == snapshot!.Original.Context;
                        if (current.Exists && current.Kind == d.Kind && current.Value == d.Target && activePlan) targets++;
                    }
                    catch { errors++; }
                }
                var enabled = owners.Count > 0;
                var state = enabled ? targets == template.Operations.Length && errors == 0 ? "active" : "partial"
                    : errors > 0 ? "unknown" : targets == template.Operations.Length ? "configured" : foreign > 0 ? "conflict" : "inactive";
                var message = state switch {
                    "active" => "Activa: valores leídos y respaldos de esta plantilla. Desactivar restaura sus originales.",
                    "partial" => "Parcial o modificada externamente: hay cambios respaldados. Desactiva para recuperarlos; no se certifica toda la plantilla.",
                    "configured" => "Windows ya coincide con todos los destinos, sin cambios propios pendientes. No se inventan valores para desactivarlos.",
                    "conflict" => "Hay respaldos de otros módulos o plantillas; no se deshacen desde este interruptor.",
                    "unknown" => "No se pudieron leer todos los estados. Revisa disponibilidad y permisos; no se asume activación.",
                    _ => "Desactivada: sin cambios propios pendientes. Activar aplicará solo los módulos compatibles confirmados." };
                if (enabled && template.Operations.Any(id => OptimizationLibrary.Definitions[id].Restart)) message += " Puede requerir nueva sesión/reinicio; no se certifica aquí su efecto tras reiniciar.";
                states.Add(new(template.Id, enabled, state, targets, template.Operations.Length, owners.ToArray(), message));
            }
            return states.ToArray();
        }
        finally { LibraryOptimizationService.Gate.Release(); }
    }
    public async Task<TemplateToggleResult> ToggleAsync(string id, TemplateToggleRequest request)
    {
        if (!Templates.Any(t => t.Id == id)) throw new ArgumentException("Plantilla desconocida.");
        if (request.Confirmation != (request.Enabled ? "ACTIVAR PLANTILLA" : "DESACTIVAR PLANTILLA")) throw new ArgumentException("Confirmación explícita requerida.");
        var before = (await SwitchStatesAsync()).Single(s => s.TemplateId == id);
        var receipts = new List<TemplateReceipt>();
        if (request.Enabled)
        {
            if (before.Checked) return new(true, before, receipts, "Ya hay cambios propios pendientes; no se duplicó la activación.");
            var preview = await PreviewAsync(id);
            var selected = request.SelectedIds ?? [];
            if (selected.Length == 0 || selected.Any(action => !preview.Items.Any(i => i.Definition.Id == action && i.Available)))
                throw new ArgumentException("Los cambios seleccionados ya no están disponibles. Actualiza la revisión antes de activar.");
            receipts.Add(await ApplyAsync(id, new(selected, "APLICAR PLANTILLA")));
        }
        else
            foreach (var owner in before.ReceiptIds) receipts.Add(await RestoreAsync(owner));
        var after = (await SwitchStatesAsync()).Single(s => s.TemplateId == id);
        bool success = request.Enabled ? receipts.All(r => r.Finished && r.Results.All(result => result.Success))
            : receipts.All(r => r.Restored) && !after.Checked;
        return new(success, after, receipts, success ? request.Enabled ? "Cambios aplicados y estado consultado en Windows." : "Respaldos propios restaurados; estado consultado en Windows."
            : "Resultado parcial: revisa los pasos. El interruptor conserva el estado pendiente para recuperación.");
    }
    public Task<TemplateReceipt[]> ReceiptsAsync() => WorkflowReceipts.ReadAsync<TemplateReceipt>(backups, "template", r => r.Id);
}
