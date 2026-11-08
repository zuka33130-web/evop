# Auditoría funcional y técnica de EVOOPTIMIZER

Fecha: 2026-11-08. Revisión de código y comprobaciones de frontend en Linux. No se ejecutaron optimizaciones, limpiezas ni scripts de Windows.

## Resumen

La app es un optimizador orientado a Windows/CS2 y al ASUS PN64. Combina un generador web de configuraciones y scripts con un servicio local C# capaz de modificar el sistema. Incluye además implementaciones de escritorio Tauri y WPF separadas. No debe considerarse lista para aplicar ajustes agresivos con reversión garantizada: existen restauraciones vacías, respaldos prefijados y respuestas de éxito que no acreditan ejecución.

## Cómo funciona

1. `src/main.tsx` monta React; `src/App.tsx` mantiene navegación y perfil de hardware en estado React. No hay router ni backend web desplegado en los scripts npm.
2. La interfaz ofrece dashboard, plantillas, tweaks, consola Cortex, laboratorios, calculadora FPS, autoexec, guía BIOS, exportación, diagnóstico y limpieza.
3. `src/data/optimizerData.ts` centraliza perfil y datos de optimización. El perfil inicial es teórico; no equivale a detectar el PC.
4. `src/utils/zipGenerator.ts` y las plantillas de scripts generan ZIP, BAT, PS1, REG y CFG. Descargar un archivo no lo ejecuta ni acredita que un ajuste se aplicó.
5. `src/services/nativeBridge.ts` consulta `http://127.0.0.1:48120`, comprueba conexión y expone diagnóstico, catálogo, aplicar/restaurar, historial, telemetría y limpieza.
6. `src-native/EvoNativeEngine/Program.cs` sirve esa API mediante ASP.NET Core/.NET 8, solo en loopback. `DiagnosticsService` consulta hardware mediante WMI/Win32; `OptimizationService` usa procesos, registro, powercfg, bcdedit, netsh y PowerShell.
7. `EvoCleanService` localiza y ejecuta `Invoke-EvoClean.ps1`. Tiene una ruta alternativa con resultados inventados si no encuentra el script.
8. `src-tauri` añade un comando IPC para ejecutar PowerShell recibido desde React; `src-native/EvoWpfApp` es otra interfaz con su propio `OptimizationEngine`. No constituyen un único motor con garantías homogéneas.

### Datos y persistencia

- Estado de interfaz/perfil: principalmente memoria de React.
- Plantillas activas: `localStorage.evo_active_templates`; checklist BIOS: `localStorage.ryzer_bios_checklist`. Son estado de UI, no una auditoría autoritativa del estado de Windows.
- Backups: JSON en `%LocalAppData%\\EvoOptimizer\\Backups`, administrados por `BackupManager`.
- Historial del motor: `ConcurrentBag` en memoria; consulta devuelve hasta 60 entradas. Se pierde al reiniciar y la colección interna no tiene límite.
- No se identificó un flujo de cuentas, base de datos remota o servicio de nube en el recorrido revisado. La dependencia de Gemini declarada no prueba una integración activa.

## Hallazgos priorizados

### Crítico: restauración genérica sin restaurar

`OptimizationService.cs:1142–1150`: `ExecuteGenericRestoreFromBackupAsync` lee el JSON, elimina el backup y devuelve `Restored=true`, sin aplicar sus valores al sistema. Puede mostrar una reversión exitosa y destruir la copia disponible sin revertir nada.

### Alto: backups prefijados y restauración global parcial

`OptimizationService.cs:764–856`: ejemplos de snapshots con transparencia=1, plan Balanced, valores GPU y timers prefijados, sin leer el estado anterior real. La restauración Torneo escribe 1 directamente. `ExecuteGlobalRestoreAsync` (988–1011) solo revierte una parte de los ajustes y comunica restauración global; no acredita recuperar el estado original completo. `BackupManager.SaveStateAsync` sobrescribe el archivo latest en cada aplicación.

### Alto: éxito sin comprobar ejecución

`OptimizationService.cs:1203–1230`: `RunProcessSync` no comprueba `ExitCode`, no consume stderr, ignora el resultado de `WaitForExit(3000)` y captura fallos como avisos. El timeout no termina el proceso y la lectura posterior puede bloquear. Varios ejecutores devuelven éxito después de fallos de registro/comandos.

`src/services/tauriBridge.ts`: el fallback web de `invokePowerShell` no ejecuta el script solicitado: aplica un refresco de hardware. Ante un error de red devuelve `success:true` con texto WEB-SIMULADO.

### Alto: limpieza ficticia ante script ausente

`EvoCleanService.cs:85–98`: si no encuentra el PS1, devuelve status success, 8590.5 MB escaneados y, para Clean, 8590.5 MB liberados. No son bytes medidos ni eliminados. Esta ruta debe fallar explícitamente o identificarse como demo en la respuesta y en UI.

### Alto: permisos y superficie de ejecución

El motor C# tiene lista blanca y enlace loopback, pero no autentica al cliente. CORS permite orígenes locales; CORS no es autenticación ni impide llamadas de otros procesos locales. Los metadatos `RequiresElevation` no se hacen cumplir de forma general en `ApplyOperationAsync`. Algunos ajustes HKLM están etiquetados sin elevación.

El comando Tauri acepta PowerShell arbitrario, permite solicitar UAC y la configuración tiene CSP nula. Esto contradice la garantía documental general de «cero comandos arbitrarios». Una eventual inyección de código en el frontend tendría un impacto especialmente alto. Requiere lista blanca de operaciones, CSP y revisión del manejo de elevación/resultados.

### Alto: cifras de rendimiento no demostradas

`PresentMonLab.tsx:64–120`: sesiones precargadas con métricas fijas y muestras generadas con `Math.random`; no son una captura ejecutada al abrir la pantalla. Existe importación JSON, pero los valores iniciales no acreditan una mejora real. `ScientificLab` también genera datasets de ejemplo. Las promesas del dashboard de pasar de 30–45 a 75–110 FPS no quedan verificadas por estos datos.

### Medio: granularidad engañosa de tweaks

El switch de `ApplyOperationAsync` agrupa varios IDs en un mismo ejecutor: por ejemplo MPO, HAGS y TDR ejecutan el bloque GPU completo; Nagle/autotuning ejecutan el mismo bloque de red. Nombre, alcance, resultado y clave del backup pueden no coincidir. Aplicar un tweak individual puede modificar más de lo anunciado y no encontrar luego su backup por ID.

### Medio: topología y lanzamiento de CS2

Se fija máscara 15 y se asume que los primeros cuatro procesadores lógicos son P-Cores. La conversión del diagnóstico a perfil usa núcleos físicos como pCores, aunque no distingue P/E. No es una detección general de topología híbrida. En `App.tsx`, el lanzamiento aplica Bestia antes de arrancar CS2 y no comprueba el éxito de esa primera operación; no debe asegurar afinidad verificada solo por iniciar el juego.

### Medio: entorno web y documentación

La URL loopback del frontend apunta al equipo donde corre el navegador, no al servidor de una vista remota. Además, CORS del motor no admite el origen HTTPS de Arena; una preview no equivale a integración nativa funcional. El diseño tiene sentido para ejecución local, pero necesita explicar esa limitación.

`docs/WINDOWS_NATIVE_ARCHITECTURE.md` describe una primera etapa de solo lectura y un Navbar que ya no está en el árbol; está desactualizada respecto del motor que modifica Windows. Hay varias marcas y versiones (EVOOPTIMIZER, RYZER, V7, 1.1).

## Comprobaciones realizadas

- `npm install --ignore-scripts --package-lock=false`: falla ERESOLVE por esbuild ^0.25 frente al peer opcional requerido por Vite resuelto (8.3.6: ^0.27 o ^0.28).
- Instalación de diagnóstico con `npm install --legacy-peer-deps --package-lock=false`: completa; npm informó 0 vulnerabilidades conocidas en esa resolución. No equivale a una auditoría de seguridad completa.
- `npm run lint`: falla TS2307 por importación de `./components/Navbar` en `src/App.tsx:22`, archivo inexistente. El script llamado lint solo ejecuta TypeScript, no un linter de reglas.
- `npm run build`: termina con error de resolución de `react-is` desde Recharts tras la instalación con legacy-peer-deps; también advierte un bundle grande (~1.27 MB JS antes de gzip). Se imprimen artefactos antes del error, lo que no equivale a build exitoso.
- No hay script de tests en package.json. No se ejecutaron pruebas de navegador.
- No están disponibles dotnet ni bun en este entorno. No se validó compilación nativa, empaquetado Tauri/WPF ni comportamiento real en Windows.

## Orden recomendado

1. Bloquear restauraciones falsas y resultados simulados presentados como éxito.
2. Implementar snapshots reales por operación y rollback verificable sin borrar backups ante fallos.
3. Propagar errores, validar privilegios y comprobar postcondiciones de cada cambio.
4. Unificar catálogo/IDs/alcance y endurecer API local e IPC Tauri.
5. Reparar instalación reproducible, import faltante y peers; añadir CI y tests.
6. Etiquetar demos/estimaciones y exigir mediciones antes/después para afirmar mejoras.
7. Validar en Windows de prueba con recuperación externa antes de distribuir modos agresivos.

No se modificó código funcional durante esta auditoría.
