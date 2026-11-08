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
