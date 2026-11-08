# Motor nativo: operaciones verificadas

El motor existente se amplía con operaciones atómicas de registro. No se ejecutan scripts arbitrarios enviados por el navegador.

## Ejecutar en Windows

Requiere Windows y SDK .NET 8. Desde PowerShell elevado en la raíz del repositorio:

```powershell
dotnet run --project src-native/EvoNativeEngine
```

La interfaz local (`npm run dev`) conecta a `http://127.0.0.1:48120`. Para publicar, usar `scripts/Publish-Windows.ps1`. El PS1 de limpieza se copia al publicar.

## Operaciones con snapshot real y verificación de lectura

- `tweak.gpu.mpo_fix`: OverlayTestMode=5.
- `tweak.gpu.hags`: HwSchMode=2.
- `tweak.gpu.tdr_delay`: TdrDelay=10.
- `tweak.cpu.powerthrottling_off`: PowerThrottlingOff=1.
- `tweak.cpu.win32priority`: Win32PrioritySeparation=38.
- `cortex.mode.torneo`: EnableTransparency=0 en HKCU.

Las operaciones HKLM exigen elevación. El snapshot conserva la existencia y el DWORD original, incluso tras aplicaciones repetidas. Restaurar elimina el valor si originalmente no existía. Solo borra el respaldo después de verificar el resultado. Las operaciones se serializan dentro del proceso. No ejecutar varias instancias del motor sobre los mismos respaldos.

Aplicar: `POST /api/operations/{id}/apply`. Revertir: `POST /api/operations/{id}/restore`. Inspeccionar `success` y `errorMessage` en JSON; HTTP 200 no basta. Algunos cambios requieren reinicio y soporte del controlador: escribir el registro no prueba una mejora de FPS ni la activación efectiva de HAGS.

## Cambios de seguridad funcional

- La restauración genérica y la global incompletas ahora fallan explícitamente y conservan respaldos.
- El lanzador de comandos captura stderr, comprueba el código de salida y termina procesos que exceden 30 segundos.
- Limpieza no inventa MB si falta el script o no hay respuesta JSON válida.
- El puente web ya no anuncia ejecución PowerShell simulada.

## Alcance y limitaciones

Esto no reimplementa ni certifica todos los presets heredados: varios ejecutores antiguos aún requieren snapshots reales y revisión del manejo de errores. No migrar automáticamente backups creados por ejecutores antiguos; usar un entorno de prueba limpio. Los seis IDs anteriores constituyen el nuevo camino verificable. La API sigue siendo local sin autenticación; el IPC Tauri arbitrario sigue pendiente de endurecimiento.

Validación local: `npm run lint` pasa. No hay SDK .NET ni Windows en el entorno de desarrollo utilizado; el workflow Native Windows build compila/publica en Windows, pero no sustituye las pruebas de aplicación/restauración en una VM con snapshot externo. No se ejecutaron cambios en el sistema del usuario.

## Segunda etapa: energía mediante Win32

- `cortex.mode.nucleo` ahora solo selecciona el plan Alto Rendimiento existente con `PowerSetActiveScheme`; lee y respalda el GUID original mediante `PowerGetActiveScheme`. Si el plan no existe/no está disponible, falla sin inventarlo. Restaurar vuelve al GUID real original.
- `tweak.cpu.idledisable` usa `PowerReadACValueIndex` y `PowerWriteACValueIndex` sobre el GUID de plan respaldado. No cambia el valor DC/batería. Si cambia el plan activo entre aplicaciones, exige restaurar antes de aplicar a otro. Restaurar un plan inactivo no lo activa.
- Estos ajustes pueden aumentar temperatura/consumo. No garantizan FPS ni frecuencia fija.
- Los nuevos snapshots de energía y registro usan claves `verified.v1.*` y validación de versión/operación; no interpretan snapshots heredados como originales verificados. Los snapshots históricos se conservan aparte.
- La escritura de backups usa archivo temporal y reemplazo en el mismo directorio para evitar JSON parcialmente escrito.
- Catálogo/estado solo anuncian restauración para los caminos de registro, energía y prioridad CS2 con restauración dedicada. Esto no certifica los ejecutores antiguos de aplicación.

El workflow ejecuta también `src-native/EvoNativeEngine.Tests`, un arnés sin paquetes de test que utiliza un adaptador de energía falso. Cubre aplicar/reaplicar/restaurar, respaldo ausente, cambio de plan, fallo de lectura posterior y conservación del backup, reintento y error de API. Estas pruebas no tocan registro ni energía del runner. La integración real sigue requiriendo Windows de prueba.

## Tercera etapa: memoria, servicios y presets

- `tweak.memory.pagecombining_off` / `cortex.mode.stutter`: leen `Get-MMAgent.PageCombining`, ejecutan Enable/Disable-MMAgent con scripts fijos y vuelven a leer. El respaldo real se comparte entre alias. No se purga memoria ni se modifica SysMain.
- `tweak.services.gaming_toggle`, `cortex.mode.services` y `cortex.mode.debloat`: solo DiagTrack y MapsBroker. Se guarda qué servicios existen y si estaban activos. Restaurar no arranca servicios originalmente detenidos. No cambia el tipo de inicio ni fuerza la detención de dependientes. Ante fallo parcial se conserva el respaldo y se informa error.
- Los presets GPU, EXTREME_v2, INICIAR_TODO y AUTO_PRE_GAME pasan por los ejecutores verificados individuales. Aplicar se detiene al primer fallo; restaurar recorre los módulos con respaldo en orden inverso. El resultado incluye los pasos y advierte cambios parciales. No hay rollback transaccional automático. La restauración de un preset usa los backups de sus módulos, que pueden haberse aplicado individualmente: no representa una sesión aislada.
- Se bloquean explícitamente los ejecutores heredados de timers, VBS, red, pagefile, disco, exclusiones Defender, pausa Update y restauración global hasta tener una implementación con alcance y reversión correctos. El catálogo los marca no implementados. No se rebaja la seguridad como parte de una suite de rendimiento.
- El proceso mantiene un archivo de bloqueo exclusivo por usuario para evitar dos instancias que compitan por los mismos respaldos.
- El botón de inicio de CS2 ahora espera confirmación del proceso antes de aplicar prioridad/afinidad. Una solicitud a Steam pendiente no se presenta como optimización verificada.

Las pruebas de memoria/servicios usan un adaptador falso, incluyendo alias, aplicación repetida, servicios originalmente detenidos, fallo parcial y recuperación. No certifican el acceso a servicios ni MMAgent en hardware real. Probar en una VM Windows antes de uso habitual.
