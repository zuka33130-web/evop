# Auditoría UX/UI y motor de medición — 8 de noviembre de 2026

## Hallazgos y cambios

| Hallazgo | Cambio realizado |
|---|---|
| Navegación plana y demasiada información al mismo nivel | Tres grupos: Workspace, Tu equipo, Registro y ayuda. Estado activo y conexión visibles. |
| Panel sin jerarquía visual ni siguiente acción clara | Sistema visual grafito/lima, tarjetas de hardware real, acceso destacado al laboratorio y flujo de cuatro pasos. |
| Medición fija de 60 s | Selector de 30, 60, 90 o 120 s; duración validada nuevamente por el motor. |
| Resultados de captura se perdían al navegar | Laboratorio permanece montado. Se recupera además la lista de capturas del motor con GET /api/benchmarks/runs. Auditoría y limpieza también conservan su estado al navegar. |
| Antes/después requería entender primero un experimento avanzado | Fases manuales A/B, selectores de capturas, diferencias de promedio, 1% low y P99 dentro de la misma vista. El experimento estadístico se conserva como opción avanzada. |
| No había curva temporal de la medición | Grupos de intervalos reales: promedio ponderado por tiempo, sin interpolar ni fabricar FPS. Máximo aproximado de 240 grupos para CSV largos. |
| Herramienta/proceso no disponibles se descubrían tarde | Preparación visible: Windows, PresentMon configurado e instancias detectadas. La comprobación no promete permisos ETW hasta capturar. |
| Filtro solo por nombre de proceso podía capturar otra instancia reiniciada | PresentMon se inicia con el PID identificado. El resultado incluye el PID y la duración solicitada. |
| Descripciones breves insuficientes | Cada acción ofrece alcance, cuándo considerarla, riesgos, verificación y reversión. Guías específicas para los módulos atómicos y sus alias; presets explican límites de aplicación parcial. |
| Cambios durante una captura podían confundir resultados | Acciones de la app bloqueadas durante solicitudes del laboratorio; aviso de medición al navegar. No se puede bloquear software externo: la comparación sigue siendo descriptiva. |
| Metadatos HTML conservaban marca/equipo/promesas antiguas | Título y descripción actualizados a EVO y mediciones reales. |
| URL absoluta al motor fallaba en puertos alternativos y previews | Peticiones relativas /api: mismo origen en escritorio y proxy Vite en desarrollo. No se relajan las comprobaciones de Host/token del motor. |
| Portapapeles anunciaba éxito sin confirmar | Se espera la promesa y se informa fallo. |
| UI sin prueba de tamaño móvil | Chromium verifica navegación móvil y ausencia de desbordamiento del panel a 390 px. Capturas de escritorio y móvil para revisión. |

## Fórmulas y precisión

- FPS promedio = `1000 × número de intervalos / suma de intervalos en ms`. No se promedian recíprocos instantáneos.
- 1% low = 1000 / media del 1% de intervalos más lentos, cantidad redondeada hacia arriba.
- P99 = rango más próximo de los intervalos ordenados, en milisegundos.
- Se excluyen aproximadamente los primeros cinco segundos por acumulación de intervalos completos. Se muestra el tiempo **real útil**, no se divide por el tiempo solicitado ni por un temporizador de JavaScript.
- Los tirones largos válidos no se eliminan. Se cuentan filas inválidas. Se rechazan mezclas de PID/swapchain y CSV con más de 24 horas acumuladas (probable unidad incorrecta).
- La curva agrupa intervalos completos según su tiempo de inicio. Un intervalo largo puede cruzar un borde; no se reparte inventando muestras.
- MsBetweenPresents mide cadencia de presentaciones de la aplicación. CPUFrameTime es otra señal; ninguna garantiza coincidir con frames físicamente visibles del monitor ni mide input lag.
- No hay promesa de exactitud absoluta: se calculan métricas deterministas de la señal de PresentMon. Permisos ETW, API, drivers, foco, escena, energía, temperatura y tareas externas pueden afectar la captura.

## Flujo manual pedido

1. Iniciar el motor en Windows con PresentMon CLI 2.x oficial configurado.
2. Abrir un único proceso de juego. En Laboratorio elegir proceso, escena, resolución/cap declarados y duración.
3. Elegir fase A y capturar; volver al juego durante la captura.
4. Aplicar un cambio desde Operaciones o manualmente. Para un cambio externo, anotarlo en la etiqueta. No modificar escena, API, cap ni resolución si se busca aislar ese cambio.
5. Regresar a Laboratorio, elegir fase B y capturar bajo las mismas condiciones.
6. Seleccionar A/B: se presentan ambos valores y su diferencia porcentual. Mismo ID, mismo CSV o contexto incompatible bloquean la diferencia.
7. Exportar el JSON y repetir al menos tres veces por fase. El flujo estadístico avanzado exige cinco capturas por fase, 30 s útiles y 1000 intervalos por captura para emitir señal.

Una captura de 30 s deja ~25 s útiles y por tanto **no cumple** el mínimo estadístico de 30 s útiles; sigue siendo útil para una comprobación exploratoria. Se recomienda 60 s o más.

## Configurar PresentMon

Obtener la CLI oficial desde https://github.com/GameTechDev/PresentMon/releases y revisar su licencia. Antes de abrir el motor/escritorio, definir `EVO_PRESENTMON_PATH` con la ruta absoluta del ejecutable CLI 2.x, no de una GUI. Ejemplo PowerShell para el motor publicado:

```powershell
$env:EVO_PRESENTMON_PATH = 'C:\Tools\PresentMon\PresentMon.exe'
.\EvoNativeEngine.exe
```

No se descarga ni ejecuta un binario indicado remotamente por la web. Si ETW requiere permisos, el motor informa el fallo sin producir un resultado ficticio. La app no implementa elevación selectiva UAC.

## Alcance de validación

Tests deterministas nativos de fórmula FPS y grupos temporales, además de los existentes de operaciones/backup/limpieza/evidencia. Seis pruebas de navegador: rutas, permisos/error, limpieza, captura A/B con duración y persistencia de vista, definiciones/filtros, diseño responsive. La API de captura se simula en E2E: no confundir estos tests con una medición real de un juego.

Pendientes de comprobación manual: sesión interactiva Windows/WebView2, binario PresentMon específico, ETW/driver/API y comparación repetida en juegos reales. Historial y capturas del motor se conservan solo durante esa sesión; exportar antes de reiniciarlo. No se añadió persistencia de FPS entre reinicios ni un overlay de FPS en vivo.
