# Limpieza inteligente y auditor local

## Alcance real, no promesas de equivalencia

La nueva pantalla Limpieza inteligente sustituye la antigua UI con tamaños precargados. No es una réplica de todas las funciones de CCleaner: no se implementan borrado seguro del espacio libre, limpieza general COM/DLL/instaladores, gestión universal de cookies/historial, todas las apps/navegadores ni desinstalación de software. Limpiar registro o cachés no es una garantía de rendimiento.

Los endpoints heredados de ejecución sin selección dejan de ejecutar el PS1 de borrado amplio. Sus modos Clean devuelven error explicativo; el modo Scan solo ofrece un resumen de vista previa. Los antiguos IDs de limpieza de un clic se marcan bloqueados en catálogo.

## Limpieza nativa

1. Escaneo de solo lectura (vista previa válida 15 minutos).
2. Selección explícita (ninguna categoría preseleccionada, máximo 500 elementos).
3. Revalidación y cuarentena con manifiesto persistido **antes de cada movimiento/eliminación de registro**.
4. Restauración por ID sin sobrescribir archivos/valores ocupados. El manifiesto conserva las incidencias que no se pudieron resolver.
5. Purga irreversible de archivos en cuarentena solo al escribir `ELIMINAR DEFINITIVAMENTE`. Las copias del registro se conservan para restauración posterior.

Cuarentena: `%LocalAppData%\EvoOptimizer\Quarantine\{id}`. Manifiestos: `%LocalAppData%\EvoOptimizer\Backups\state_cleanup_{id}_latest.json`. Exportar el recibo con ID; la restauración sigue disponible tras reiniciar. Mover a cuarentena no libera espacio; la purga informa bytes lógicos realmente borrados, no una medida garantizada de espacio físico libre.

Solo se proponen archivos de más de siete días y hasta 64 MB cada uno, dentro de:

- `%LocalAppData%\Temp`
- CrashDumps de usuario
- WER ReportArchive de usuario
- D3DSCache, opcional y con advertencia de recompilación/stutter
- Cache del perfil Default de Chrome y Edge, únicamente si el proceso de navegador no está abierto

No se incluyen cookies, contraseñas, historial, Prefetch, WinSxS, SoftwareDistribution ni Windows Update. No se fuerzan cierres ni se suspenden servicios. No se eliminan directorios completos. Escaneo acotado: 15 segundos, 30000 archivos visitados, 3000 candidatos, profundidad 10. No es una búsqueda exhaustiva.

Protecciones: rutas predefinidas (no se aceptan rutas arbitrarias del cliente), IDs pertenecientes a la vista previa, comprobación de tamaño/fecha, rechazo de reparse points en ancestros, manifiestos de recuperación, no sobrescritura y saltos ante archivos bloqueados. El movimiento puede fallar si las ubicaciones están en volúmenes diferentes; no se sustituye por borrado directo. Esto no es una frontera de seguridad frente a malware del mismo usuario ni una transacción de sistema de archivos: hay carreras posibles y los errores se comunican. Revisar antes de purgar.

### Registro

Se examinan únicamente valores String/ExpandString de **HKCU\Software\Microsoft\Windows\CurrentVersion\Run** con un ejecutable absoluto local en disco fijo que no exista. Parser conservador: exe entre comillas o ruta sin espacios. Se descartan rutas relativas, recursos de red, variables no resueltas y accesos denegados. Un destino ausente es solo candidato, no prueba de que el valor sea inútil (puede corresponder a una instalación temporalmente incompleta).

Se exige selección y respaldo del valor/tipo antes de quitarlo, se relee antes de eliminar y se verifica la eliminación. Restaurar comprueba tipo/valor sin sobrescribir entradas distintas. No se tocan RunOnce, servicios, clases COM, DLLs compartidas ni claves de instalador; tampoco se atribuye ahorro de MB a retirar strings del registro.

## Auditor y recomendaciones

**EVO Local Advisor** es un motor de reglas explicables, **no una IA generativa ni modelo entrenado**. No hay proveedor LLM ni envío a la nube en esta entrega. Un modelo generativo opcional requeriría configuración explícita, consentimiento para datos sensibles y revisión de cada propuesta; no debe poder ejecutar comandos arbitrarios.

Audita:

- Hardware/OS/RAM/GPU/controladores y unidades mediante el diagnóstico nativo.
- Software de claves Uninstall HKLM/HKCU, vistas de registro 32/64 bits (inventario parcial, máximo 500 apps).
- Nombres Run (sin exportar comandos de inicio en el inventario).
- Los 15 procesos con mayor working set en una muestra puntual (no carga sostenida ni diagnóstico de CPU).

Recomendaciones basadas en evidencia: presión RAM, poco espacio, exceso de entradas de inicio, CS2 activo para prueba de prioridad sin tocar afinidad, múltiples GPU, referencia de frametimes y revisión manual de drivers. No declara drivers obsoletos sin consultar una fuente de versiones, ni recomienda un preset agresivo solo por el nombre de CPU. Cada propuesta explica evidencia, acción, riesgo y necesidad de A/B. Solo enlaza operaciones implementadas en catálogo. Aplicación con confirmación; no aplicación autónoma.

Los reportes pueden contener nombres de software, host, archivos y rutas personales. Todo se procesa localmente, sin telemetría remota. Exportar JSON solo después de revisar privacidad.

## API

- POST `/api/cleanup/preview`
- POST `/api/cleanup/quarantine` `{planId,itemIds}`
- POST `/api/cleanup/restore/{id}`
- POST `/api/cleanup/purge/{id}` `{confirmation}`
- GET `/api/advisor/audit`

Se hereda autenticación por sesión del paquete WebView2. En modo desarrollo sin token se conservan las advertencias de seguridad del motor.

## Pruebas

El arnés .NET incluye límites de rutas y fixtures de limpieza en Windows: solo archivos creados por la prueba en un directorio aislado, cuarentena/restauración del contenido, rechazo de archivos cambiados y confirmación/purga. Pruebas de reglas con hardware sintético para RAM, espacio y prioridad CS2 como hipótesis A/B. No se ejecuta la limpieza de perfiles reales ni se valida una mejora de FPS por limpiar.
