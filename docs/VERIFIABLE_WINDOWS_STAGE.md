# Consolidación verificable de Windows — 08/11/2026

Una sola aplicación: React/TypeScript → puente autenticado del motor .NET 8 → Windows; empaquetado WebView2 existente. No se añadió Tauri, una segunda API ni ejecución de scripts arbitrarios.

## 1. Ejecución y resultados

- Se eliminaron los ejecutores heredados no usados que guardaban originales supuestos, ignoraban errores o devolvían éxito fijo. Solo despachan los motores con validación de permisos, respaldo original, comprobación posterior y conservación ante fallo.
- Los módulos no implementados siguen bloqueados: no se activan por sustituirlos por un refresco de hardware.
- Una solicitud a Steam no certifica que el juego arrancó; el resultado distingue detección y solicitud pendiente. Lectura de registro/power/service no demuestra ganancias de FPS ni que el driver respete una política.
- Las solicitudes POST del API se serializan por flujo completo. Se mantienen los locks internos y el bloqueo de una segunda instancia del motor; la UI bloquea cambios/mediciones incompatibles, incluso al navegar durante recuperación.

## 2. Backups y recuperación

- Escrituras de estado a archivo temporal, flush a disco y reemplazo atómico antes del cambio. Se conserva el primer original, no un valor de fábrica.
- Restauración individual existente: módulo, plantilla propietaria, cuarentena y recibo Appx.
- Nuevo `POST /api/recovery/all`, cuerpo `{ "confirmation": "RESTAURAR TODO" }`: intenta módulos verificados (incluye cambios de plantillas), cuarentenas pendientes y aplicaciones recuperables. Continúa las otras categorías cuando una falla y devuelve pasos explícitos; `success/restored=false` si hay pasos o inventarios fallidos.
- El inventario global no trunca a los últimos 100 recibos. Un manifiesto ilegible no se convierte silenciosamente en inventario vacío.
- No recupera procesos cerrados, archivos purgados ni datos Appx eliminados. El registro Appx depende del payload conservado. No reemplaza un backup de disco ni crea un punto de restauración Windows.

## 3. Telemetría verificable

- Retirado el grafo frontend no importado: laboratorios sintéticos, calculadora de ganancias teóricas, puente alternativo con fallback simulado y generadores de BAT heredados. No están disponibles como implementación alternativa.
- Se conserva el laboratorio de capturas reales PresentMon/ETW: duración explícita, fuente/hash, FPS medios/1% low/P99 e historial A/B. Nunca se rellena una captura ausente con muestras inventadas.
- CPU: delta GetSystemTimes; RAM: GlobalMemoryStatusEx. WMI clock es reportado, no frecuencia efectiva; ACPI es zona térmica, no CPU package. GPU/thermal-throttling sin sensor siguen no disponibles, no cero estimado.

## 4. EvoClean

- Un solo motor: SmartCleanupService, preview/selección/cuarentena/restauración/purga. El wrapper EvoClean antiguo solo permite escanear; aplicar sin selección devuelve HTTP 400. Retirado el PS1 de borrado amplio del código y del paquete.
- SHA-256 y tamaño del original guardados antes de mover. La restauración compara la copia y el original recuperado. Archivos alterados o destinos ocupados conservan manifiesto y no se anuncian restaurados; la purga tampoco borra una copia cuya integridad falla.
- Recibos anteriores sin hash requieren inspección manual: no se inventa una identidad original ni se purgan automáticamente. Conservar archivos y JSON.
- `GET /api/cleanup/receipts` carga el inventario persistido desde la UI, sin exigir recordar IDs. Resultado indica acción, pendientes, errores y bytes lógicos realmente eliminados en esa purga (persistidos). Cuarentena **no** equivale a espacio liberado; bytes eliminados **no** equivalen a espacio físico medido.
- Continúan límites conservadores: temporales/cachés admitidos de más de 7 días, no enlaces, no sobrescritura, no cookies/contraseñas/WinSxS/Windows Update, HKCU Run solo revisión explícita. No es una limpieza universal de registro.

## 5. Validación reproducible

- `npm run lint`, `npm run build`, `npm run test:e2e`: 13 pruebas de interfaz con API de prueba, incluyendo confirmación global, resultado parcial, bloqueo al navegar y recibos persistidos. No prueban Windows real por sí mismas.
- Pruebas nativas: motores falsos para denegaciones/lecturas fallidas/reintento, fixtures Windows aislados de archivos y HKCU, corrupción SHA-256, destino ocupado, inventario persistido de 105 recibos, confirmación global y continuidad tras fallo.
- CI `native-windows.yml`: motor/tests Windows, frontend y paquete desktop con smoke test de autenticación/CSP, resolución de recuperación, rechazo de confirmación inválida y bloqueo del endpoint de limpieza sin selección. El smoke test no aplica optimizaciones del usuario.
- Sin sesión de juego real ni prueba en todos los drivers/OEM: no se afirma ganancia de rendimiento ni compatibilidad universal.
