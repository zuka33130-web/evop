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
const libraryFixture = { id:'library.gaming.game_mode', name:'Game Mode nativo', category:'Gaming', purpose:'Solicita modo Juego.', risk:'No garantiza más FPS.', kind:'RegistryDword', hive:'HKCU', path:'Software\\Microsoft\\GameBar', valueName:'AutoGameModeEnabled', target:'1', admin:false, restart:false, applicability:'Windows compatible.' };
const templateFixture = { id:'gaming', name:'Gaming · base limpia', description:'Ajuste nativo revisable.', risk:'No garantiza FPS.', operations:[libraryFixture.id] };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === '/api/status') data = { isReady: true, isElevated: false, version: 'test', engineName: 'Test engine', supportedEndpoints: [], operatingSystem: 'Windows', architecture: 'x64', uptimeSeconds: 1 };
    else if (path.startsWith('/api/diagnostics')) data = diagnostic;
    else if (path === '/api/operations') data = catalog;
    else if (path === '/api/operations/history') data = [];
    else if (path === '/api/library') data = [libraryFixture];
    else if (path === '/api/templates') data = [templateFixture];
    else if (path === '/api/templates/receipts') data = [];
    else if (path === '/api/templates/states') data = [{templateId:'gaming',checked:false,state:'inactive',atTarget:0,total:1,receiptIds:[],message:'Sin cambios propios pendientes.'}];
    else if (path === '/api/templates/gaming/preview') data = { template:templateFixture, note:'Revisar antes de aplicar.', items:[{ definition:libraryFixture, available:true, hasBackup:false, current:{exists:false} }] };
    else if (path === '/api/beast/preview') data = { id:'beast-plan', expiresUtc:new Date(Date.now()+120000).toISOString(), candidates:[{pid:42,name:'chrome',path:'C:/Apps/chrome.exe',workingSetMb:200}], protected:['Steam y anticheat'], warning:'Nada se cierra por defecto.' };
    else if (path === '/api/debloat/preview') data = { plan:{id:'debloat-plan',candidates:[{name:'Microsoft.BingNews',packageFullName:'Microsoft.BingNews_test'}]}, definitions:[{name:'Microsoft.BingNews',label:'Microsoft News',loss:'Puede perder datos locales.'}], warning:'Solo usuario actual. Reinstalación no garantizada.' };
    else if (path.endsWith('/status')) data = { hasBackup: false, isImplemented: true, canRestore: true };
    else if (path.endsWith('/apply')) data = { success: false, operationId: 'cortex.mode.torneo', logs: ['Sin permiso de prueba.'], errorMessage: 'Falló la verificación', previousState: null, currentState: null };
    else if (path.endsWith('/active')) data = null;
    else if (path === '/api/benchmarks/runs') data = [];
    else if (path === '/api/benchmarks/readiness') data = { windows: true, toolReady: true, gameInstances: 1, message: 'Listo para capturar.' };
    else if (path === '/api/cleanup/preview') data = { id: 'test-plan', items: [], warnings: ['No hay candidatos.'] };
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/');
  await expect(page.getByText('CPU real de prueba')).toBeVisible();
});
test('all navigation destinations render without legacy simulations', async ({ page }) => {
  const destinations = [
    ['Plantillas y Modo Bestia', 'Plantillas y Modo Bestia'], ['Auditor local', 'Auditor local de hardware y software'], ['Operaciones Windows', 'Operaciones nativas verificables'],
    ['Estabilidad y 1% Low', 'Laboratorio de FPS'], ['Limpieza inteligente', 'Limpieza inteligente y recuperable'],
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


test('manual before/after measurement keeps results across navigation and shows measured delta', async ({ page }) => {
  let captures = 0;
  await page.route('**/api/benchmarks/capture', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST,OPTIONS' } }); return;
    }
    const body = route.request().postDataJSON();
    expect(body.seconds).toBe(90);
    captures++;
    const fps = captures === 1 ? 100 : 110;
    await route.fulfill({ headers:{'Access-Control-Allow-Origin':'*'}, json:{ id:`run-${captures}`, ...body, sourceColumn:'MsBetweenPresents', provenance:'NativeCapture', metrics:{ averageFps:fps, onePercentLowFps:fps-20, p99Ms:12, frames:8500, seconds:85, budgetMissPercent:1, stutterPercent:0 }, timeline:[{second:0,frames:100,averageFps:fps},{second:1,frames:100,averageFps:fps-5}], warnings:[], systemSamples:[] } });
  });
  await page.getByRole('navigation').getByRole('button', { name:/Estabilidad y 1% Low/ }).click();
  await page.getByLabel('Duración de la captura').selectOption('90');
  await page.getByRole('button',{name:'Capturar fase A · 90 s'}).click();
  await expect(page.locator('.result-grid .metric-value').first()).toContainText('100.00');
  await page.getByRole('navigation').getByRole('button',{name:/Operaciones Windows/}).click();
  await expect(page.getByText('Conoce el alcance antes de aplicar.',{exact:false})).toBeVisible();
  await page.getByRole('navigation').getByRole('button',{name:/Estabilidad y 1% Low/}).click();
  await expect(page.locator('.result-grid .metric-value').first()).toContainText('100.00');
  await page.getByRole('button',{name:'B · Después',exact:true}).click();
  await page.getByRole('button',{name:'Capturar fase B · 90 s'}).click();
  await expect(page.getByText('+10.00%',{exact:true})).toBeVisible();
  await expect(page.getByText('100.00 → 110.00',{exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:/FPS medios por grupo/})).toBeVisible();
  await page.getByLabel('Captura de resultado B').selectOption('run-1');
  await expect(page.getByText('Selecciona dos capturas distintas.')).toBeVisible();
});

test('operation definitions and category filter explain each change', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button',{name:/Operaciones Windows/}).click();
  await page.getByLabel('Categoría de operación').selectOption('CPU');
  await expect(page.getByRole('heading',{name:'Reposo CPU AC',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transparencias de usuario',exact:true})).toHaveCount(0);
  await page.getByText('Definición, riesgos y cómo comprobarlo',{exact:true}).click();
  await expect(page.getByText('Más consumo en reposo, calor y posible throttling. No fija una frecuencia.',{exact:true})).toBeVisible();
});

test('desktop and mobile layout fit viewport with accessible navigation', async ({ page }, testInfo) => {
  await page.screenshot({ path:testInfo.outputPath('dashboard-desktop.png'), fullPage:true, animations:'disabled' });
  await page.getByRole('navigation').getByRole('button',{name:/Estabilidad y 1% Low/}).click();
  await page.screenshot({ path:testInfo.outputPath('laboratory-desktop.png'), fullPage:true, animations:'disabled' });
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Abrir navegación',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:/Panel de control/}).click();
  await expect(page.getByRole('heading',{name:'Panel de control',exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path:testInfo.outputPath('dashboard-mobile.png'), fullPage:true, animations:'disabled' });
});


test('templates require explicit selection and report real per-step outcomes', async ({ page }) => {
  let body: unknown;
  await page.route('**/api/templates/gaming/apply', async route => { body=route.request().postDataJSON(); await route.fulfill({json:{id:'template-receipt',templateId:'gaming',finished:true,results:[{success:true,operationId:libraryFixture.id,logs:['Valor leído y verificado.']}]}}); });
  await page.getByRole('navigation').getByRole('button',{name:'Plantillas y Modo Bestia',exact:true}).click();
  await page.getByRole('button',{name:'Revisar cambios',exact:true}).click();
  await expect(page.getByRole('button',{name:'Aplicar 0 cambios seleccionados'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/Game Mode nativo/}).check();
  page.on('dialog', dialog=>dialog.accept());
  await page.getByRole('button',{name:'Aplicar 1 cambios seleccionados'}).click();
  await expect(page.getByText('ID: template-receipt',{exact:false})).toBeVisible();
  expect(body).toEqual({selectedIds:[libraryFixture.id],confirmation:'APLICAR PLANTILLA'});
});

test('Beast mode closes nothing by default and needs typed confirmation', async ({ page }) => {
  let body: unknown;
  await page.route('**/api/beast/start', async route => { body=route.request().postDataJSON(); await route.fulfill({json:{id:'beast-receipt',finished:true,applications:[],operations:[{success:true,operationId:'gaming.cs2.launch',logs:['Lanzamiento solicitado.']}]}}); });
  await page.getByRole('navigation').getByRole('button',{name:'Plantillas y Modo Bestia',exact:true}).click();
  await page.getByRole('button',{name:'Modo Bestia · CS2',exact:true}).click();
  await page.getByRole('button',{name:'Analizar sesión antes de lanzar',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/chrome · PID 42/})).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Lanzar CS2 · 0 cierres elegidos'})).toBeDisabled();
  await page.getByLabel('Confirmación Modo Bestia').fill('INICIAR MODO BESTIA');
  await page.getByRole('button',{name:'Lanzar CS2 · 0 cierres elegidos'}).click();
  await expect(page.getByText('ID: beast-receipt',{exact:false})).toBeVisible();
  expect(body).toEqual({planId:'beast-plan',pids:[],forceSelected:false,applyGamingBase:false,highPriority:true,confirmation:'INICIAR MODO BESTIA'});
});

test('debloat defaults to no packages selected and warns about data loss', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button',{name:'Plantillas y Modo Bestia',exact:true}).click();
  await page.getByRole('button',{name:'Debloat de aplicaciones',exact:true}).click();
  await page.getByRole('button',{name:'Analizar aplicaciones opcionales',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/Microsoft News/})).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Desinstalar 0 aplicaciones elegidas'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/Microsoft News/}).check();
  await expect(page.getByRole('button',{name:'Desinstalar 1 aplicaciones elegidas'})).toBeDisabled();
  await page.getByLabel('Confirmación debloat').fill('DESINSTALAR APLICACIONES');
  await expect(page.getByRole('button',{name:'Desinstalar 1 aplicaciones elegidas'})).toBeEnabled();
  await expect(page.getByText('Puede perder datos locales.',{exact:true})).toBeVisible();
});


test('template slider applies native changes and restores them without optimistic fake state', async ({ page }) => {
  let checked=false;
  const requests:unknown[]=[];
  await page.route('**/api/templates/states',route=>route.fulfill({json:[{templateId:'gaming',checked,state:checked?'active':'inactive',atTarget:checked?1:0,total:1,receiptIds:checked?['owned-receipt']:[],message:checked?'Cambios respaldados.':'Originales restaurados.'}]}));
  await page.route('**/api/templates/gaming/toggle',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    // Keep request pending to prove the control does not optimistically claim success.
    await new Promise(resolve=>setTimeout(resolve,200));
    checked=body.enabled;
    await route.fulfill({json:{success:true,status:{templateId:'gaming',checked,state:checked?'active':'inactive'},receipts:[{id:'owned-receipt',finished:true,restored:!checked,results:[]}],message:'Verificado.'}});
  });
  await page.getByRole('navigation').getByRole('button',{name:'Plantillas y Modo Bestia',exact:true}).click();
  const slider=page.getByRole('switch',{name:'Activar o desactivar Gaming · base limpia',exact:true});
  await expect(slider).toBeEnabled();await expect(slider).not.toBeChecked();
  page.on('dialog',dialog=>dialog.accept());
  await slider.click();
  await expect(slider).toBeDisabled();await expect(slider).not.toBeChecked();
  await expect(slider).toBeChecked();await expect(slider).toBeEnabled();
  await slider.press('Space');
  await expect(slider).not.toBeChecked();await expect(slider).toBeEnabled();
  expect(requests).toEqual([
    {enabled:true,confirmation:'ACTIVAR PLANTILLA',selectedIds:[libraryFixture.id]},
    {enabled:false,confirmation:'DESACTIVAR PLANTILLA',selectedIds:[]}
  ]);
});

test('partial restore leaves template slider on for recovery',async ({page})=>{
  await page.route('**/api/templates/states',route=>route.fulfill({json:[{templateId:'gaming',checked:true,state:'partial',atTarget:0,total:1,receiptIds:['owned-receipt'],message:'Parcial: respaldo pendiente.'}]}));
  await page.route('**/api/templates/gaming/toggle',route=>route.fulfill({json:{success:false,status:{templateId:'gaming',checked:true,state:'partial'},receipts:[{id:'owned-receipt',restored:false,results:[{operationId:libraryFixture.id,success:false,errorMessage:'Sin permisos para restaurar.'}]}],message:'Restauración parcial: respaldo conservado.'}}));
  await page.getByRole('navigation').getByRole('button',{name:'Plantillas y Modo Bestia',exact:true}).click();
  const slider=page.getByRole('switch',{name:'Activar o desactivar Gaming · base limpia',exact:true});
  await expect(slider).toBeChecked();page.on('dialog',dialog=>dialog.accept());await slider.click();
  await expect(page.getByRole('alert')).toContainText('Restauración parcial');
  await expect(slider).toBeChecked();await expect(slider).toBeEnabled();
});
