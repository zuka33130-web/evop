import { test, expect } from '@playwright/test';
const catalog = [
  { id: 'cortex.mode.torneo', name: 'Transparencias de usuario', description: 'Cambio real con respaldo.', category: 'Usuario', requiresElevation: false, canRestore: true, isImplemented: true },
  { id: 'tweak.cpu.idledisable', name: 'Reposo CPU AC', description: 'Requiere permisos.', category: 'CPU', requiresElevation: true, canRestore: true, isImplemented: true },
  { id: 'cortex.mode.timers', name: 'Timers heredados', description: 'No disponible.', category: 'Sistema', requiresElevation: true, canRestore: false, isImplemented: false, availabilityReason: 'Sin verificación.' }
];
const diagnostic = {
  processor: { name: 'CPU real de prueba', physicalCores: 4, logicalProcessors: 8, maxClockSpeedMhz: 3000, manufacturer: 'Test', architecture: 'x64', socket: 'test' },
  memory: { totalGb: 16, availableGb: 8, usedGb: 8, usedPercentage: 50 },
  operatingSystem: { name: 'Windows de prueba', version: '11', buildNumber: 'test', architecture: 'x64', uptimeHours: 2, windowsEdition: 'Test' },
  graphicsCards: [], storageDrives: [], executionTimeMs: 2, queriedAtUtc: new Date().toISOString(), hostName: 'test', isWindowsPlatform: true, isElevated: false
};
test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:48120/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === '/api/status') data = { isReady: true, isElevated: false, version: 'test', engineName: 'Test engine', supportedEndpoints: [], operatingSystem: 'Windows', architecture: 'x64', uptimeSeconds: 1 };
    else if (path.startsWith('/api/diagnostics')) data = diagnostic;
    else if (path === '/api/operations') data = catalog;
    else if (path === '/api/operations/history') data = [];
    else if (path.endsWith('/status')) data = { hasBackup: false, isImplemented: true, canRestore: true };
    else if (path.endsWith('/apply')) data = { success: false, operationId: 'cortex.mode.torneo', logs: ['Sin permiso de prueba.'], errorMessage: 'Falló la verificación', previousState: null, currentState: null };
    else if (path.endsWith('/active')) data = null;
    else if (path === '/api/cleanup/preview') data = { id: 'test-plan', items: [], warnings: ['No hay candidatos.'] };
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/');
  await expect(page.getByText('CPU real de prueba')).toBeVisible();
});
test('all navigation destinations render without legacy simulations', async ({ page }) => {
  const destinations = [
    ['Auditor local', 'Auditor local de hardware y software'], ['Operaciones Windows', 'Operaciones nativas verificables'],
    ['Estabilidad y 1% Low', 'Motor de estabilidad'], ['Limpieza inteligente', 'Limpieza inteligente y recuperable'],
    ['Diagnóstico', 'Diagnóstico'], ['Historial', 'Historial del motor'], ['Fuentes y herramientas', 'Fuentes técnicas y decisiones de ingeniería'],
    ['Panel de control', 'Panel de control']
  ];
  for (const [label, heading] of destinations) {
    await page.getByRole('navigation').getByRole('button', { name: new RegExp(label.replace('%', '%')) }).click();
    await expect(page.getByRole('heading', { name: new RegExp(heading) }).first()).toBeVisible();
  }
  await expect(page.getByText('75-110 FPS')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descargar Scripts .ZIP' })).toHaveCount(0);
});
test('permissions, missing backups and failed verification are explicit', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Operaciones Windows/ }).click();
  const user = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Transparencias de usuario' }) });
  const admin = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Reposo CPU AC' }) });
  await expect(user.getByRole('button', { name: 'Aplicar', exact: true })).toBeEnabled();
  await expect(admin.getByRole('button', { name: 'Aplicar', exact: true })).toBeDisabled();
  await expect(user.getByRole('button', { name: 'Restaurar respaldo', exact: true })).toBeDisabled();
  page.on('dialog', dialog => dialog.accept());
  await user.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByText('Falló la verificación', { exact: true })).toBeVisible();
  await expect(page.getByText('Falló / incompleto', { exact: false })).toBeVisible();
});
test('cleanup scans only after request and selects nothing automatically', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Limpieza inteligente/ }).click();
  await page.getByRole('button', { name: 'Escanear sin modificar' }).click();
  await expect(page.getByText('0 candidatos · 0 seleccionados', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Poner selección en cuarentena' })).toBeDisabled();
});
