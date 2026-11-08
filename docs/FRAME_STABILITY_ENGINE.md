# Motor de estabilidad y comparación de configuraciones

## Alcance

Calcula métricas deterministas de intervalos de frames reales y ordena configuraciones **ya probadas**. No existe un «1% low exacto» universal o un ajuste óptimo para todas las escenas; la exactitud se limita a los intervalos capturados y a la definición explícita. ETW no mide input lag, respuesta del monitor ni todas las causas de stutter.

La página **Estabilidad y 1% Low** y el antiguo acceso PresentMon abren el nuevo motor. No se generan curvas aleatorias ni se simula una captura. Se necesita el motor Windows local conectado.

## Capturar

1. Instalar PresentMon CLI 2.x oficial por cuenta del usuario. No se descarga ni se instala desde la app.
2. En PowerShell, antes de iniciar el motor:
   ```powershell
   $env:EVO_PRESENTMON_PATH = 'C:\Herramientas\PresentMon\PresentMon.exe'
   dotnet run --project src-native/EvoNativeEngine
   ```
3. Abrir exactamente una instancia del juego, fijar resolución, calidad y límite FPS **en el propio juego**. Declarar esos valores en el formulario.
4. Ejecutar la misma escena/recorrido durante la captura de 60 segundos. El lector omite los primeros 5 segundos. Si ETW requiere permisos administrativos, reiniciar el motor elevado. No modifica anti-cheat, no inyecta DLLs ni toca memoria del juego.
5. Repetir al menos tres veces por configuración. Mantener driver, API, mapa, temperatura, alimentación y procesos de fondo comparables. Alternar el orden de candidatos para reducir sesgo térmico.

La captura usa argumentos de CLI `--process_name`, `--output_file`, `--timed`, `--terminate_after_timed` y `--no_console_stats`. Si la versión instalada no admite estas opciones, falla explícitamente; no genera un resultado inventado. Solo hay una captura simultánea. Duración admitida API: 30–120 segundos. Los CSV de captura son temporales y se borran después; exportar el informe JSON para conservar métricas. Importar un CSV externo permite conservar el original por separado.

No se ejecutó PresentMon/ETW en este entorno de desarrollo; es necesaria una prueba de integración con el binario instalado y un juego real.

## CSV y API

- `POST /api/benchmarks/import`: BenchmarkInput (CSV, proceso, escenario, configuración, ancho, alto, cap, objetivo, warmupSeconds).
- `POST /api/benchmarks/capture`: CaptureRequest (misma metadata sin CSV; seconds).
- `POST /api/benchmarks/compare`: array de IDs de capturas del servidor.

Admite CSV con comillas y separador coma, columnas `Application`, `ProcessID` y `MsBetweenPresents` o `CPUFrameTime`. No mezcla ambas fuentes ni usa tiempos GPU como intervalos de frames. Si hay más de un PID/swapchain del juego, exige filtrar un único flujo antes de importar. El esquema es estricto: falla en CSV incompleto, sin señal o demasiado grande (24 MB/un millón de filas). Las filas de otros procesos no se incluyen; valores no finitos/no positivos se contabilizan como rechazados, y **no se eliminan tirones largos reales**.

Los IDs/métricas usados para comparar son propiedad del motor: no se aceptan estadísticas precalculadas enviadas por el cliente. Máximo 100 capturas en memoria; reiniciar el motor las descarta. No se cuenta el mismo CSV dos veces como repetición (SHA-256).

## Definiciones

- FPS medio: `1000 / media(intervalos_ms)`; no media de los FPS instantáneos.
- 1% low: `1000 / media(de los ceil(N*0.01) intervalos más lentos)`.
- 0.1% low: igual con `ceil(N*0.001)`.
- P50/P95/P99/P99.9: percentiles por rango más próximo `ceil(p*N)`.
- Fuera del presupuesto: intervalos mayores que `(1000/FPS_objetivo)*1.05`. La tolerancia del 5% evita clasificar como miss el redondeo de un limitador.
- Stutter: intervalos mayores que `max(2*mediana, 1.5*presupuesto)`; es una definición operativa, no un diagnóstico de la causa.

Se muestran advertencias por muestras cortas. Una configuración solo deja de ser provisional con al menos tres capturas de 30 segundos útiles y 1000 frames cada una. Para estabilidad se exigen P99 <= presupuesto*1.05, low >= objetivo*0.95 y <=1% de misses, usando medianas entre repeticiones. Entre candidatos que cumplen se prioriza resolución; si ninguno cumple, P99 menor. No son intervalos de confianza ni una prueba de significancia estadística. Repetir más capturas si las diferencias son pequeñas.

El CSV no acredita resolución, cap ni API reales: son metadata declarada por el usuario. No se cambia la resolución global de Windows para intentar modificar un juego que podría ignorarla. Cada juego necesita su propio adaptador de configuración validado; por ahora se aplica manualmente en el menú del juego.

## Cambios reales de Windows

La página **Operaciones Windows** consume el catálogo nativo y solicita confirmación antes de aplicar/restaurar. Operaciones pendientes están bloqueadas en UI y motor. BIOS, guías, análisis y exportación no son acciones de sistema y no deben fingir serlo. No todos los tweaks heredados están implementados; no se añaden cambios inseguros para convertir artificialmente cada botón en una escritura de registro.
