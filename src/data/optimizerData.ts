export interface TweakItem {
  id: string;
  name: string;
  category: 'cpu_power' | 'services' | 'registry' | 'network' | 'memory' | 'disk' | 'gpu' | 'processes' | 'cs2' | 'bios';
  categoryLabel: string;
  impact: 'Critico' | 'Alto' | 'Medio';
  description: string;
  technicalRationale: string;
  commandSnippet: string;
  enabledByDefault: boolean;
}

export interface OptimizationModule {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  category: string;
  tweaksCount: number;
  highlight: string;
  description: string;
  details: string[];
  command: string;
}

export interface CortexFunction {
  id: string;
  num: number;
  title: string;
  category: 'Pre-Game' | 'Instalación' | 'Hardware/GPU' | 'Sistema' | 'Diagnóstico' | 'Restauración';
  badge: string;
  shortDesc: string;
  whyItWorks: string;
  expectedGain: string;
  powershellCmd: string;
  batchCmd: string;
  isDangerous?: boolean;
}

export interface DebunkedMyth {
  id: string;
  mythName: string;
  whatItDid: string;
  whyItFailed: string;
  theRealFix: string;
  scienceRationale: string;
}

export interface ExtremeTweak {
  id: string;
  name: string;
  impact: string;
  riskNotice: string;
  whyItWorks: string;
  commandSnippet: string;
  phase: 'Fase 2 - Extremo' | 'Fase 3 - God Mode';
}

export interface GodModeSensor {
  name: string;
  sensorTarget: string;
  meaning: string;
  goodRange: string;
  badIndicator: string;
}

export interface DecisionMatrixRule {
  pattern: string;
  diagnosis: string;
  action: string;
}

export interface HardwareProfile {
  targetModel: string;
  cpuModel: string;
  pCores: number;
  eCores: number;
  threads: number;
  boostClockGHz: number;
  ramGB: number;
  ramType: string;
  storageType: string;
  storageCapacity: string;
  gpuModel: string;
  os: string;
  monitorHz?: number;
}

export const defaultHardwareProfile: HardwareProfile = {
  targetModel: "ASUS ExpertCenter PN64",
  cpuModel: "Intel Core i3-1220P (Alder Lake 2P + 8E)",
  pCores: 2,
  eCores: 8,
  threads: 12,
  boostClockGHz: 4.4,
  ramGB: 16,
  ramType: "DDR4-3200 Dual Channel (2x8GB)",
  storageType: "NVMe PCIe 4.0 x4",
  storageCapacity: "500 GB",
  gpuModel: "Intel UHD Graphics 64EU (Alder Lake iGPU)",
  os: "Windows 11 (23H2 / 24H2)",
  monitorHz: 200
};

export const disabledServicesList = [
  { name: "DiagTrack", desc: "Telemetría y rastreo de diagnóstico de Microsoft Windows" },
  { name: "WSearch", desc: "Windows Search Indexer (consume constantes I/O en SSD NVMe)" },
  { name: "SysMain", desc: "Superfetch (redundante e innecesario en unidades SSD NVMe ultra rápidas)" },
  { name: "lfsvc", desc: "Servicio de geolocalización y Linked Files" },
  { name: "WMPNetworkSvc", desc: "Servicio de uso compartido de red de Windows Media Player" },
  { name: "Fax", desc: "Servicio de envío y recepción de faxes" },
  { name: "stisvc", desc: "Adquisición de imágenes de Windows (escáneres y cámaras)" },
  { name: "dmwappushservice", desc: "Servicio de enrutamiento de mensajes push WAP de telemetría" },
  { name: "MapsBroker", desc: "Servicio de mapas descargados" },
  { name: "WpnService", desc: "Servicio de notificaciones push de sistema" },
  { name: "XblAuthManager", desc: "Administrador de autenticación de Xbox Live" },
  { name: "XblGameSave", desc: "Servicio de guardado de partidas en la nube de Xbox Live" },
  { name: "XblGamerProfile", desc: "Servicio de administración de perfiles de Xbox" },
  { name: "XblNetManager", desc: "Administrador de red de Xbox Live" },
  { name: "XboxGipSvc", desc: "Servicio de protocolo de entrada de accesorios Xbox" },
  { name: "XboxLiveAuthManager", desc: "Servicio de cuentas y tokens Xbox" },
  { name: "XboxLiveGameSave", desc: "Sincronizador en segundo plano de partidas Xbox" },
  { name: "XboxLiveOverlay", desc: "Superposición Game Bar de Xbox (consume ciclos GPU/CPU directos)" },
  { name: "XboxLiveService", desc: "Servicio de red principal de Xbox Live" },
  { name: "XboxNetApiSvc", desc: "API de red multijugador Xbox Live" },
  { name: "XboxTunnelSvc", desc: "Túnel VPN / P2P de Xbox" },
  { name: "bthserv", desc: "Servicio de compatibilidad Bluetooth" },
  { name: "bthavct", desc: "Transporte de control de audio y video Bluetooth" },
  { name: "bthports", desc: "Puertos virtuales de comunicación Bluetooth" },
  { name: "BthHFSrv", desc: "Servicio de manos libres Bluetooth" },
  { name: "BthPan", desc: "Servicio de red de área personal Bluetooth" },
  { name: "BTHPRINTM", desc: "Monitor de impresión Bluetooth" },
  { name: "BTHPRINTSVC", desc: "Servicio de impresión Bluetooth" },
  { name: "BthUSB", desc: "Controlador USB Bluetooth" },
  { name: "BthUd", desc: "Dispositivo de usuario Bluetooth" },
  { name: "WbioSrvc", desc: "Servicio biométrico de Windows (huellas/facial)" },
  { name: "AppXSvc", desc: "Servicio de implementación de aplicaciones UWP de la tienda" },
  { name: "ClipSVC", desc: "Servicio de licencias de Client License Service / Tienda" },
  { name: "DmEnrollmentSvc", desc: "Servicio de inscripción de administración de dispositivos" },
  { name: "DoSvc", desc: "Optimización de distribución de Windows Update P2P" },
  { name: "EFS", desc: "Sistema de cifrado de archivos de Windows (EFS)" },
  { name: "fhsvc", desc: "Historial de archivos de Windows (copias automáticas)" },
  { name: "IPBusEnum", desc: "Enumerador de bus IP PnP" },
  { name: "KeyIso", desc: "Aislamiento de claves de seguridad de red CNG" },
  { name: "LSM", desc: "Administrador de sesiones locales secundarias" },
  { name: "MSiSCSI", desc: "Servicio iniciador Microsoft iSCSI (redes empresariales)" },
  { name: "msiserver", desc: "Windows Installer (pasa a manual / demanda)" },
  { name: "PcaSvc", desc: "Asistente para la compatibilidad de programas" },
  { name: "RasAuto", desc: "Administrador de conexiones de acceso remoto automático" },
  { name: "RasMan", desc: "Administrador de conexiones de acceso telefónico/remoto" },
  { name: "RemoteAccess", desc: "Enrutamiento y acceso remoto" },
  { name: "RemoteAccessConnManager", desc: "Administrador de conexiones de acceso remoto" },
  { name: "RemoteAccessDialinManager", desc: "Administrador de marcado de acceso remoto" },
  { name: "ShellHardwareDetection", desc: "Detección de hardware Shell (AutoPlay de discos/USB)" },
  { name: "shpamsvc", desc: "Servicio de recursos compartidos de red" },
  { name: "TabletInputService", desc: "Panel de escritura a mano y teclado táctil" },
  { name: "TieringEngineSvc", desc: "Motor de almacenamiento por niveles de Windows" },
  { name: "wuauserv", desc: "Windows Update (desactivación temporal para evitar lag en partida)" },
  { name: "AppMgmt", desc: "Administración de instalación de software empresarial" },
  { name: "BDESVC", desc: "Servicio de cifrado de unidad BitLocker" },
  { name: "BITS", desc: "Servicio de transferencia inteligente en segundo plano" },
  { name: "CertPropSvc", desc: "Propagación de certificados de tarjetas inteligentes" }
];

export const cortexFunctionsList: CortexFunction[] = [
  {
    id: "f-bestia",
    num: 1,
    title: "MODO BESTIA SEGURO",
    category: "Pre-Game",
    badge: "Antes de jugar",
    shortDesc: "Purga aplicaciones en segundo plano, detiene servicios no esenciales, libera RAM/DNS y fija CS2 en P-Cores 0-3 con prioridad Alta.",
    whyItWorks: "OneDrive, Teams, Spotify, Chrome y Discord compiten directamente por la memoria compartida que la Intel UHD necesita como VRAM. Al cerrarlos y confinar CS2 a los 4 hilos rápidos de los P-Cores (mask 15), se evitan bajones de framerate.",
    expectedGain: "+12-18 FPS y eliminación de tirones",
    powershellCmd: "Enable-Bestia",
    batchCmd: "PN64_V6_ULTIMATE.bat [1]"
  },
  {
    id: "f-torneo",
    num: 2,
    title: "MODO TORNEO EXTREMO (Mata Explorer)",
    category: "Pre-Game",
    badge: "+5-8 FPS UHD",
    shortDesc: "Cierra el shell Explorer.exe y DWM de escritorio para liberar 300-500 MB de memoria RAM/VRAM compartida para la Intel UHD.",
    whyItWorks: "La iGPU Intel UHD 64EU no tiene VRAM dedicada. Cada ventana, barra de tareas y transparencia de Windows roba ancho de banda del bus de memoria y ciclos de GPU. Al matar Explorer, toda la GPU queda 100% libre para CS2.",
    expectedGain: "+5-8 FPS netos en competitivo (recuperable con Ctrl+Shift+Esc > explorer.exe)",
    powershellCmd: "Enable-Torneo",
    batchCmd: "PN64_V6_ULTIMATE.bat [2]"
  },
  {
    id: "f-nucleo",
    num: 3,
    title: "INSTALACIÓN PERMANENTE DEL NÚCLEO",
    category: "Instalación",
    badge: "Solo 1 vez",
    shortDesc: "Aplica el plan Ultimate Performance, desactiva hibernación/standby, fija TRIM NVMe, configura timers TSC y añade exclusiones en Windows Defender.",
    whyItWorks: "Evita que Windows Defender escanee los archivos de mapas y texturas de CS2 en pleno tiroteo y configura el plan de energía para sostener los 4.4 GHz de reloj sin bajadas a reposo C6/C7.",
    expectedGain: "Base sólida sin micro-congelaciones",
    powershellCmd: "Install-Permanente",
    batchCmd: "PN64_V6_ULTIMATE.bat [3]"
  },
  {
    id: "f-timers",
    num: 4,
    title: "FIX TIMERS TSC (Anti-HPET lento)",
    category: "Sistema",
    badge: "Crítico Alder Lake",
    shortDesc: "Elimina useplatformtick y useplatformclock (HPET de 14 MHz) y restaura el temporizador nativo TSC a 4.0 GHz con disabledynamictick.",
    whyItWorks: "Muchos optimizadores viejos fuerzan HPET pensando que mejora la precisión, pero en procesadores Intel modernos el HPET introduce hasta 800 nanosegundos de latencia por llamada de consulta temporal. TSC nativo a 4 GHz es casi instantáneo.",
    expectedGain: "Respuesta de ratón 1:1 inmediata y -2ms frametime",
    powershellCmd: "Fix-Timers",
    batchCmd: "PN64_V6_ULTIMATE.bat [4]"
  },
  {
    id: "f-gpu",
    num: 5,
    title: "BOOST INTEL UHD + MPO FIX + SHADER FLUSH",
    category: "Hardware/GPU",
    badge: "Fix Parpadeos",
    shortDesc: "Activa HAGS (HwSchMode 2), desactiva Multi-Plane Overlay (OverlayTestMode 5), ajusta TdrDelay a 10 y purga cachés de shaders corruptos.",
    whyItWorks: "El Multi-Plane Overlay (MPO) en drivers Intel provoca tartamudeos y desgarro de pantalla. TdrDelay evita bloqueos del controlador gráfico, y reconstruir los shaders DirectX previene los tirones al entrar a los sitios de bomba.",
    expectedGain: "Cero congelaciones al tirar humos o granadas",
    powershellCmd: "Boost-GPU",
    batchCmd: "PN64_V6_ULTIMATE.bat [5]"
  },
  {
    id: "f-stutter",
    num: 6,
    title: "FIX STUTTER RAM DEFINITIVO",
    category: "Sistema",
    badge: "Memoria Limpia",
    shortDesc: "Detiene SysMain en NVMe, purga la Standby List de Windows y provee configuración óptima para ISLC (1024/512 MB con timer a 0.50 ms).",
    whyItWorks: "Windows 11 acumula archivos cacheados en la 'Standby List' hasta llenar los 16 GB. Cuando CS2 necesita asignar memoria para una nueva ronda, el kernel tiene que desalojar bloques a la fuerza provocando un tirón de 100-300 ms.",
    expectedGain: "1% Lows estables por encima de 60 FPS",
    powershellCmd: "Fix-Stutter",
    batchCmd: "PN64_V6_ULTIMATE.bat [6]"
  },
  {
    id: "f-red",
    num: 7,
    title: "RED COMPETITIVO + NAGLE OFF",
    category: "Sistema",
    badge: "-15-25ms Desync",
    shortDesc: "Fija TcpAckFrequency=1, TCPNoDelay=1, TcpDelAckTicks=0 en todas las interfaces, desactiva marcas de tiempo y reinicia el catálogo Winsock.",
    whyItWorks: "El algoritmo de Nagle retiene deliberadamente paquetes TCP pequeños durante hasta 40 ms para unirlos. En CS2 queremos que cada bala y movimiento se transmita al milisegundo sin buffering.",
    expectedGain: "Registro de disparos instantáneo y menor ping",
    powershellCmd: "Optimize-Network",
    batchCmd: "PN64_V6_ULTIMATE.bat [7]"
  },
  {
    id: "f-debloat",
    num: 8,
    title: "DEBLOAT QUIRÚRGICO SEGURO",
    category: "Sistema",
    badge: "Sin tocar MyASUS",
    shortDesc: "Desinstala paquetes UWP innecesarios (TikTok, Clipchamp, CandyCrush, Solitaire, BingNews) y anula tareas de telemetría de Microsoft.",
    whyItWorks: "Elimina bloatware del consumidor que corre servicios silenciosos en segundo plano sin dañar la Microsoft Store, los controladores Intel ni el software esencial MyASUS.",
    expectedGain: "+400 MB de RAM libre y 0% uso de CPU en reposo",
    powershellCmd: "Invoke-Debloat",
    batchCmd: "PN64_V6_ULTIMATE.bat [8]"
  },
  {
    id: "f-servicios",
    num: 9,
    title: "SERVICIOS GAMING ON / OFF",
    category: "Sistema",
    badge: "Switcher Rápido",
    shortDesc: "Alterna en un clic entre perfil 'Gaming' (detiene cola de impresión, mapas, telemetría y diagnósticos) y perfil 'Normal'.",
    whyItWorks: "Permite usar el PC para trabajo de oficina o estudios cuando no juegas y recortar todos los servicios prescindibles cuando vas a competir en CS2.",
    expectedGain: "Versatilidad total sin romper impresoras ni actualizaciones",
    powershellCmd: "Set-ServicesGaming",
    batchCmd: "PN64_V6_ULTIMATE.bat [9]"
  },
  {
    id: "f-vbs",
    num: 10,
    title: "VBS / HVCI TOGGLE (+5-12% FPS)",
    category: "Hardware/GPU",
    badge: "Opcional Avanzado",
    shortDesc: "Desactiva Virtualization-Based Security e Integridad de Memoria para obtener la máxima potencia de la iGPU, o lo reactiva para FaceIT/seguridad.",
    whyItWorks: "VBS ejecuta el kernel de Windows dentro de una máquina virtual protegida por hipervisor. En procesadores con gráfica integrada como el i3-1220P, este aislamiento genera una penalización directa de entre 5% y 12% en tasas de fotogramas.",
    expectedGain: "+8-14 FPS adicionales (nota: desactiva FaceIT/Valorant)",
    powershellCmd: "Disable-VBS / Enable-VBS",
    batchCmd: "PN64_V6_ULTIMATE.bat [10]",
    isDangerous: true
  },
  {
    id: "f-limpieza",
    num: 11,
    title: "LIMPIEZA TOTAL NVMe + SHADERS CS2",
    category: "Sistema",
    badge: "Mantenimiento",
    shortDesc: "Borra temporales, Prefetch, SoftwareDistribution, caché de Steam HTML y shader caches DirectX, ejecutando además comando TRIM en SSD.",
    whyItWorks: "Mantener al menos 80-100 GB libres en la unidad NVMe de 500 GB es obligatorio para que la memoria caché SLC del disco funcione a 5000 MB/s en lugar de caer a velocidades de disco mecánico.",
    expectedGain: "Carga de mapas en menos de 5 segundos",
    powershellCmd: "Clear-NVMe",
    batchCmd: "PN64_V6_ULTIMATE.bat [11]"
  },
  {
    id: "f-loop",
    num: 12,
    title: "FIJAR CS2 EN VIVO (Watchdog Loop)",
    category: "Pre-Game",
    badge: "Protección E-Cores",
    shortDesc: "Bucle continuo cada 15 segundos que detecta cs2.exe y reafirma la prioridad Alta y afinidad a los P-Cores 0-3 si Windows intenta moverlo.",
    whyItWorks: "Windows 11 a veces intenta reasignar hilos a los núcleos eficientes (E-Cores) si detecta que la temperatura sube. Este guardián previene caídas súbitas a mitad de partida.",
    expectedGain: "Framerate 100% constante en partidas largas",
    powershellCmd: "Start-CS2Loop",
    batchCmd: "PN64_V6_ULTIMATE.bat [12]"
  },
  {
    id: "f-bench",
    num: 13,
    title: "BENCHMARK & DIAGNÓSTICO EN VIVO",
    category: "Diagnóstico",
    badge: "Verificación",
    shortDesc: "Analiza carga de CPU, RAM disponible, espacio libre en NVMe, configuración BCD, exclusiones de antivirus, ping de red y temperaturas térmicas.",
    whyItWorks: "Genera un reporte claro en C:\\PN64_CS2\\logs\\bench_pn64.txt para confirmar que tu hardware está rindiendo al 100% y que la temperatura no sobrepasa los 88°C.",
    expectedGain: "Visibilidad total del estado de tu hardware",
    powershellCmd: "Get-Bench",
    batchCmd: "PN64_V6_ULTIMATE.bat [13]"
  },
  {
    id: "f-cfg",
    num: 14,
    title: "DESPLEGAR AUTOEXEC.CFG Y VIDEO.TXT",
    category: "Instalación",
    badge: "CS2 Config",
    shortDesc: "Crea y copia automáticamente autoexec.cfg y video.txt en las rutas de Steam de CS2 con resolución 1280x960 4:3 y FSR en Rendimiento.",
    whyItWorks: "Garantiza que el juego arranque en pantalla completa con renderizado a 1280x960 escalado y FidelityFX Super Resolution activado, logrando la relación óptima entre claridad y fotogramas.",
    expectedGain: "+25 FPS directos por resolución y FSR",
    powershellCmd: "New-CS2Cfg",
    batchCmd: "PN64_V7.ps1 [14]"
  },
  {
    id: "f-restore",
    num: 15,
    title: "RESTAURAR MODO STOCK 100%",
    category: "Restauración",
    badge: "Reversibilidad",
    shortDesc: "Revierte todos los servicios, reactiva explorer, restaura el hipervisor VBS, vuelve al temporizador estándar y restaura el plan de energía de fábrica.",
    whyItWorks: "Tranquilidad absoluta: todo lo que hace esta suite es 100% reversible sin necesidad de formatear el equipo.",
    expectedGain: "Retorno limpio al estado original de Windows",
    powershellCmd: "Restore-Stock",
    batchCmd: "PN64_V6_ULTIMATE.bat [14]"
  }
];

export const debunkedMythsList: DebunkedMyth[] = [
  {
    id: "m-hpet",
    mythName: "Forzar useplatformtick yes (HPET)",
    whatItDid: "Obligaba a Windows a consultar el High Precision Event Timer por hardware a una frecuencia de 14.318 MHz en cada llamada de reloj.",
    whyItFailed: "En procesadores Intel Alder Lake como el i3-1220P, el bus HPET añade entre 500 y 1200 nanosegundos de latencia comparado con el Time Stamp Counter (TSC) interno del procesador que corre a 4.4 GHz.",
    theRealFix: "Eliminar useplatformtick y useplatformclock en BCDedit, activar disabledynamictick yes y fijar tscsyncpolicy Enhanced para usar el TSC nativo a 4.4 GHz sin overhead.",
    scienceRationale: "Medido con DPC Latency Checker y PresentMon: el frametime pasa de fluctuar ±4.2 ms a una línea plana estable con variación inferior a 0.8 ms."
  },
  {
    id: "m-affinity4095",
    mythName: "Asignar Afinidad a Todos los Núcleos (0xFFF / 4095)",
    whatItDid: "Le decía al juego que usara los 12 hilos lógicos del i3-1220P por igual.",
    whyItFailed: "El i3-1220P tiene arquitectura híbrida: 2 P-Cores potentes (hilos 0 a 3 con HyperThreading) a 4.4 GHz y 8 E-Cores diminutos (hilos 4 a 11) a 1.2 GHz. Cuando el hilo crítico de render de CS2 caía en un E-Core, los FPS colapsaban de 95 a 38.",
    theRealFix: "Fijar afinidad a máscara 15 (0x000F en binario = 0000 0000 0000 1111), confinando CS2 estrictamente a los 4 hilos de los P-Cores con prioridad Alta.",
    scienceRationale: "Source 2 depende del rendimiento mononúcleo. Al eliminar los 8 E-Cores de la ecuación del juego, el 1% Low sube de 25 FPS a más de 60 FPS consistentes."
  },
  {
    id: "m-paging",
    mythName: "DisablePagingExecutive=1 y LargeSystemCache=1",
    whatItDid: "Forzaba al kernel de Windows a mantener todos los controladores en RAM y expandir la caché de archivos de sistema.",
    whyItFailed: "Es un ajuste heredado de Windows Server 2003/2008. En un sistema de escritorio con 16 GB de RAM compartida con una iGPU, LargeSystemCache devora la memoria física, provocando que la Intel UHD se quede sin espacio para texturas de CS2.",
    theRealFix: "Dejar la gestión nativa del kernel de Windows 11 y fijar el pagefile en un tamaño estático de 4096 MB en el NVMe para evitar ráfagas de redimensionamiento dinámico.",
    scienceRationale: "Evita que el proceso System compita con la GPU por los 16 GB de memoria DDR4."
  },
  {
    id: "m-emptystandbylist",
    mythName: "Ejecutar EmptyStandbyList en bucle cada 5 minutos",
    whatItDid: "Vaciaba la memoria en espera de Windows periódicamente con una tarea programada agresiva.",
    whyItFailed: "Vaciar abruptamente la caché en mitad de una partida obliga al motor del juego a recargar datos desde el disco o memoria secundaria, introduciendo un micro-congelamiento ('hitch') justo en el momento del vaciado.",
    theRealFix: "Utilizar ISLC (Intelligent Standby List Cleaner) configurado con umbral de 1024 MB libres y lista en espera superior a 512 MB, con resolución de timer a 0.50 ms.",
    scienceRationale: "El vaciado solo ocurre cuando la memoria está verdaderamente al borde del agotamiento, no de forma ciega cada 300 segundos."
  },
  {
    id: "m-300fps",
    mythName: "La falsa promesa de 300 FPS en Intel UHD 64EU",
    whatItDid: "Canales de optimización prometen 240-300 FPS en tarjetas gráficas integradas de oficina aplicando trucos milagrosos.",
    whyItFailed: "La física de silicio es inmutable: la Intel UHD 64EU dispone de 512 núcleos shader a ~1.2 GHz y depende del ancho de banda de la memoria DDR4 de dos canales (~51 GB/s). En 1080p nativo, el fillrate de CS2 satura la GPU por completo.",
    theRealFix: "Optimización honesta y técnica: Configurar 1280x960 4:3 estirado + FSR Rendimiento + P-Cores a 4.4 GHz para pasar de 30-45 FPS con tirones a 75-110 FPS competitivos y estables.",
    scienceRationale: "Unos 85 FPS estables con 1% Low de 62 FPS te permiten ganar duelos competitivos en Premier; 300 FPS con caídas a 20 FPS causan desync y derrotas."
  }
];

export const extremeTweaksList: ExtremeTweak[] = [
  {
    id: "ext-spectre",
    name: "Desactivar Mitigaciones Spectre/Meltdown",
    impact: "+1-3% CPU puro en 12th Gen Alder Lake",
    riskNotice: "Menor protección ante ataques de canal lateral de ejecución especulativa (Aceptable en PC dedicado a juegos sin datos críticos).",
    whyItWorks: "Elimina las trampas de mitigación de predicción de bifurcación de la CPU que consumen ciclos en el kernel de Windows.",
    commandSnippet: "Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'FeatureSettingsOverride' -Value 3",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-ifeo-priority",
    name: "Prioridad ALTA Permanente Nativa en IFEO (cs2.exe)",
    impact: "Garantiza quantum prioritario de CPU sin programas externos",
    riskNotice: "Seguro. Se gestiona nativamente mediante Image File Execution Options de Windows.",
    whyItWorks: "Windows NT aplica automáticamente CpuPriorityClass=3 (High) cada vez que el ejecutable cs2.exe arranca, sin depender de software residente de terceros.",
    commandSnippet: "New-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cs2.exe\\PerfOptions' -Name 'CpuPriorityClass' -Value 3",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-idledisable",
    name: "Relojes CPU Fijos al Máximo (IDLEDISABLE 1)",
    impact: "Elimina toda latencia de reactivación y sostén 4.4 GHz incondicional",
    riskNotice: "La CPU nunca entra en reposo. Mayor consumo y calor. Usar junto al booster de auto-restauración.",
    whyItWorks: "Obliga a los núcleos de rendimiento P-Cores a nunca bajar de reloj durante la partida, eliminando cualquier vacilación de frecuencia.",
    commandSnippet: "powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR IDLEDISABLE 1; powercfg /setactive SCHEME_CURRENT",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-pagecombining",
    name: "Desactivar Combinación de Páginas (PageCombining OFF)",
    impact: "Libera ciclos de cálculo de CPU innecesarios",
    riskNotice: "Totalmente seguro con 16 GB de memoria RAM Dual Channel.",
    whyItWorks: "Windows 11 analiza periódicamente la RAM para fusionar páginas idénticas. En un sistema con 16GB, este análisis periódicamente roba tiempo de CPU a CS2.",
    commandSnippet: "Disable-MMAgent -PageCombining",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-msi-mode",
    name: "Modo MSI (Message Signaled Interrupts) en Dispositivos PCI",
    impact: "Reduce drásticamente la latencia de interrupciones DPC en GPU y NVMe",
    riskNotice: "Seguro. Habilita el estándar MSI moderno en lugar de las interrupciones compartidas por línea (Line-based IRQ).",
    whyItWorks: "Permite a la GPU integrada y al SSD NVMe enviar mensajes de interrupción directamente a la memoria de la CPU sin colisiones en el bus.",
    commandSnippet: "Set-ItemProperty '...\\Interrupt Management\\MessageSignaledInterruptProperties' -Name 'MSISupported' -Value 1",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-ntfs-cache",
    name: "Caché NTFS Ampliada & Sin Registro de Último Acceso",
    impact: "Cero escrituras redundantes por lectura y carga ultra rápida de mapas",
    riskNotice: "Totalmente seguro para unidades SSD NVMe PCIe 4.0.",
    whyItWorks: "Evita que cada lectura de texturas actualice la fecha del archivo en disco y expande el búfer en memoria de NTFS.",
    commandSnippet: "fsutil behavior set disablelastaccess 1; fsutil behavior set memoryusage 2",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-pagefile-fixed",
    name: "Pagefile Fija Estática a 8 GB (8192 MB) en NVMe",
    impact: "Elimina los micro-congelamientos de redimensionamiento de paginación",
    riskNotice: "Requiere 8 GB libres en el SSD C:.",
    whyItWorks: "Impide que Windows cambie dinámicamente el tamaño del archivo pagefile.sys durante rondas intensas de CS2.",
    commandSnippet: "wmic pagefileset set InitialSize=8192,MaximumSize=8192",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-net-advanced",
    name: "Red Física sin Ahorro de Energía ni Moderación de Interrupciones",
    impact: "Registro instantáneo de disparos por cable Ethernet",
    riskNotice: "Desactiva Green Ethernet y Energy Efficient Ethernet en la tarjeta de red.",
    whyItWorks: "Evita que el chip de red Ethernet del PN64 entre en modos de bajo consumo entre ráfagas de paquetes de juego.",
    commandSnippet: "Disable-NetAdapterPowerManagement; netsh int tcp set global autotuninglevel=high",
    phase: "Fase 2 - Extremo"
  },
  {
    id: "ext-throttlestop-epp",
    name: "ThrottleStop Speed Shift EPP = 0",
    impact: "Latencia mínima de respuesta de frecuencia del procesador",
    riskNotice: "Requiere ejecutar ThrottleStop.",
    whyItWorks: "Configura el Energy Performance Preference a 0, haciendo que los P-Cores escalen a 4.4 GHz inmediatamente ante la más mínima demanda de CS2.",
    commandSnippet: "ThrottleStop -> Speed Shift EPP = 0",
    phase: "Fase 3 - God Mode"
  },
  {
    id: "ext-pl1-clamp",
    name: "Calibración de Potencia Sostenida PL1 (28W Clamp) vs PL2 (50-64W)",
    impact: "Elimina el estrangulamiento térmico oscilatorio (Thermal Throttling)",
    riskNotice: "La paradoja del mini-PC: 28W constantes dan mejor 1% Low que 45W oscilantes.",
    whyItWorks: "Fijar un PL1 sostenido que el disipador del PN64 pueda evacuar previene caídas térmicas abruptas de 4.4 GHz a 2.1 GHz.",
    commandSnippet: "ThrottleStop -> TPL -> PL1 28W Clamp, Lock Turbo Power Limits",
    phase: "Fase 3 - God Mode"
  }
];

export const godModeSensorsList: GodModeSensor[] = [
  {
    name: "CPU Package (Temperatura)",
    sensorTarget: "HWiNFO / ACPI Thermal Zone",
    meaning: "Temperatura real del procesador i3-1220P en el chasis del mini PC.",
    goodRange: "72°C - 86°C bajo carga continua",
    badIndicator: "≥ 92°C - 95°C activa thermal throttling severo"
  },
  {
    name: "Thermal Throttling (Flag Sí/No)",
    sensorTarget: "HWiNFO / Registro MSR",
    meaning: "Indica si la CPU está reduciendo frecuencia forzadamente por calor.",
    goodRange: "No (0% del tiempo de partida)",
    badIndicator: "Yes = estás perdiendo fotogramas en ese instante"
  },
  {
    name: "Power Limit Throttling (Flag)",
    sensorTarget: "HWiNFO / TPL Status",
    meaning: "Indica si se ha alcanzado el límite de potencia configurado en vatios.",
    goodRange: "Estable en PL1 sin oscilaciones bruscas",
    badIndicator: "Si marca Yes con temp < 88°C, tienes margen para subir PL1 +4W"
  },
  {
    name: "CPU Package Power (Vatios)",
    sensorTarget: "HWiNFO Package Power",
    meaning: "Consumo en vatios en tiempo real del paquete CPU + GPU integrada.",
    goodRange: "25W - 32W sostenidos",
    badIndicator: "Caídas súbitas a 15W indican limitación térmica"
  },
  {
    name: "GPU Core Clock (Frecuencia iGPU)",
    sensorTarget: "Intel UHD 64EU Clock",
    meaning: "Frecuencia de reloj de los núcleos de cómputo gráfico integrados.",
    goodRange: "1100 MHz - 1250 MHz estables",
    badIndicator: "Caídas a 400-600 MHz al compartir calor con la CPU"
  }
];

export const decisionMatrixRules: DecisionMatrixRule[] = [
  {
    pattern: "Temp ≥ 95°C + Reloj CPU cayendo por debajo del 90%",
    diagnosis: "Thermal Throttling Severo",
    action: "Asegura ventilador en Full Speed en BIOS/MyASUS y baja PL1 en ThrottleStop (-4W) para estabilizar."
  },
  {
    pattern: "Temp < 88°C + Reloj cayendo con uso alto de juego",
    diagnosis: "Power Limit Throttling",
    action: "El disipador responde bien. Sube PL1 +4W en ThrottleStop TPL para mayor margen de reloj sostenido."
  },
  {
    pattern: "Uso GPU 3D ≈ 98-100% permanente",
    diagnosis: "GPU-Bound (Normal en Intel UHD 64EU)",
    action: "La GPU es el límite físico. Mantén 1280x960 4:3 y FSR en modo Rendimiento (valor 2 en video.txt)."
  },
  {
    pattern: "Uso GPU < 85% + Uso CPU alto",
    diagnosis: "CPU-Bound Leve / Interrupciones de fondo",
    action: "Cierra overlays de Steam/Discord, activa Modo Torneo (mata Explorer) y fija EPP=0 en ThrottleStop."
  },
  {
    pattern: "Línea plana en CSV, sin throttling y Temp < 85°C",
    diagnosis: "Punto Dulce de Calibración",
    action: "Configuración perfecta. Disfruta de CS2 con frametimes estables y máxima fluidez competitiva."
  }
];

export const realisticFpsBenchmarks = {
  stock: {
    label: "Configuración Stock (Sin Optimizar)",
    resolution: "1920x1080 Nativo (16:9)",
    avgFps: "30 - 45 FPS",
    fpsNumber: 38,
    onePercentLow: 22,
    frametimeMs: 26.3,
    temperatures: "85 - 93°C (Thermal Throttling severo)",
    status: "Injugable competitivamente: tirones continuos, desync de disparos y caídas a 15 FPS al tirar humos."
  },
  fase1Base: {
    label: "Fase 1: Base (BIOS + Windows + CS2 CFG)",
    resolution: "1280x960 (4:3 Estirado)",
    avgFps: "65 - 80 FPS",
    fpsNumber: 72,
    onePercentLow: 48,
    frametimeMs: 13.8,
    temperatures: "76 - 84°C",
    status: "Buen punto de partida: resolución optimizada y servicios de Windows recortados."
  },
  fase2Extrema: {
    label: "Fase 2: Modo Extremo (P-Cores + Explorer Killer + IDLEDISABLE)",
    resolution: "1280x960 + FSR Rendimiento",
    avgFps: "75 - 95 FPS",
    fpsNumber: 86,
    onePercentLow: 58,
    frametimeMs: 11.6,
    temperatures: "78 - 88°C",
    status: "Frametimes ultra planos: 400MB de VRAM liberados al matar Explorer y P-Cores bloqueados al 100%."
  },
  fase3GodMode: {
    label: "Fase 3: God Mode (ThrottleStop PL1 28W + Monitoreo CSV)",
    resolution: "1280x960 4:3 + FSR + EPP 0",
    avgFps: "85 - 110 FPS",
    fpsNumber: 98,
    onePercentLow: 66,
    frametimeMs: 9.8,
    temperatures: "74 - 82°C (Potencia sostenida sin caídas)",
    status: "Tope físico absoluto del PN64: cero oscilación térmica, 1% Lows consistentes sobre 65 FPS y respuesta instantánea."
  }
};

export const biosSettingsList = [
  {
    name: "DVMT Pre-Allocated (VRAM para Gráficos Integrados)",
    recommended: "512M o 1024M",
    isCritical: true,
    why: "¡EL AJUSTE MÁS CRÍTICO! Por defecto, la BIOS asigna solo 128 MB a la Intel UHD. Si no lo subes a 512M o 1024M, CS2 colapsa la memoria de video y se cierra o cae a 15 FPS."
  },
  {
    name: "Advanced > Power & Performance > Performance Mode",
    recommended: "Performance / Turbo",
    isCritical: true,
    why: "El PN64 viene configurado de fábrica en modo Silencioso/Eco (PL1 limitado a 15-20W). Este ajuste desbloquea el TDP completo del i3-1220P a 28-35W."
  },
  {
    name: "Fan Profile (Perfil del Ventilador de la BIOS)",
    recommended: "Full Speed / Performance",
    isCritical: true,
    why: "El chasis mini del PN64 se calienta rápido. Si el CPU toca los 92°C, baja su frecuencia de 4.4 GHz a 2.1 GHz por thermal throttling recortando los FPS a la mitad."
  },
  {
    name: "MyASUS (Dentro de Windows)",
    recommended: "Perfil de ventilador > Rendimiento completo",
    isCritical: true,
    why: "Sincroniza el control de velocidad de las aspas en Windows. Mantiene la temperatura entre 72°C y 80°C incluso en tiroteos largos."
  },
  {
    name: "Memoria Dual Channel (Verificar en CPU-Z)",
    recommended: "Canales = Dual (2x8 GB DDR4)",
    isCritical: false,
    why: "La gráfica Intel UHD comparte la memoria RAM del sistema. En Single Channel pierdes un 35% directo de rendimiento gráfico."
  },
  {
    name: "Espacio Libre en SSD NVMe",
    recommended: "Mínimo 80-100 GB libres",
    isCritical: false,
    why: "Los SSD NVMe usan una porción de celda SLC de alta velocidad. Si el disco se llena al 95%, la caché SLC desaparece y la carga de texturas genera tirones."
  },
  {
    name: "Cable Ethernet LAN (No WiFi)",
    recommended: "Conexión Cableada Directa",
    isCritical: false,
    why: "Las tarjetas WiFi en mini PCs presentan picos periódicos de latencia DPC causados por los modos de ahorro de energía inalámbricos."
  }
];

export const allTweaksList: TweakItem[] = [
  {
    id: "tw-affinity-15",
    name: "Afinidad a P-Cores 0-3 (Máscara 15 / 0x0F)",
    category: "processes",
    categoryLabel: "Procesos y CPU",
    impact: "Critico",
    description: "Fuerza a Counter-Strike 2 a ejecutarse en los 4 hilos de los núcleos de Alto Rendimiento (P-Cores 0 y 1 con HyperThreading).",
    technicalRationale: "El i3-1220P posee 2 P-Cores a 4.4 GHz y 8 E-Cores a 1.2 GHz. Si el planificador de Windows asigna el hilo principal de render a un E-Core, los FPS caen de 90 a 38 con stutters masivos.",
    commandSnippet: "Get-Process cs2 | % { $_.PriorityClass='High'; $_.ProcessorAffinity=15 }",
    enabledByDefault: true
  },
  {
    id: "tw-mpo-fix",
    name: "Desactivar Multi-Plane Overlay (MPO Fix Intel)",
    category: "gpu",
    categoryLabel: "GPU Intel UHD",
    impact: "Critico",
    description: "Añade OverlayTestMode=5 en DWM para corregir el parpadeo de pantalla y micro-tirones del controlador de gráficos Intel.",
    technicalRationale: "MPO causa conflictos en la composición de capas de DirectX en la Intel UHD compartida con Windows Desktop Window Manager.",
    commandSnippet: "reg add \"HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm\" /v OverlayTestMode /t REG_DWORD /d 5 /f",
    enabledByDefault: true
  },
  {
    id: "tw-tsc-timer",
    name: "Restaura Temporizador TSC a 4.0 GHz (Borra HPET)",
    category: "registry",
    categoryLabel: "Temporizadores del Kernel",
    impact: "Critico",
    description: "Elimina useplatformtick y useplatformclock en BCDedit, fijando disabledynamictick yes y tscsyncpolicy Enhanced.",
    technicalRationale: "El HPET de 14 MHz añade overhead de latencia en Alder Lake. El TSC nativo opera a 4.0 GHz reduciendo la latencia de entrada a casi cero.",
    commandSnippet: "bcdedit /deletevalue useplatformtick; bcdedit /set disabledynamictick yes; bcdedit /set tscsyncpolicy Enhanced",
    enabledByDefault: true
  },
  {
    id: "tw-hags",
    name: "Activar HAGS (Hardware Accelerated GPU Scheduling)",
    category: "gpu",
    categoryLabel: "GPU Intel UHD",
    impact: "Alto",
    description: "Configura HwSchMode = 2 y aumenta TdrDelay a 10 para una cola de dibujo eficiente sin reinicios de driver.",
    technicalRationale: "Permite a la GPU gestionar directamente su memoria y programación de fotogramas, aliviando la carga del procesador.",
    commandSnippet: "reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\" /v HwSchMode /t REG_DWORD /d 2 /f",
    enabledByDefault: true
  },
  {
    id: "tw-powerthrottling-off",
    name: "Desactivar Power Throttling de Windows",
    category: "cpu_power",
    categoryLabel: "Energía y Frecuencia",
    impact: "Critico",
    description: "Configura PowerThrottlingOff = 1 en el registro para evitar que Windows baje los P-Cores a 800 MHz durante tiroteos intensos.",
    technicalRationale: "Windows 11 intenta recortar el consumo de procesos en segundo plano o bajo picos térmicos aplicando limitación EcoQoS.",
    commandSnippet: "reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling\" /v PowerThrottlingOff /t REG_DWORD /d 1 /f",
    enabledByDefault: true
  },
  {
    id: "tw-win32priority",
    name: "Win32PrioritySeparation a 38 (0x26)",
    category: "registry",
    categoryLabel: "Planificador del Kernel",
    impact: "Alto",
    description: "Fija el quantum de tiempo del hilo en primer plano corto y variable con ratio 3:1.",
    technicalRationale: "Otorga preferencia máxima inmediata a la ventana de CS2 frente a cualquier servicio del sistema operativo, logrando respuesta de ratón 1:1.",
    commandSnippet: "reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl\" /v Win32PrioritySeparation /t REG_DWORD /d 38 /f",
    enabledByDefault: true
  },
  {
    id: "tw-nagle",
    name: "Desactivar Algoritmo de Nagle (TCPNoDelay)",
    category: "network",
    categoryLabel: "Red y Latencia",
    impact: "Critico",
    description: "Configura TcpAckFrequency=1, TCPNoDelay=1 y TcpDelAckTicks=0 en los adaptadores de red activos.",
    technicalRationale: "Elimina la demora de hasta 40 ms que introduce Windows al acumular paquetes TCP pequeños antes de enviarlos.",
    commandSnippet: "New-ItemProperty -Path $netPath -Name 'TCPNoDelay' -Value 1 -PropertyType DWord -Force",
    enabledByDefault: true
  },
  {
    id: "tw-defender-exclusions",
    name: "Exclusiones de Windows Defender para CS2 y Steam",
    category: "services",
    categoryLabel: "Seguridad y Rendimiento",
    impact: "Alto",
    description: "Añade las rutas de Steam y Counter-Strike 2 a la lista blanca de exclusiones de análisis en tiempo real.",
    technicalRationale: "Windows Defender analiza los archivos pak01.vpk y texturas mientras juegas, provocando tartamudeos severos al girar la cámara.",
    commandSnippet: "Add-MpPreference -ExclusionPath 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive'",
    enabledByDefault: true
  },
  {
    id: "tw-dwm-light",
    name: "DWM Light: Transparencias y Animaciones Desactivadas",
    category: "registry",
    categoryLabel: "Interfaz de Windows",
    impact: "Alto",
    description: "Desactiva EnableTransparency, animaciones de barra de tareas y efectos de ventanas.",
    technicalRationale: "En la Intel UHD sin VRAM discreta, cada capa de desenfoque y animación compite por el ancho de banda DDR4 disponible.",
    commandSnippet: "reg add \"HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\" /v EnableTransparency /t REG_DWORD /d 0 /f",
    enabledByDefault: true
  },
  {
    id: "tw-vbs-toggle",
    name: "Desactivar VBS / HVCI (Virtualization-Based Security)",
    category: "cpu_power",
    categoryLabel: "Hardware y Virtualización",
    impact: "Critico",
    description: "Deshabilita la integridad de código protegida por hipervisor para liberar entre 5% y 12% de potencia gráfica en Intel Alder Lake.",
    technicalRationale: "VBS ejecuta el kernel dentro de un hipervisor virtualizado que genera una penalización medible en iGPUs integradas.",
    commandSnippet: "bcdedit /set hypervisorlaunchtype off",
    enabledByDefault: false
  },
  {
    id: "tw-trim-nvme",
    name: "Habilitar TRIM en SSD NVMe PCIe 4.0",
    category: "disk",
    categoryLabel: "Almacenamiento NVMe",
    impact: "Alto",
    description: "Asegura DisableDeleteNotify = 0 y desactiva last access time para optimizar I/O.",
    technicalRationale: "Mantiene el SSD a su velocidad máxima de 5000+ MB/s limpiando bloques liberados en segundo plano.",
    commandSnippet: "fsutil behavior set DisableDeleteNotify 0; fsutil behavior set disablelastaccess 1",
    enabledByDefault: true
  },
  {
    id: "tw-fsr-resolution",
    name: "Resolución 1280x960 4:3 + FSR Rendimiento",
    category: "cs2",
    categoryLabel: "Ajustes de CS2",
    impact: "Critico",
    description: "Configura en video.txt la resolución recomendada con escalado FidelityFX Super Resolution en modo Rendimiento (valor 2).",
    technicalRationale: "Disminuye la carga geométrica y de sombreado en un 55% en la Intel UHD, desbloqueando tasas de más de 85 FPS estables.",
    commandSnippet: "\"setting.defaultres\" \"1280\"\n\"setting.defaultresheight\" \"960\"\n\"setting.fidelityfx_super_resolution\" \"2\"",
    enabledByDefault: true
  }
];

export const optimizationModules: OptimizationModule[] = [
  {
    id: "mod-01",
    index: "01",
    title: "Punto de Restauración & Seguridad",
    subtitle: "Reversibilidad total del sistema en 1 clic",
    category: "Sistema",
    tweaksCount: 2,
    highlight: "Checkpoint-Computer automático",
    description: "Genera una copia de seguridad del registro y configuración antes de cualquier cambio para que siempre puedas revertir con tranquilidad.",
    details: [
      "Habilita ComputerRestore en el disco C:",
      "Crea el punto 'PN64_V7_Antes_Boost' automáticamente",
      "Reversible en cualquier momento mediante RESTORE_TOTAL.bat"
    ],
    command: `Checkpoint-Computer -Description "PN64 V7" -RestorePointType "MODIFY_SETTINGS" -ErrorAction SilentlyContinue`
  },
  {
    id: "mod-02",
    index: "02",
    title: "Modo Bestia: P-Cores 0-3 & Prioridad Alta",
    subtitle: "Aislamiento contra los lentos E-Cores",
    category: "CPU & Procesos",
    tweaksCount: 6,
    highlight: "Afinidad mask 15 + High Priority",
    description: "Confinamiento estricto de Counter-Strike 2 a los núcleos P-Core a 4.4 GHz para evitar las caídas a 40 FPS que provocan los E-Cores.",
    details: [
      "Fija la máscara de afinidad 15 (hilos 0, 1, 2, 3)",
      "Establece PriorityClass en High para cs2.exe",
      "Pone a steam.exe en prioridad Idle para no interferir",
      "Cierra automáticamente Chrome, Discord, Spotify, Teams y OneDrive"
    ],
    command: `Get-Process cs2 -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass='High'; $_.ProcessorAffinity=[IntPtr]15 }`
  },
  {
    id: "mod-03",
    index: "03",
    title: "Modo Torneo Extremo (Explorer Killer)",
    subtitle: "Libera 300-500 MB de VRAM compartida",
    category: "GPU & Memoria",
    tweaksCount: 4,
    highlight: "+5-8 FPS netos para la Intel UHD",
    description: "Detiene el proceso explorer.exe antes de competir, eliminando el consumo de VRAM del escritorio y asignando el 100% de la GPU integrada a CS2.",
    details: [
      "Mata explorer.exe y ventanas en segundo plano",
      "Ahorra 300-500 MB de memoria de video compartida",
      "Restaura el escritorio con Ctrl+Shift+Esc > explorer.exe o desde la opción de restauración"
    ],
    command: `taskkill /F /IM explorer.exe 2>nul`
  },
  {
    id: "mod-04",
    index: "04",
    title: "Fix Timers TSC (Eliminación de HPET)",
    subtitle: "Latencia de entrada de 4.0 GHz nativa",
    category: "Kernel & Latencia",
    tweaksCount: 5,
    highlight: "TSC nativo sin useplatformtick",
    description: "Borra el parámetro obsoleto useplatformtick y activa disabledynamictick con tscsyncpolicy Enhanced en Alder Lake.",
    details: [
      "bcdedit /deletevalue useplatformtick",
      "bcdedit /deletevalue useplatformclock",
      "bcdedit /set disabledynamictick yes",
      "bcdedit /set tscsyncpolicy Enhanced"
    ],
    command: `bcdedit /deletevalue useplatformtick; bcdedit /set disabledynamictick yes; bcdedit /set tscsyncpolicy Enhanced`
  },
  {
    id: "mod-05",
    index: "05",
    title: "Boost Intel UHD + MPO Fix + HAGS",
    subtitle: "Solución a parpadeos y micro-cortes",
    category: "Gráficos Intel",
    tweaksCount: 8,
    highlight: "OverlayTestMode=5 + HwSchMode=2",
    description: "Desactiva el Multi-Plane Overlay problemático de Windows, habilita la aceleración por hardware HAGS y aumenta los tiempos de espera TDR.",
    details: [
      "OverlayTestMode = 5 (Corrige flicker en controladores Intel)",
      "HwSchMode = 2 (HAGS activo)",
      "TdrDelay = 10 y TdrDdiDelay = 10",
      "Limpieza de carpetas D3DSCache y shadercache de Steam"
    ],
    command: `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm" /v OverlayTestMode /t REG_DWORD /d 5 /f`
  },
  {
    id: "mod-06",
    index: "06",
    title: "Reducción de Latencia de Red TCP (Nagle OFF)",
    subtitle: "Registro de balas inmediato sin desync",
    category: "Red",
    tweaksCount: 12,
    highlight: "TCPNoDelay = 1 en todas las interfaces",
    description: "Desactiva la acumulación de paquetes pequeños y ajusta buffers de transmisión para que tus disparos se registren sin retraso.",
    details: [
      "TcpAckFrequency = 1 y TCPNoDelay = 1",
      "TcpDelAckTicks = 0",
      "MaxUserPort = 65534 y DefaultTTL = 64",
      "Vaciado de caché DNS y reinicio Winsock"
    ],
    command: `netsh int tcp set global rss=enabled autotuninglevel=normal timestamps=disabled`
  },
  {
    id: "mod-07",
    index: "07",
    title: "Debloat Quirúrgico & Desactivación de Telemetría",
    subtitle: "Limpieza limpia sin tocar drivers ni MyASUS",
    category: "Windows 11",
    tweaksCount: 25,
    highlight: "0% uso de CPU en reposo",
    description: "Elimina aplicaciones preinstaladas de ocio (TikTok, Solitaire, CandyCrush, Clipchamp) y desactiva tareas espía de Microsoft.",
    details: [
      "Elimina bloatware UWP de forma segura",
      "Deshabilita DiagTrack, MapsBroker y tareas de CEIP",
      "Respeta la tienda Microsoft Store y el software de ventiladores MyASUS"
    ],
    command: `Get-AppxPackage -AllUsers *TikTok* | Remove-AppxPackage; Set-Service DiagTrack -StartupType Disabled`
  },
  {
    id: "mod-08",
    index: "08",
    title: "VBS / HVCI Switcher (+5-12% FPS)",
    category: "Avanzado",
    subtitle: "Seguridad vs Máximos Fotogramas",
    tweaksCount: 4,
    highlight: "+8-14 FPS adicionales en Intel UHD",
    description: "Permite desactivar la seguridad basada en virtualización para exprimir el silicio o activarla si juegas títulos que requieran Vanguard/FaceIT.",
    details: [
      "Desactiva HypervisorEnforcedCodeIntegrity",
      "bcdedit /set hypervisorlaunchtype off",
      "Reversible en 1 clic cuando necesites máxima seguridad"
    ],
    command: `bcdedit /set hypervisorlaunchtype off`
  },
  {
    id: "mod-09",
    index: "09",
    title: "Optimización de Almacenamiento NVMe & TRIM",
    subtitle: "Carga de mapas en 4 segundos",
    category: "Disco",
    tweaksCount: 6,
    highlight: "TRIM PCIe 4.0 obligatorio",
    description: "Garantiza que el protocolo TRIM esté activo y limpia las descargas residuales de Windows Update y registros viejos.",
    details: [
      "fsutil behavior set DisableDeleteNotify 0",
      "Desactiva disablelastaccess para ahorrar operaciones de escritura",
      "Ejecuta desfragmentación de optimización TRIM (defrag C: /L /O)"
    ],
    command: `fsutil behavior set DisableDeleteNotify 0; defrag C: /L /O`
  },
  {
    id: "mod-10",
    index: "10",
    title: "CS2 Config: Autoexec & Video.txt Óptimos",
    subtitle: "1280x960 4:3 + FSR Rendimiento",
    category: "CS2 Engine",
    tweaksCount: 30,
    highlight: "FidelityFX Super Resolution en valor 2",
    description: "Instala los archivos autoexec.cfg y video.txt con la resolución competitiva y ajustes mínimos para una tasa de 75-110 FPS estables.",
    details: [
      "autoexec.cfg con rate 786432, cl_interp 0, engine_low_latency_sleep_after_client_tick true",
      "video.txt con sombreado bajo y FSR Rendimiento activado",
      "Parámetros de Steam: -novid -nojoy -console -high -threads 8 +fps_max 0 +mat_queue_mode 2 -freq 60 -dx11"
    ],
    command: `Steam: -novid -nojoy -console -high -threads 8 +fps_max 0 +mat_queue_mode 2 -freq 60 -dx11 +cl_forcepreload 1 -allow_third_party_software`
  }
];

export const generateLaunchOptionsString = (threads = 8): string => {
  return `-novid -nojoy -console -high -threads ${threads} +fps_max 0 +mat_queue_mode 2 -freq 60 -refresh 60 -dx11 +cl_forcepreload 1 -allow_third_party_software`;
};

export const generateAutoexecString = (options?: {
  showFps?: boolean;
  fov?: number;
}): string => {
  const showFps = options?.showFps ?? true;
  const fov = options?.fov ?? 68;

  return [
    '// ============================================================',
    '//  ASUS PN64 CS2 AUTOEXEC - V7 ULTIMATE COMPETITIVE EDITION',
    '//  Para: Intel Core i3-1220P (P-Cores 4.4GHz) + Intel UHD 64EU',
    '//  Ruta: Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\autoexec.cfg',
    '// ============================================================',
    '',
    '// ── RENDIMIENTO Y LIMITES DE FPS ──',
    'fps_max 0',
    `cl_showfps ${showFps ? '1' : '0'}`,
    'fps_max_ui 60',
    '',
    '// ── RED Y TRANSMISIÓN DE PAQUETES (SUB-TICK) ──',
    'rate 786432',
    'cl_interp 0',
    'cl_interp_ratio 1',
    'cl_updaterate 128',
    'cl_cmdrate 128',
    'cl_predict 1',
    'cl_predictweapons 1',
    '',
    '// ── OPTIMIZACIÓN VISUAL PARA iGPU INTEL UHD ──',
    'r_dynamic 0',
    'r_drawtracers_firstperson 0',
    'r_eyegloss 0',
    'r_shadows 0',
    '',
    '// ── ENTRADA DE RATÓN 1:1 ──',
    'm_rawinput 1',
    'm_mouse_accel1 0',
    'm_mouse_accel2 0',
    'm_customaccel 0',
    '',
    '// ── INTERFAZ LIMPIA Y LATENCIA DEL MOTOR ──',
    'gameinstructor_enable 0',
    'cl_autohelp 0',
    'cl_showloadout 0',
    'engine_low_latency_sleep_after_client_tick true',
    '',
    '// ── VIEWMODEL ──',
    `viewmodel_fov ${fov}`,
    'viewmodel_offset_x 2.5',
    'viewmodel_offset_y -2',
    'viewmodel_offset_z -1.5',
    'viewmodel_presetpos 3',
    '',
    '// ── GUARDADO Y CONFIRMACIÓN ──',
    'host_writeconfig',
    'echo ">>> ASUS PN64 CS2 V7 ULTIMATE CARGADO CON EXITO <<<"'
  ].join('\r\n');
};

export const generateVideoTxtString = (): string => {
  return [
    '"VideoConfig"',
    '{',
    '\t"setting.cpu_level"\t\t"0"',
    '\t"setting.gpu_level"\t\t"0"',
    '\t"setting.mat_antialias"\t\t"0"',
    '\t"setting.mat_aaquality"\t\t"0"',
    '\t"setting.mat_forceaniso"\t\t"0"',
    '\t"setting.mat_vsync"\t\t"0"',
    '\t"setting.mat_triplebuffered"\t\t"0"',
    '\t"setting.mat_grain_scale_override"\t\t"1"',
    '\t"setting.gpu_mem_level"\t\t"1"',
    '\t"setting.mem_level"\t\t"2"',
    '\t"setting.mat_queue_mode"\t\t"2"',
    '\t"setting.csm_quality_level"\t\t"0"',
    '\t"setting.mat_software_aa_strength"\t\t"0"',
    '\t"setting.mat_motion_blur_enabled"\t\t"0"',
    '\t"setting.fullscreen"\t\t"1"',
    '\t"setting.defaultres"\t\t"1280"',
    '\t"setting.defaultresheight"\t\t"960"',
    '\t"setting.aspectratiomode"\t\t"1"',
    '\t"setting.nowindowborder"\t\t"0"',
    '\t"setting.msaa_samples"\t\t"0"',
    '\t"setting.fidelityfx_super_resolution"\t\t"2"',
    '\t"setting.vsync"\t\t"0"',
    '\t"setting.shadows"\t\t"0"',
    '\t"setting.reflections"\t\t"0"',
    '}'
  ].join('\r\n');
};

export interface UltraModule {
  id: string;
  num: number;
  filename: string;
  title: string;
  badge: string;
  category: 'Interrupts & Kernel' | 'GPU & DirectX' | 'Storage & Sistema' | 'Juego & Engine' | 'Herramientas';
  impact: string;
  whyItWorks: string;
  description: string;
  keyTweaks: string[];
}

export const ultraModulesList: UltraModule[] = [
  {
    id: "mod-16",
    num: 16,
    filename: "16_INTERRUPT_MSI_MODE.bat",
    title: "MSI Mode + IRQ Affinity Map",
    badge: "-5 a -20ms Input Lag",
    category: "Interrupts & Kernel",
    impact: "Elimina la contención de interrupciones en el bus PCI",
    whyItWorks: "Cambia todos los dispositivos de interrupciones por línea (Level-Triggered) a Message Signaled Interrupts (MSI) y confina la GPU y el ratón a la CPU 0, red a CPU 1 y NVMe a CPU 2.",
    description: "Configura MSI en HDC, NET, DISPLAY, SYSTEM, MEDIA y USB con temporizador de alta precisión a 0.5ms mediante timeBeginPeriod(1) de winmm.dll.",
    keyTweaks: [
      "MSISupported = 1 en todos los dispositivos PCI",
      "IRQ Affinity: GPU + USB Input a CPU 0 (P-Core más rápido)",
      "Network (Ethernet/WiFi) a CPU 1 (separado del ratón)",
      "NVMe SSD a CPU 2 para I/O independiente",
      "Temporizador forzado a 0.5ms con servicio WinMM",
      "DPC Latency minimizado con DpcWatchdogTimeoutMs = 0"
    ]
  },
  {
    id: "mod-17",
    num: 17,
    filename: "17_KERNEL_CPU_ULTRA.bat",
    title: "Kernel CPU Ultra & Mitigaciones OFF",
    badge: "+15-30% CPU Performance",
    category: "Interrupts & Kernel",
    impact: "Máximo rendimiento mononúcleo en los 2 P-Cores",
    whyItWorks: "Desactiva las mitigaciones de predicción de bifurcación (Spectre, Meltdown, Retpoline, CFG, HVCI) y fija la caché L2/L3 en 12800 KB con C-States en 0.",
    description: "Optimiza la gestión de memoria del kernel (IoPageLockLimit, LargePages), prioriza programas en primer plano con Win32PrioritySeparation = 38 y bloquea la frecuencia al 100%.",
    keyTweaks: [
      "DisablePagingExecutive = 1 y IoPageLockLimit = 512MB",
      "Win32PrioritySeparation = 38 (quantum corto y alto para juegos)",
      "L2 y L3 Data Cache fijadas en 12800 KB para i3-1220P",
      "Mitigaciones Spectre/Meltdown/Retpoline apagadas",
      "C-States en C0 (sin reposo de núcleos durante juego)",
      "Limpieza y desactivación de registros de eventos de Windows"
    ]
  },
  {
    id: "mod-18",
    num: 18,
    filename: "18_GPU_DRIVER_CORE.bat",
    title: "Intel Iris Xe / UHD Driver Core Ultra",
    badge: "+15-30% GPU Throughput",
    category: "GPU & DirectX",
    impact: "Exprime el silicio gráfico 64EU al límite térmico seguro",
    whyItWorks: "Fuerza PerfLevel al máximo, asigna 1024 MB de memoria dedicada DVMT, desactiva el clock gating y apaga el estrangulamiento por software del driver.",
    description: "Configura el driver Intel Graphics a bajo nivel: VSync, AA y filtrado anisotrópico en OFF forzado, Shader Cache a 256 MB y WDDM en modo Preemptive.",
    keyTweaks: [
      "DVMT DedicatedSegmentSize = 1024 MB en Intel GMM",
      "PerfLevel y PowerMizer forzados a Máximo Rendimiento",
      "ForceGpuCoreClock = 1 y ForceGpuMemClock = 1",
      "Shader Cache ampliado a 256 MB con pre-compilación",
      "Command Buffer GPU ampliado a 64 KB",
      "WDDM HwSchMode = 1 y TDR Timeout desactivado (sin cuelgues)"
    ]
  },
  {
    id: "mod-19",
    num: 19,
    filename: "19_DIRECTX_RUNTIME_PRO.bat",
    title: "DirectX Runtime Pro & Vulkan ICD",
    badge: "1 Frame Max Latency",
    category: "GPU & DirectX",
    impact: "Minimiza la sobrecarga entre CS2 y el controlador gráfico",
    whyItWorks: "Limpia todas las capas de validación y depuración de D3D11/D3D12, habilita el tearing en DXGI y prioriza la GPU a nivel kernel (GpuPriority = 8).",
    description: "Optimiza la pila de DirectX 11, configura el ICD de Intel Vulkan y desactiva DirectStorage (incompatible con la iGPU) para evitar consumos invisibles.",
    keyTweaks: [
      "D3D11 Multithreaded Rendering (D3D11MTEnable = 1)",
      "DXGI MaxFrameLatency = 1 (mínimo input lag de presentación)",
      "DXGI AllowTearing = 1 para menor latencia de refresco",
      "GpuPriority = 8 y SchedulingPriority = 1 en GraphicsDrivers",
      "Pre-compilación de shaders Direct3D activada",
      "DirectStorage desactivado para eliminar sobrecarga en iGPU"
    ]
  },
  {
    id: "mod-20",
    num: 20,
    filename: "20_IO_STORAGE_SCHEDULER.bat",
    title: "I/O & Storage Scheduler NVMe",
    badge: "-50 a -200ms Carga Mapas",
    category: "Storage & Sistema",
    impact: "Carga fluida de texturas sin micro-stuttering de lectura",
    whyItWorks: "Configura el SSD NVMe en estado de energía PS0 con WriteBack, desactiva compresión NTFS en la carpeta de CS2 y eleva la prioridad I/O a nivel 3.",
    description: "Optimiza el subsistema de archivos de Windows: deshabilita nombres cortos 8.3, apaga la actualización de última fecha de acceso y libera espacio con Dism.",
    keyTweaks: [
      "NVMe WriteBack Cache y modo de energía PS0 (sin ahorro)",
      "TRIM activo con DisableDeleteNotify = 0",
      "Prioridad de E/S en cs2.exe configurada a IoPriority = 3",
      "Descompresión compact /u en los archivos de CS2",
      "Superfetch / SysMain y Prefetch apagados en NVMe",
      "LargePageMinimum habilitado para memoria contigua"
    ]
  },
  {
    id: "mod-21",
    num: 21,
    filename: "21_STRIPPING_WINDOWS.bat",
    title: "Stripping Windows (Gaming OS Mode)",
    badge: "-30-50 Procesos / +400MB RAM",
    category: "Storage & Sistema",
    impact: "Convierte Windows 11 en un entorno ligero exclusivo para juegos",
    whyItWorks: "Elimina paquetes UWP preinstalados innecesarios, desinstala OneDrive de raíz y bloquea más de 55 servicios en segundo plano.",
    description: "Deshabilita componentes redundantes (Hyper-V, Fax, XPS, Windows Media Player) y desactiva telemetría, sugerencias y comprobaciones de espacio.",
    keyTweaks: [
      "40+ apps UWP desinstaladas para todos los usuarios",
      "13 features pesadas eliminadas (Hyper-V, Sandbox, WSL)",
      "OneDrive completamente desinstalado y carpetas eliminadas",
      "55+ servicios innecesarios deshabilitados",
      "Modo Gaming activado en el Explorador de Windows",
      "Crea backup de respaldo en backup_services.reg"
    ]
  },
  {
    id: "mod-22",
    num: 22,
    filename: "22_MONITORING_TOOLS.bat",
    title: "Suite de Herramientas de Monitoreo",
    badge: "Diagnóstico en Tiempo Real",
    category: "Herramientas",
    impact: "Verificación científica de cuellos de botella y salud térmica",
    whyItWorks: "Genera utilidades autónomas para monitorizar el porcentaje de reloj, latencia DPC, temperaturas ACPI y memoria RAM disponible.",
    description: "Crea en disco PERF_MONITOR.bat, SYSTEM_DIAGNOSTIC.bat, DPC_LATENCY_CHECKER.bat y FPS_COUNTER.ps1 con salida coloreada.",
    keyTweaks: [
      "PERF_MONITOR.bat: Bucle cada 3s de CPU, RAM, GPU y temperaturas",
      "SYSTEM_DIAGNOSTIC.bat: Reporte completo de hardware y servicios",
      "DPC_LATENCY_CHECKER.bat: Muestreo de tiempos de procesador",
      "FPS_COUNTER.ps1: Contadores de rendimiento con alertas de color"
    ]
  },
  {
    id: "mod-23",
    num: 23,
    filename: "23_CS2_ENGINE_PRO.bat",
    title: "CS2 Source 2 Engine Pro & Autoexec Ultra",
    badge: "200+ Comandos Competitivos",
    category: "Juego & Engine",
    impact: "Exprime la tasa de refresco y estabilidad de tick en el servidor",
    whyItWorks: "Configura el motor Source 2 para renderizado multihilo de huesos y follaje, minimiza partículas de humo y activa las 3 opciones de lanzamiento.",
    description: "Genera el autoexec_ULTRA.cfg definitivo con 200 comandos, config.cfg competitivo y limpia la caché de shaders dañados de Steam.",
    keyTweaks: [
      "Renderizado cl_threaded_bone_setup y leaf_system = 1",
      "Eliminación total de sombras dinámicas y agua cara",
      "Optimización de volumen de partículas de humo",
      "Parámetros de lanzamiento con opciones DX11, Vulkan y Max FPS",
      "Copia automática de la mejor opción al portapapeles",
      "Limpieza de carpetas de caché y shaders residuales"
    ]
  },
  {
    id: "mod-24",
    num: 24,
    filename: "24_AUTO_PRE_GAME.bat",
    title: "Lanzador Automático Pre-Game (1-Click)",
    badge: "Todo-en-Uno Antes de Jugar",
    category: "Juego & Engine",
    impact: "Prepara el PC al 100% de recursos en 5 segundos y lanza CS2",
    whyItWorks: "Cierra 20 aplicaciones que consumen ciclos en segundo plano, vacía memoria en espera, fuerza temporizador a 0.5ms y arranca el juego con los flags óptimos.",
    description: "El script que debes ejecutar cada día antes de iniciar partida: limpia memoria, detiene servicios no esenciales y arranca CS2 con Vulkan y -high.",
    keyTweaks: [
      "Mata navegadores (Chrome, Edge), Discord, Spotify, Teams y Office",
      "Limpieza de memoria de procesos con WorkingSet menor a 50MB",
      "Timer resolution forzado a 0.5ms mediante WinMM",
      "Plan de energía al 100% en todos los núcleos",
      "Detiene temporalmente WSearch, SysMain, BITS y DiagTrack",
      "Lanza CS2 automáticamente vía Steam con parámetros Ultra"
    ]
  },
  {
    id: "mod-25",
    num: 25,
    filename: "25_RAM_DISK_GAME.bat",
    title: "RAM Disk para Shaders (Experimental)",
    badge: "-50 a -80% Cargas / 0ms Latencia",
    category: "Storage & Sistema",
    impact: "Almacenamiento ultra veloz en memoria DDR4 a 25.6 GB/s",
    whyItWorks: "Crea una unidad virtual de 2GB en los 16GB de RAM para hospedar la caché de shaders de Intel y temporales, eliminando accesos al disco.",
    description: "Guía y scripts automatizados de integración (RAM_DISK_SETUP.bat y STEAM_RAM_DISK_INTEGRATION.bat) compatibles con ImDisk Toolkit.",
    keyTweaks: [
      "Configuración recomendada de 2048 MB (deja 14GB para sistema y CS2)",
      "Redirección de variables TEMP y TMP a la unidad R:\\",
      "Copia y redirección del shadercache de Steam a memoria RAM",
      "Cero latencia de escritura para micro-archivos temporales"
    ]
  }
];

export const extendedLaunchOptions = [
  {
    id: "dx11",
    label: "Opción 1: DirectX 11 (Estable y Compatible)",
    badge: "Estabilidad 100%",
    params: "-novid -nojoy -high -fullscreen -nointro -nobrowser -no-browser -nohltv -noaudiothread +fps_max 0 +mat_queue_mode 2 +mat_disable_fancy_blending 1 +mat_reduceparticles 1 +rate 786432 +cl_updaterate 128 +cl_cmdrate 128 +exec autoexec.cfg -threads 8 -d3d11 -high",
    description: "Excelente estabilidad general, compatible con todos los drivers de Intel UHD/Iris Xe sin fallos gráficos."
  },
  {
    id: "vulkan",
    label: "Opción 2: Vulkan (Recomendado Intel Alder Lake)",
    badge: "Recomendado Intel Xe",
    params: "-novid -nojoy -high -fullscreen -nointro -nobrowser -no-browser -nohltv -noaudiothread +fps_max 0 +mat_queue_mode 2 +mat_disable_fancy_blending 1 +mat_reduceparticles 1 +rate 786432 +cl_updaterate 128 +cl_cmdrate 128 +exec autoexec.cfg -threads 8 -vulkan -high",
    description: "Menor sobrecarga de llamadas de dibujo de CPU (draw calls) y mejor utilización de la memoria compartida en la arquitectura Intel Xe."
  },
  {
    id: "maxfps",
    label: "Opción 3: MAX FPS Absoluto (Competición Torneo)",
    badge: "Máximo Rendimiento",
    params: "-novid -nojoy -high -fullscreen -nointro -nobrowser -no-browser -nohltv -noaudiothread -noworkshop -nopreload +fps_max 0 +mat_queue_mode 2 +mat_disable_fancy_blending 1 +mat_reduceparticles 1 +mat_compressedtextures 1 +rate 786432 +cl_updaterate 128 +cl_cmdrate 128 +cl_interp 0.015625 +cl_interp_ratio 1 +exec autoexec.cfg -threads 8 -vulkan -high -nosteamoverlay -disable_d3d9ex",
    description: "Desactiva la superposición de Steam, pre-compresión de texturas y reduce la interpolación al mínimo de 1 tick (0.015625s) para latencia de red de torneo."
  }
];

