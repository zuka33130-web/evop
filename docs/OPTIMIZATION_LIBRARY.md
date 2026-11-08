# Biblioteca nativa, plantillas y Modo Bestia

## Qué se ha implementado

**58 acciones nuevas distintas**: 36 ajustes de usuario/políticas, 14 parámetros de energía AC y 8 pausas de servicios opcionales. No se cuentan alias ni presets como ajustes nuevos. Hay **9 plantillas revisables** y, por separado, desinstalación selectiva de **8 paquetes Appx** y un lanzador de sesión CS2.

No son 58 mejoras de FPS demostradas. Incluyen rendimiento experimental, privacidad, concentración y apariencia. La disponibilidad y el efecto dependen de edición, versión, controladores, políticas OEM/MDM y hardware. Las políticas leídas/escritas pueden no ser obedecidas por Windows Home, una app no compatible o un dispositivo gestionado.

## Ejecución y recuperación

- Definiciones fijas en `OptimizationLibrary.cs`; la API no acepta claves de registro, rutas de ejecutables, nombres de servicios, scripts ni paquetes arbitrarios.
- Registro: conserva existencia, tipo DWORD/String y valor exacto. No elimina claves ajenas; una clave vacía creada por el módulo puede permanecer tras restaurar su valor.
- Energía: usa PowerReadACValueIndex/PowerWriteACValueIndex con GUID del plan; no modifica batería. Al restaurar un plan inactivo, no lo activa. Cambiar de plan obliga a restaurar antes de reaplicar ese módulo.
- Servicios: solo estado Running/Stopped; no altera tipo de inicio y no fuerza servicios dependientes activos. Se excluyen Update, Defender, audio, red y anticheat. Las pausas Xbox son optativas y **no** forman parte de Bestia por defecto.
- Backup atómico **antes** de escribir, primer original preservado al reaplicar, readback después, error si no coincide y backup retenido al fallar. Si ya tenía el destino, no se crea un backup ni se atribuye beneficio.
- Plantillas: selección vacía por defecto. La vista previa identifica permisos, ausencias, ajustes ya establecidos y backups previos. Se revalida al ejecutar, se detiene al primer fallo y conserva recibo de intención/resultados.
- Cada snapshot creado por plantilla tiene su ID de propietario. La recuperación no toma un backup ajeno, incluso si otra solicitud se adelantó. El recibo se guarda antes de cada paso y se puede recuperar tras reiniciar el motor.
- No se bloquean modificaciones externas ni se promete transacción/rollback automático. No hacer varias modificaciones manuales sobre el mismo módulo antes de evaluarlo.

## Las nueve plantillas

| Plantilla | Objetivo | Límite principal |
|---|---|---|
| Gaming base | Game Mode y grabación de Windows | Pierde DVR; no afecta OBS ni anticheat |
| Concentración | Avisos, Widgets y fondo Store | Puede perder notificaciones/tareas |
| Rendimiento AC | EPP, boost, máximo y PCIe | Más calor; puede empeorar FPS |
| Máximo AC experimental | Mínimo CPU/parking altos y USB | No recomendado automáticamente; vigilar térmicas |
| Privacidad | Diagnóstico requerido y personalización | No es telemetría cero |
| Debloat reversible | Navegadores y sugerencias en fondo | No desinstala; puede perder notificaciones |
| Escritorio ligero | Animaciones y redibujado | Apariencia/respuesta, no FPS garantizados |
| Red/periféricos | Sin P2P, Wi-Fi y USB AC | No mejora Internet por sí solo |
| Diagnóstico de disco | Pausar búsqueda/SysMain | Puede empeorar búsquedas/carga de apps |

## Modo Bestia, sin destruir dependencias

1. Analiza candidatos y presenta PID, inicio, imagen y working set. Solo apps opcionales del mismo usuario y sesión, fuera de Windows y no críticas.
2. **Ningún proceso se selecciona por defecto**. Lista cerrada: Chrome, Edge, Firefox, Brave, Opera, Discord, Spotify, Teams y Epic Games Launcher. No hay filtro «matar todo salvo CS2».
3. Revalida PID/inicio/imagen/propietario/sesión/estado crítico justo antes de cerrar. Nunca cierra un árbol de procesos completo.
4. Cierre normal: espera tres segundos y no fuerza si no termina. Cierre forzado: exige opción y confirmación diferenciadas; puede perder trabajo y no es reversible.
5. Puede aplicar Gaming base si se solicita; conserva recibo separado. Si falla esa base, no continúa cerrando apps.
6. Lanza mediante Steam oficial. Si se elige prioridad High, espera a identificar CS2 y aplica el motor ligado a esa instancia. No usa Realtime, afinidad 0–3 ni supuestos P-Cores.
7. Mantiene Steam, steamwebhelper, CS2, anticheat, Windows, audio, red, seguridad, WebView2 y clientes de sincronización. No promete funcionar solo con el proceso del juego.

Cerrar una app no se puede deshacer con un snapshot. Los recibos registran lo solicitado y confirmado, no memoria supuestamente liberada. El working set puede contener páginas compartidas. Guardar antes de cerrar.

## Debloat de aplicaciones

Lista cerrada: News, Weather, Solitaire Collection, Get Help, Get Started, People, Office Hub y Clipchamp. Vista previa con caducidad y selección vacía; confirmación escrita **DESINSTALAR APLICACIONES**. Solo registro Appx del usuario actual, sin `-AllUsers`, sin paquetes provisionados y sin borrado de carpetas WindowsApps.

Revalida identidad, rechaza frameworks/no eliminables y verifica que el paquete deje de estar registrado. Store, App Installer, Gaming Services, WebView2, anticheat y frameworks no están permitidos. Instancias ambiguas con varias versiones del mismo nombre se excluyen.

Guarda inventario/recibo antes de desinstalar. Recuperación intenta Add-AppxPackage -Register **solo si** queda el manifiesto del paquete original en WindowsApps, sin enlaces y con identidad/ruta concordantes. Si falta, informa reinstalación manual desde Store. No garantiza recuperar datos personales ni instalación offline.

## Medición y recomendaciones

La auditoría local recomienda revisar Game DVR solo si lee su ajuste habilitado y revisar apps opcionales si observa un working set elevado; no confunde RAM con uso de CPU ni ejecuta nada automáticamente. La interfaz impide iniciar cambios/limpieza/plantillas durante una captura y viceversa.

Flujo recomendado: capturas A en la misma escena → un módulo → capturas B → comparar promedio, 1% low y P99 → restaurar si empeora. Un preset no permite atribuir la diferencia a un único ajuste. No se han obtenido ganancias reales de un juego en este entorno.

## Validación

- Fixture determinista de apply/reapply/restore para **cada una de las 58 acciones**, backup ausente, readback fallido, reintento, permisos y cambio de plan.
- Fixture aislado real HKCU en Windows: escritura/lectura DWORD, String y restauración de ausencia bajo clave temporal de pruebas, no ajustes reales del usuario.
- Pruebas de dependencias y no selección por defecto de Bestia; protección contra replay de su vista previa.
- Proveedor Appx simulado: exclusión de Store, eliminación y recuperación verificadas.
- Chromium: navegación, permisos, limpieza, A/B, móvil, revisión de plantilla, Bestia con confirmación escrita y debloat sin selección automática.
- Pendiente validación interactiva con CS2, apps, drivers, Windows/ediciones reales. No se ejecuta desinstalación de apps ni cierre forzado de aplicaciones reales en CI.

## Fuentes primarias consultadas

Las políticas y APIs tienen alcance limitado; no justifican promesas universales de rendimiento:

- Microsoft: diagnóstico requerido y límites por edición. [1](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-system)
- Microsoft: EPP/boost y relación rendimiento-consumo. [1](https://learn.microsoft.com/en-us/windows-server/administration/performance-tuning/hardware/power/power-performance-tuning)
- Microsoft: opciones del motor de estado de rendimiento. [3](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/static-configuration-options-for-the-performance-state-engine)
- Microsoft: Remove-AppxPackage y ámbito del usuario. [1](https://learn.microsoft.com/en-us/powershell/module/appx/remove-appxpackage?view=windowsserver2025-ps)
- Microsoft: re-registro depende de que existan los archivos. [2](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/modern-inbox-store-apps-troubleshooting-guidance)

## Inventario completo de nuevas acciones

| # | ID | Acción | Categoría |
|---|---|---|---|
| 1 | `library.gaming.game_mode` | Activar Game Mode | Gaming |
| 2 | `library.gaming.background_recording` | Desactivar grabación de fondo | Gaming |
| 3 | `library.gaming.capture` | Desactivar captura de Game DVR | Gaming |
| 4 | `library.gaming.controller_bar` | No abrir Game Bar con el mando | Gaming |
| 5 | `library.gaming.bar_tips` | Ocultar panel inicial de Game Bar | Gaming |
| 6 | `library.input.mouse_acceleration` | Ratón sin aceleración de Windows | Entrada |
| 7 | `library.visual.menu_delay` | Menús con espera de 100 ms | Interfaz |
| 8 | `library.visual.drag_outline` | Arrastrar ventanas con contorno | Interfaz |
| 9 | `library.visual.window_animation` | Reducir animación de ventanas | Interfaz |
| 10 | `library.visual.taskbar_animation` | Desactivar animaciones de barra | Interfaz |
| 11 | `library.visual.icon_shadow` | Quitar sombra de iconos | Interfaz |
| 12 | `library.visual.desktop_preview` | Desactivar vista previa del escritorio | Interfaz |
| 13 | `library.browser.edge_background` | Edge sin ejecución de fondo | Aplicaciones |
| 14 | `library.browser.edge_startup` | Desactivar Startup Boost de Edge | Aplicaciones |
| 15 | `library.browser.chrome_background` | Chrome sin ejecución de fondo | Aplicaciones |
| 16 | `library.browser.edge_sleep` | Activar pestañas durmientes en Edge | Aplicaciones |
| 17 | `library.browser.edge_sleep_delay` | Edge: dormir pestañas tras 15 min | Aplicaciones |
| 18 | `library.privacy.required_diagnostics` | Diagnóstico Windows: solo requerido | Privacidad |
| 19 | `library.privacy.device_name` | No incluir nombre en diagnóstico | Privacidad |
| 20 | `library.privacy.feedback` | Silenciar solicitudes de comentarios | Privacidad |
| 21 | `library.privacy.advertising` | Desactivar identificador publicitario | Privacidad |
| 22 | `library.privacy.tailored` | Desactivar experiencias personalizadas | Privacidad |
| 23 | `library.privacy.ink` | Restringir aprendizaje de escritura manual | Privacidad |
| 24 | `library.privacy.typing` | Restringir aprendizaje de texto | Privacidad |
| 25 | `library.background.store_apps` | Restringir fondo de apps de Windows | Segundo plano |
| 26 | `library.background.widgets` | Desactivar Widgets por política | Segundo plano |
| 27 | `library.search.web_suggestions` | Búsqueda sin sugerencias web | Privacidad |
| 28 | `library.search.cloud` | Desactivar búsqueda cloud por política | Privacidad |
| 29 | `library.privacy.recent_documents` | No guardar documentos recientes | Privacidad |
| 30 | `library.privacy.recent_apps` | No seguir apps usadas recientemente | Privacidad |
| 31 | `library.visual.sync_promotions` | Ocultar promociones del Explorador | Interfaz |
| 32 | `library.network.delivery_peers` | Delivery Optimization sin pares | Red |
| 33 | `library.focus.notifications` | Silenciar notificaciones toast | Concentración |
| 34 | `library.focus.lock_notifications` | No mostrar avisos en bloqueo | Concentración |
| 35 | `library.background.suggested_installs` | Desactivar instalaciones sugeridas | Segundo plano |
| 36 | `library.focus.setup_nudges` | Ocultar recordatorios de completar equipo | Concentración |
| 37 | `library.power.epp` | CPU: preferencia de rendimiento EPP 0 | Energía AC |
| 38 | `library.power.boost` | CPU: boost agresivo | Energía AC |
| 39 | `library.power.minimum` | CPU: mínimo AC al 100% | Energía AC |
| 40 | `library.power.maximum` | CPU: máximo AC al 100% | Energía AC |
| 41 | `library.power.frequency` | CPU: sin límite de MHz del plan | Energía AC |
| 42 | `library.power.parking_min` | CPU: mínimo de núcleos activos 100% | Energía AC |
| 43 | `library.power.parking_max` | CPU: máximo de núcleos activos 100% | Energía AC |
| 44 | `library.power.pcie` | PCIe: sin ahorro ASPM | Energía AC |
| 45 | `library.power.usb` | USB: sin suspensión selectiva en AC | Energía AC |
| 46 | `library.power.disk` | Disco: no apagar por inactividad AC | Energía AC |
| 47 | `library.power.sleep` | Sesión AC sin suspensión automática | Energía AC |
| 48 | `library.power.hibernate` | Sesión AC sin hibernación automática | Energía AC |
| 49 | `library.power.display` | Pantalla: espera AC de 30 minutos | Energía AC |
| 50 | `library.power.wifi` | Wi-Fi: máximo rendimiento AC | Energía AC |
| 51 | `library.service.search` | Pausar indexación de Windows Search | Servicios opcionales |
| 52 | `library.service.sysmain` | Pausar SysMain | Servicios opcionales |
| 53 | `library.service.xbox_auth` | Pausar autenticación Xbox | Servicios opcionales |
| 54 | `library.service.xbox_save` | Pausar guardado cloud Xbox | Servicios opcionales |
| 55 | `library.service.xbox_network` | Pausar red Xbox Live | Servicios opcionales |
| 56 | `library.service.maps` | Pausar administrador de mapas | Servicios opcionales |
| 57 | `library.service.diagnostics` | Pausar experiencia conectada DiagTrack | Servicios opcionales |
| 58 | `library.service.retail` | Pausar modo demostración Retail | Servicios opcionales |
