# Evidencia por optimización: antes / después

## Flujo funcional

En **Estabilidad y 1% Low**:

1. Restaurar el módulo que se quiere probar si ya tiene respaldo.
2. Capturar la misma escena cinco veces con la misma resolución, calidad, cap, API y alimentación.
3. Seleccionar un único módulo elegible y pulsar **Fijar capturas A y aplicar cambio real**. La API registra IDs de base, operación/resultados/logs, revisión del motor, hardware/controladores y telemetría anterior/posterior. Tres capturas permiten abrir el experimento; cinco por fase son el mínimo para una señal.
4. Repetir cinco capturas sin modificar nada más.
5. Evaluar antes/después. Exportar evidencia en JSON antes de restaurar.
6. Restaurar el módulo; si falla, el experimento y respaldo siguen disponibles. Confirmar resultados con secuencia A/B/A/B y más repeticiones.

El experimento no se cierra automáticamente al evaluar: el cambio permanece activo hasta restaurarlo. Un fallo parcial de aplicación también conserva el contexto para recuperación. Los datos de sesión/experimento son en memoria; una recarga de interfaz recupera el experimento activo del motor, pero reiniciar el motor pierde ese contexto (no los backups). No hay persistencia automática de informes: exportar JSON.

## Qué mide y qué verifica

- Frametime de PresentMon, FPS medio, 1% low, P99 y presupuesto de frame.
- Series de telemetría de Windows aproximadamente cada segundo durante captura: CPU, RAM, reloj WMI y temperatura ACPI cuando existen. No se inventan GPU o limit-reason sensors. El muestreo añade overhead; mantenerlo igual en todas las fases. No se atribuye causalidad solo a variaciones de CPU/RAM.
- Proveniencia de captura: nativa o CSV importado, inicio de captura, revisión de operaciones y SHA-256 del CSV.
- Cambios aplicados desde el motor incrementan una revisión (también intentos fallidos y limpiezas). Un cambio adicional o durante captura invalida la atribución; el resultado pasa a inconcluso.
- No detecta cambios desde otras herramientas, actividad del usuario, deriva térmica ni variaciones del contenido del juego. Resolución/escena son metadata declarada, no telemetría certificada.
- El A/B automático solo permite módulos individuales reversibles que no requieren reinicio: prioridad CS2, afinidad explícita, transparencia, plan de energía, IDLEDISABLE, PageCombining y servicios opcionales. No prueba presets de muchos cambios ni HAGS/MPO a través de reinicios.

## Análisis

Métrica primaria: 1% low. Bootstrap percentil con semilla fija, 5000 remuestreos de **capturas completas** (no de frames autocorrelacionados), intervalo descriptivo del 95%, margen práctico del 3%.

- **Señal de mejora**: límite inferior de mejora del low >3%, sin regresión >3% del P99 ni del FPS medio según los intervalos.
- **Señal de regresión**: intervalo del low por debajo de −3%, P99 por encima de +3% o FPS medio por debajo de −3%.
- **Sin cambio relevante observado**: intervalos de low y P99 completamente dentro de ±3%.
- **Inconcluso**: pocas capturas, captura corta, proveniencia no verificable, cambios intermedios o incertidumbre restante.

Requiere al menos cinco capturas por fase, 30s útiles y 1000 frames cada una para emitir una señal. Los CSV importados solo permiten exploración: no prueban qué estado de Windows había cuando fueron grabados. No se permite reutilizar el mismo CSV como repetición. No se mezclan resolución, cap, escenario, proceso u origen de intervalo entre A y B.

No hay control térmico experimental, aleatorización automática ni corrección por comparaciones múltiples. No es una certificación causal ni una garantía de FPS. El ruido entre repeticiones y la selección de escenas pueden dominar el resultado.

## API

- `GET /api/benchmarks/experiments/active`
- `POST /api/benchmarks/experiments/start`: `{operationId,beforeIds}`
- `POST /api/benchmarks/experiments/evaluate`: `{id,afterIds}`
- `POST /api/benchmarks/experiments/restore`: `{id,afterIds:[]}`

Los IDs se resuelven en el servidor; el cliente no puede enviar métricas inventadas para la evaluación. Los snapshots de registro son de la configuración del sistema, no de rendimiento; ambas cosas se registran por separado.

## Investigación incorporada (08/11/2026)

Selección de documentación primaria consultada, no «toda la web». La aplicación incluye estas fuentes y accesos a páginas oficiales de Configuración mediante URIs fijas. Abrir Configuración no modifica valores automáticamente.

1. **PresentMon**: captura ETW, restricciones de instrumentación OpenGL/Vulkan y de métricas GPU bajo HAGS. Se mantiene el origen de señal fijo entre fases. [1](https://github.com/GameTechDev/PresentMon)
2. **Microsoft / Optimizations for windowed games**: blt→flip en juegos DX10/DX11 compatibles, con límites de compatibilidad y necesidad de reiniciar el juego. Se ofrece abrir Configuración de gráficos, no escrituras de registro no documentadas. [2](https://devblogs.microsoft.com/directx/updates-in-graphics-and-gaming/)
3. **Microsoft / HAGS**: soporte de hardware/controlador y validación experimental. No se promete una ganancia universal ni se incluye en experimentos sin reinicio. [3](https://devblogs.microsoft.com/directx/hardware-accelerated-gpu-scheduling/)
4. **Microsoft / WPR**: diagnósticos ETW del sistema para CPU, memoria, disco y energía; recomendación para investigar el cuello de botella. No se inicia WPR automáticamente, para no interferir con sesiones de trazado existentes. [4](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/introduction-to-wpr)
5. **Microsoft / BCDEdit**: useplatformclock/useplatformtick documentados para depuración. No se habilitan como tweaks genéricos de gaming. [5](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/bcdedit--set)

Pendiente: integración real de ETW/PresentMon con juegos, sensores GPU, disco/IO y validación entre reinicios. Las pruebas automatizadas cubren cálculos y lógica, no prueban ganancias en hardware real. No se desactiva seguridad ni se descargan scripts o ejecutables de fuentes de terceros como parte de esta investigación.
