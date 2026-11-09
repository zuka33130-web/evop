# Consolidación funcional de EVO Optimizer

## Política de producto

La interfaz principal solo expone diagnóstico, catálogo nativo, auditor local, capturas/A-B, limpieza recuperable, recuperación e historial. Se retiraron de la navegación los generadores de scripts agresivos, las calculadoras de FPS teóricos, modos de nombres comerciales y las vistas con datos simulados. El código heredado se conserva en el repositorio para revisión, pero no se importa desde la app principal ni se ofrece como sustituto de operaciones bloqueadas.

No se convierten guías BIOS ni funciones sin soporte en escrituras de registro artificiales. Tampoco se afirma que todos los tweaks históricos sean útiles. Los módulos pendientes se enumeran con motivo en un detalle informativo, sin botones ficticios.

## Navegación y estado

Ocho destinos reales: panel, auditor, operaciones, estabilidad, limpieza, diagnóstico, historial y fuentes. Se corrige el acceso Consola que antes apuntaba a un tab sin contenido. El panel muestra únicamente hardware detectado, no un perfil ASUS prefijado ni promesas 30→110 FPS. El lanzamiento de Steam está separado de cambios de prioridad/afinidad.

Se eliminó de la UI la descarga del paquete de scripts heredado; no se modifican manualmente scripts ya descargados por el usuario. Los exports actuales son informes JSON y recibos de recuperación.

La conexión se comprueba cada 15s; al perderla se bloquean las operaciones y se descarta el catálogo obsoleto. Los cambios no se reintentan automáticamente. Un lock síncrono en el puente evita envíos duplicados antes de que React actualice el estado.

## Catálogo y recuperación

- Acciones implementadas con búsqueda y separación de lectura/escritura.
- Comprobación de permisos visible; botones de sistema bloqueados para motor estándar.
- Consulta de existencia de backups antes de habilitar restauración, con actualización explícita.
- Descripciones de alcance corregidas: cambiar un valor no garantiza FPS; los presets no certifican soporte del driver.
- El endpoint de telemetría del catálogo ahora tiene un ejecutor real de lectura (antes estaba marcado implementado sin ruta de ejecución en apply).
- Restauración conjunta únicamente de respaldos **verificados** canónicos, continuando tras fallos para informar cada paso. No interpreta snapshots heredados ni anuncia restauración universal de todo Windows. El plan de energía se restaura al final.
- Respaldo CS2 de sesión terminada: se puede archivar solo si el motor verifica que el PID/hora de inicio originales ya no existen. No toca otra instancia; se mantiene archivo histórico antes de retirar el backup activo.
- El borrado fallido de un archivo de respaldo deja de silenciarse.
- Si un módulo de experimento ya fue restaurado desde otro panel y no tiene backup, el experimento puede cerrarse sin fingir haber restaurado valores.

## Límites vigentes

No hay elevación UAC selectiva; la UI no tiene facultades administrativas por defecto. Los ajustes HKLM requieren un motor con permisos apropiados. No se implementan todos los tweaks históricos, ni IA generativa, sensores GPU o pruebas a través de reinicios. No se garantizan ganancias. Los informes de sesión/historial siguen en memoria; exportarlos antes de reiniciar el motor. La validación visual de WebView2 y ETW con un juego real sigue siendo manual.

## Pruebas

Playwright prueba la navegación de todos los destinos, permisos/botones de restauración, error de verificación y limpieza sin selección automática. Usa API simulada y **no modifica Windows**. CI ejecuta Chromium en Ubuntu y mantiene compilación/tests nativos más smoke del paquete publicado en Windows. Los tests nativos añaden la recuperación segura de snapshots de juego expirados.
