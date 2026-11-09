using EvoNativeEngine.Models;
namespace EvoNativeEngine.Services;

public sealed record LibraryDefinition(string Id, string Name, string Category, string Kind, string Hive, string Path,
    string ValueName, string Target, string Risk, string Purpose, bool Admin = false, bool Restart = false,
    string Applicability = "Windows 10/11; el efecto depende de versión, políticas y hardware.")
{
    public OperationCatalogItem Catalog => new(Id, Name, Purpose + " Riesgo: " + Risk, Category, Admin, true, true, true,
        "Revisa el alcance y riesgo. No garantiza más FPS; conserva solo tras comprobar el efecto.", RequiresRestart: Restart);
}
public static class OptimizationLibrary
{
    public static readonly IReadOnlyDictionary<string, LibraryDefinition> Definitions = Build();
    private static Dictionary<string, LibraryDefinition> Build()
    {
        var list = new List<LibraryDefinition>();
        void R(string id, string name, string category, string hive, string path, string value, string target, string purpose, string risk, bool restart = false, bool text = false)
            => list.Add(new("library." + id, name, category, text ? "RegistryString" : "RegistryDword", hive, path, value, target, risk, purpose, hive == "HKLM", restart));
        const string CU = "HKCU", LM = "HKLM";
        const string Explorer = @"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
        const string Edge = @"SOFTWARE\Policies\Microsoft\Edge";
        const string Data = @"SOFTWARE\Policies\Microsoft\Windows\DataCollection";
        R("gaming.game_mode", "Activar Game Mode", "Gaming", CU, @"Software\Microsoft\GameBar", "AutoGameModeEnabled", "1", "Solicita el modo Juego de Windows para priorizar la experiencia de juego.", "No garantiza cambios en el scheduler ni ganancias en todos los juegos.");
        R("gaming.background_recording", "Desactivar grabación de fondo", "Gaming", CU, @"System\GameConfigStore", "GameDVR_Enabled", "0", "Desactiva el ajuste de grabación de fondo de Game DVR.", "Pierdes capturas retrospectivas de Xbox; no modifica OBS.");
        R("gaming.capture", "Desactivar captura de Game DVR", "Gaming", CU, @"Software\Microsoft\Windows\CurrentVersion\GameDVR", "AppCaptureEnabled", "0", "Desactiva captura de vídeo mediante Game DVR para este usuario.", "No podrás grabar con Game DVR hasta restaurar.");
        R("gaming.controller_bar", "No abrir Game Bar con el mando", "Gaming", CU, @"Software\Microsoft\GameBar", "UseNexusForGameBarEnabled", "0", "Evita invocar Game Bar con el botón Xbox.", "Cambia un atajo del mando; no elimina Game Bar ni sus dependencias.");
        R("gaming.bar_tips", "Ocultar panel inicial de Game Bar", "Gaming", CU, @"Software\Microsoft\GameBar", "ShowStartupPanel", "0", "Solicita no mostrar el panel inicial al iniciar juegos.", "Versiones nuevas de Game Bar pueden ignorar este ajuste.");
        R("input.mouse_acceleration", "Ratón sin aceleración de Windows", "Entrada", CU, @"Control Panel\Mouse", "MouseSpeed", "0", "Desactiva la aceleración del puntero de Windows; no altera DPI.", "Cambia la sensación del escritorio. Los juegos con raw input pueden no verse afectados.", true, true);
        R("visual.menu_delay", "Menús con espera de 100 ms", "Interfaz", CU, @"Control Panel\Desktop", "MenuShowDelay", "100", "Reduce la espera declarada de apertura de submenús.", "No aumenta FPS del juego; puede abrir menús involuntariamente.", true, true);
        R("visual.drag_outline", "Arrastrar ventanas con contorno", "Interfaz", CU, @"Control Panel\Desktop", "DragFullWindows", "0", "No redibuja todo el contenido durante arrastre de ventanas.", "Pierdes previsualización del contenido al arrastrar.", true, true);
        R("visual.window_animation", "Reducir animación de ventanas", "Interfaz", CU, @"Control Panel\Desktop\WindowMetrics", "MinAnimate", "0", "Desactiva la animación de minimizar/restaurar.", "Cambia apariencia; cerrar sesión puede ser necesario.", true, true);
        R("visual.taskbar_animation", "Desactivar animaciones de barra", "Interfaz", CU, Explorer, "TaskbarAnimations", "0", "Reduce animaciones de la barra de tareas compatibles.", "Windows puede requerir nueva sesión; sin garantía de FPS.", true);
        R("visual.icon_shadow", "Quitar sombra de iconos", "Interfaz", CU, Explorer, "ListviewShadow", "0", "Desactiva la sombra del texto de iconos del escritorio.", "Puede reducir legibilidad sobre fondos claros.", true);
        R("visual.desktop_preview", "Desactivar vista previa del escritorio", "Interfaz", CU, Explorer, "DisablePreviewDesktop", "1", "Desactiva la previsualización Aero Peek donde exista.", "Pierdes esa interacción; algunas versiones no la usan.", true);
        R("browser.edge_background", "Edge sin ejecución de fondo", "Aplicaciones", LM, Edge, "BackgroundModeEnabled", "0", "Impide que Edge mantenga apps/extensiones en fondo al cerrarlo.", "Notificaciones y extensiones dejan de trabajar con Edge cerrado.", true);
        R("browser.edge_startup", "Desactivar Startup Boost de Edge", "Aplicaciones", LM, Edge, "StartupBoostEnabled", "0", "Evita precargar procesos de Edge al iniciar sesión.", "Edge puede tardar más en abrir. Política de Edge, no de WebView2.", true);
        R("browser.chrome_background", "Chrome sin ejecución de fondo", "Aplicaciones", LM, @"SOFTWARE\Policies\Google\Chrome", "BackgroundModeEnabled", "0", "Desactiva apps de fondo de Chrome al cerrarlo.", "Pierdes notificaciones/extensiones de fondo; requiere Chrome compatible.", true);
        R("browser.edge_sleep", "Activar pestañas durmientes en Edge", "Aplicaciones", LM, Edge, "SleepingTabsEnabled", "1", "Permite suspender pestañas inactivas de Edge para reducir recursos.", "Algunas pestañas pueden recargarse; excepciones del navegador siguen vigentes.", true);
        R("browser.edge_sleep_delay", "Edge: dormir pestañas tras 15 min", "Aplicaciones", LM, Edge, "SleepingTabsTimeout", "15", "Establece 15 minutos de inactividad antes de dormir pestañas elegibles.", "Solo tiene efecto si pestañas durmientes están activas.", true);
        R("privacy.required_diagnostics", "Diagnóstico Windows: solo requerido", "Privacidad", LM, Data, "AllowTelemetry", "1", "Limita diagnóstico Windows a requerido; no promete telemetría cero ni afecta otras apps.", "Gestionado por políticas; edición Home u organización pueden ignorarlo.", true);
        R("privacy.device_name", "No incluir nombre en diagnóstico", "Privacidad", LM, Data, "AllowDeviceNameInTelemetry", "0", "Solicita no incluir el nombre del dispositivo en diagnóstico compatible.", "No bloquea otras fuentes de datos ni genera una mejora de FPS.", true);
        R("privacy.feedback", "Silenciar solicitudes de comentarios", "Privacidad", LM, Data, "DoNotShowFeedbackNotifications", "1", "Desactiva solicitudes de feedback compatibles mediante política.", "No desactiva servicios de seguridad ni diagnóstico requerido.", true);
        R("privacy.advertising", "Desactivar identificador publicitario", "Privacidad", CU, @"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo", "Enabled", "0", "Desactiva ID publicitario del usuario en apps compatibles.", "Ajuste de privacidad, no prueba de rendimiento.");
        R("privacy.tailored", "Desactivar experiencias personalizadas", "Privacidad", CU, @"Software\Microsoft\Windows\CurrentVersion\Privacy", "TailoredExperiencesWithDiagnosticDataEnabled", "0", "No usar diagnóstico para experiencias personalizadas compatibles.", "No equivale a impedir toda conexión a Microsoft.");
        R("privacy.ink", "Restringir aprendizaje de escritura manual", "Privacidad", CU, @"Software\Microsoft\InputPersonalization", "RestrictImplicitInkCollection", "1", "Restringe recogida implícita de escritura manuscrita.", "Puede reducir personalización de reconocimiento.", true);
        R("privacy.typing", "Restringir aprendizaje de texto", "Privacidad", CU, @"Software\Microsoft\InputPersonalization", "RestrictImplicitTextCollection", "1", "Restringe recogida implícita de texto para personalización.", "Puede reducir sugerencias y corrección personalizada.", true);
        R("background.store_apps", "Restringir fondo de apps de Windows", "Segundo plano", LM, @"SOFTWARE\Policies\Microsoft\Windows\AppPrivacy", "LetAppsRunInBackground", "2", "Deniega fondo a apps Windows compatibles. No mata procesos Win32 ni Steam.", "Puede romper avisos y tareas de apps Store. Políticas sujetas a edición.", true);
        R("background.widgets", "Desactivar Widgets por política", "Segundo plano", LM, @"SOFTWARE\Policies\Microsoft\Dsh", "AllowNewsAndInterests", "0", "Solicita desactivar Widgets en Windows 11 compatible.", "Requiere política/edición compatible; no desinstala Web Experience Pack.", true);
        R("search.web_suggestions", "Búsqueda sin sugerencias web", "Privacidad", CU, @"Software\Policies\Microsoft\Windows\Explorer", "DisableSearchBoxSuggestions", "1", "Desactiva sugerencias web/historial de búsqueda compatibles con esta política.", "El comportamiento de Inicio y Explorador varía por versión.", true);
        R("search.cloud", "Desactivar búsqueda cloud por política", "Privacidad", LM, @"SOFTWARE\Policies\Microsoft\Windows\Windows Search", "AllowCloudSearch", "0", "Restringe búsqueda cloud compatible con Windows Search.", "No aparecerán resultados de servicios conectados; puede ser gestionado por organización.", true);
        R("privacy.recent_documents", "No guardar documentos recientes", "Privacidad", CU, Explorer, "Start_TrackDocs", "0", "Desactiva seguimiento de documentos recientes para Inicio y Jump Lists.", "Pierdes accesos recientes. No borra archivos del usuario.", true);
        R("privacy.recent_apps", "No seguir apps usadas recientemente", "Privacidad", CU, Explorer, "Start_TrackProgs", "0", "Desactiva seguimiento de apps usadas para recomendaciones compatibles.", "Pierdes lista de apps frecuentes; no desinstala apps.", true);
        R("visual.sync_promotions", "Ocultar promociones del Explorador", "Interfaz", CU, Explorer, "ShowSyncProviderNotifications", "0", "Solicita ocultar notificaciones promocionales de proveedores de sincronización.", "No pausa OneDrive ni elimina sus archivos.", true);
        R("network.delivery_peers", "Delivery Optimization sin pares", "Red", LM, @"SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization", "DODownloadMode", "0", "Usa descarga HTTP sin intercambio P2P de actualizaciones.", "Puede aumentar tráfico desde servidores. Windows Update sigue activo.", true);
        R("focus.notifications", "Silenciar notificaciones toast", "Concentración", CU, @"Software\Microsoft\Windows\CurrentVersion\PushNotifications", "ToastEnabled", "0", "Desactiva avisos toast compatibles para este usuario.", "Puedes perder avisos importantes. No todas las apps respetan este ajuste.", true);
        R("focus.lock_notifications", "No mostrar avisos en bloqueo", "Concentración", CU, @"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings", "NOC_GLOBAL_SETTING_ALLOW_TOASTS_ABOVE_LOCK", "0", "Oculta notificaciones toast en pantalla bloqueada.", "Privacidad/concentración, no mejora de FPS.", true);
        R("background.suggested_installs", "Desactivar instalaciones sugeridas", "Segundo plano", CU, @"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SilentInstalledAppsEnabled", "0", "Solicita no instalar apps sugeridas silenciosamente en versiones compatibles.", "Windows puede ignorar el ajuste o cambiarlo al actualizar; no elimina apps existentes.", true);
        R("focus.setup_nudges", "Ocultar recordatorios de completar equipo", "Concentración", CU, @"Software\Microsoft\Windows\CurrentVersion\UserProfileEngagement", "ScoobeSystemSettingEnabled", "0", "Solicita no mostrar el asistente de completar configuración tras iniciar sesión.", "Puedes no ver sugerencias de configuración; depende de versión.", true);
        void P(string id, string name, string group, string setting, string target, string purpose, string risk)
            => list.Add(new("library.power." + id, name, "Energía AC", "Power", "", group, setting, target, risk + " Solo alimentación AC; políticas OEM/HWP pueden prevalecer.", purpose, true));
        const string Processor = "54533251-82be-4824-96c1-47b60b740d00";
        const string Heat = "Puede elevar consumo, temperatura y throttling. No fija frecuencias ni realiza overclock.";
        P("epp", "CPU: preferencia de rendimiento EPP 0", Processor, "36687f9e-e3a5-4dbf-b1dc-15eb381c6863", "0", "Solicita preferencia de rendimiento sobre ahorro de energía.", Heat);
        P("boost", "CPU: boost agresivo", Processor, "be337238-0d82-4146-a960-4f3749d470c7", "2", "Solicita política de boost agresiva si el procesador la soporta.", Heat);
        P("minimum", "CPU: mínimo AC al 100%", Processor, "893dee8e-2bef-41e0-89c6-b55d0929964c", "100", "Solicita estado mínimo alto en el plan activo.", Heat);
        P("maximum", "CPU: máximo AC al 100%", Processor, "bc5038f7-23e0-4960-96da-33abaf5935ec", "100", "Permite el máximo estado de rendimiento del plan.", Heat);
        P("frequency", "CPU: sin límite de MHz del plan", Processor, "75b0ae3f-bce0-45a7-8c89-c9611c25e100", "0", "Quita el límite de frecuencia impuesto por este ajuste de Windows, no límites físicos.", Heat);
        P("parking_min", "CPU: mínimo de núcleos activos 100%", Processor, "0cc5b647-c1df-4637-891a-dec35c318583", "100", "Solicita no aparcar núcleos mediante mínimo de core parking.", Heat);
        P("parking_max", "CPU: máximo de núcleos activos 100%", Processor, "ea062031-0e34-4ff1-9b6d-eb1059334028", "100", "Permite usar todos los núcleos en el máximo del plan.", Heat);
        P("pcie", "PCIe: sin ahorro ASPM", "501a4d13-42af-4429-9fd1-a8218c268e20", "ee12f906-d277-404b-b6da-e5fa1a576df5", "0", "Desactiva ahorro de enlace PCIe en AC cuando está disponible.", "Mayor consumo y posible ausencia de efecto en hardware que lo gestiona solo.");
        P("usb", "USB: sin suspensión selectiva en AC", "2a737441-1930-4402-8d77-b2bebba308a3", "48e6b7a6-50f5-4782-a5d4-53bb8f07e226", "0", "Prueba evitar suspensión selectiva de dispositivos USB.", "Mayor consumo; usar para investigar desconexiones, no como aumento universal de FPS.");
        P("disk", "Disco: no apagar por inactividad AC", "0012ee47-9041-4b5d-9b77-535fba8b1442", "6738e2c4-e8a5-4a42-b16a-e040e769756e", "0", "Impide apagar discos por el temporizador AC del plan.", "Aumenta consumo/desgaste de HDD; NVMe puede ignorar este temporizador.");
        P("sleep", "Sesión AC sin suspensión automática", "238c9fa8-0aad-41ed-83f4-97be242c8f20", "29f6c1db-86da-48c5-9fdb-f2b67b1f44da", "0", "Quita temporizador automático de suspensión AC.", "El equipo seguirá encendido si lo dejas desatendido.");
        P("hibernate", "Sesión AC sin hibernación automática", "238c9fa8-0aad-41ed-83f4-97be242c8f20", "9d7815a6-7ee4-497e-8888-515a05f02364", "0", "Quita temporizador AC de hibernación; no borra hiberfil ni desactiva recuperación.", "Mayor consumo si lo dejas desatendido.");
        P("display", "Pantalla: espera AC de 30 minutos", "7516b95f-f776-4464-8c53-06167f40cc99", "3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e", "1800", "Establece 30 minutos antes de apagar pantalla en AC.", "No aumenta FPS; puede aumentar tiempo encendida y consumo.");
        P("wifi", "Wi-Fi: máximo rendimiento AC", "19cbb8fa-5279-450e-9fac-8a3d5fedd0c1", "12bbebe6-58d6-4636-95bb-3217ef867c1a", "0", "Solicita máximo rendimiento del adaptador inalámbrico compatible.", "Mayor consumo; no reduce por sí solo latencia de Internet.");
        void S(string id, string name, string service, string purpose, string risk)
            => list.Add(new("library.service." + id, name, "Servicios opcionales", "Service", "", service, "", "0", risk + " No cambia el tipo de inicio; Windows puede reiniciarlo.", purpose, true));
        S("search", "Pausar indexación de Windows Search", "WSearch", "Detiene temporalmente indexación para investigar actividad de disco.", "Búsqueda puede ser más lenta/incompleta durante la sesión.");
        S("sysmain", "Pausar SysMain", "SysMain", "Detiene temporalmente precarga para una prueba de actividad de disco/RAM.", "Puede empeorar carga de aplicaciones; no libera RAM mágicamente.");
        S("xbox_auth", "Pausar autenticación Xbox", "XblAuthManager", "Detiene autenticación Xbox durante una sesión Steam que no la necesite.", "Puede romper juegos/apps Xbox y sus inicios de sesión.");
        S("xbox_save", "Pausar guardado cloud Xbox", "XblGameSave", "Detiene sincronización Xbox si no se utiliza en esta sesión.", "Guardados Xbox no sincronizarán; no tocar si hay un juego Xbox abierto.");
        S("xbox_network", "Pausar red Xbox Live", "XboxNetApiSvc", "Detiene red Xbox Live para una prueba centrada en Steam.", "Puede romper multijugador Xbox; no se usa automáticamente en Modo Bestia.");
        S("maps", "Pausar administrador de mapas", "MapsBroker", "Detiene MapsBroker de forma temporal.", "Afecta descargas/mapas offline; puede estar ya detenido.");
        S("diagnostics", "Pausar experiencia conectada DiagTrack", "DiagTrack", "Detiene temporalmente el servicio de experiencias conectadas.", "No elimina toda telemetría ni sustituye políticas de diagnóstico.");
        S("retail", "Pausar modo demostración Retail", "RetailDemo", "Detiene demostración de tienda si existe y está activa.", "No usar en equipos destinados a exhibición. Normalmente ya está detenido.");
        return list.ToDictionary(d => d.Id, StringComparer.OrdinalIgnoreCase);
    }
}
