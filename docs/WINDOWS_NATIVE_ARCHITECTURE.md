# EVOOPTIMIZER — ARQUITECTURA DE ESCRITORIO WINDOWS 11 & MOTOR NATIVO C#

## 1. Resumen de la Arquitectura

EVOOPTIMIZER se estructura como una aplicación de optimización híbrida de alto rendimiento:

- **Capa Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (puerto 3000).
- **Capa Motor Nativo**: C# .NET 8 Web API (`src-native/EvoNativeEngine`) enlazado estrictamente a `http://127.0.0.1:48120` (Loopback Only).
- **Capa de Comunicación IPC Local**: Servicio `nativeBridge.ts` con tipado estricto, gestión de ciclo de vida, detección de conexión y tolerancia a fallos.
- **Seguridad**:
  - **Regla 5**: Cero comandos arbitrarios. La API expone únicamente endpoints tipados de solo lectura y acciones con lista blanca (`diagnostics.system_report`, `diagnostics.refresh`).
  - **Regla 6**: Detección de privilegios administrativos mediante `WindowsPrincipal` (`IsElevated: true/false`). Las operaciones de diagnóstico funcionan sin necesidad de elevación.
  - **Regla 8**: Servicio `BackupManager` preparado para generar snapshots y restauraciones en `%LocalAppData%\EvoOptimizer\Backups`.
  - **Sin Telemetría ni Nube**: Todo el procesamiento se realiza 100% de manera local en el equipo del usuario.

---

## 2. Inventario de la Primera Etapa

### A. Archivos Creados
1. `/src-native/EvoNativeEngine/EvoNativeEngine.csproj`: Configuración de compilación de .NET 8 con soporte para WMI (`System.Management`).
2. `/src-native/EvoNativeEngine/Program.cs`: Servidor Kestrel con enlace exclusivo a Loopback (127.0.0.1:48120), políticas de CORS local y endpoints REST tipados.
3. `/src-native/EvoNativeEngine/Models/SystemHardwareReport.cs`: Modelos de datos DTO para OS, CPU, RAM, GPU, Almacenamiento y Estado del Proceso.
4. `/src-native/EvoNativeEngine/Services/DiagnosticsService.cs`: Motor de diagnóstico real de solo lectura que consulta:
   - Nombre, versión y build de Windows 11 (`Win32_OperatingSystem` + `Environment`).
   - Procesador, núcleos físicos, hilos lógicos y frecuencia máxima (`Win32_Processor`).
   - Memoria RAM total, libre y porcentaje en uso (`GlobalMemoryStatusEx` Win32 API).
   - Controladores gráficos GPU, memoria VRAM y versión de driver (`Win32_VideoController`).
   - Espacio disponible, formato y tipo en cada unidad de disco (`System.IO.DriveInfo`).
5. `/src-native/EvoNativeEngine/Services/SecurityService.cs`: Verificador de privilegios de Administrador y validador de acciones autorizadas.
6. `/src-native/EvoNativeEngine/Services/BackupManager.cs`: Administrador de snapshots y restauración de valores originales.
7. `/src-native/EvoNativeEngine/appsettings.json`: Configuración local del motor.
8. `/src/services/nativeBridge.ts`: Cliente TypeScript, tipos DTO y React Hook `useNativeBridge` con sondeo seguro.
9. `/src/components/NativeDiagnosticsCard.tsx`: Componente de visualización en tiempo real del hardware detectado por el motor C# o guía de conexión.
10. `/scripts/Start-EvoEngine.ps1`: Script PowerShell para compilar y ejecutar el motor en Windows.
11. `/scripts/Run-EvoDesktop.bat`: Lanzador de 1-clic que inicia tanto el motor C# como el frontend.
12. `/scripts/Publish-Windows.ps1`: Script de publicación como binario único independiente (`win-x64`).

### B. Archivos Modificados & Funcionalidades Reutilizadas
1. `/src/components/Navbar.tsx`: Añadida pestaña de Diagnóstico C# y badge indicador de conexión en tiempo real (`Motor C# Conectado` / `Desconectado`).
2. `/src/components/HardwareProfileHeader.tsx`: Vinculado con el motor C#. Muestra los datos reales del sistema con botón para alternar entre perfil teórico y hardware real.
3. `/src/App.tsx`: Integración del hook `useNativeBridge`, botón en hero dashboard y renderizado de la pestaña de diagnóstico nativo.
4. Módulos y componentes intactos reutilizados:
   - `QuickRunTerminal`: Se conservan los 15 modos Cortex y scripts descargables.
   - `ModulesExplorer`: Se conservan los 110 tweaks clasificados.
   - `FpsCalculator`, `AutoexecBuilder`, `BiosChecklist`, `FilesExporter`, `ScientificLab`, `ExtremeGodMode`.

### C. Funcionalidades Pendientes para Siguientes Etapas
- Empaquetador nativo Tauri / WebView2 wrapper (.msi o instalador de escritorio con ventana nativa).
- Implementación progresiva de tweaks individuales en C# con permisos de Administrador validados caso a caso.
- Creación de puntos de restauración de Windows nativos (`Checkpoint-Computer` / System Restore API) y copias del Registro antes de aplicar modificaciones.

---

## 3. Instrucciones de Compilación y Ejecución en Windows 11

### Prerrequisitos
- Windows 11 (cualquier edición).
- .NET 8.0 SDK ([Descarga oficial de Microsoft](https://dotnet.microsoft.com/download/dotnet/8.0)).
- Node.js 20+ y npm.

### Paso 1: Clonar o descargar el repositorio
```powershell
git clone https://github.com/zuka33130-web/Evo_optimizer22.git
cd Evo_optimizer22
npm install
```

### Paso 2: Iniciar el motor nativo C#
En una ventana de PowerShell o Terminal:
```powershell
.\scripts\Start-EvoEngine.ps1
```
O directamente con el CLI de .NET:
```powershell
dotnet run --project src-native/EvoNativeEngine
```
*Salida esperada:*
```
=================================================
EVOOPTIMIZER Native Engine - Windows 11 Optimization Bridge
Escuchando en: http://127.0.0.1:48120
Seguridad: Modo de solo lectura activado (Regla 5)
=================================================
```

### Paso 3: Iniciar la interfaz de usuario
En otra terminal:
```bash
npm run dev
```
Abre tu navegador en `http://localhost:3000`.

### Paso 4: Verificación
- Observa la barra de navegación: el indicador cambiará a **"C# Conectado"** con un punto verde intermitente.
- Haz clic en **"Diagnóstico C#"**: verás el reporte en vivo con los nombres reales de tu CPU, memoria RAM física disponible, GPU con driver y el espacio libre exacto en cada uno de tus discos duros.
