# EVOOPTIMIZER — código fuente editable

Proyecto completo de la aplicación actual: **React/TypeScript + motor C#/.NET 8 + shell Windows WPF/WebView2**. La interfaz y funciones actuales se conservan. El ZIP de fuentes no es un paquete de EXE/DLL ni requiere descompilar nada.

## Requisitos de desarrollo en Windows

- Windows x64.
- Visual Studio 2022 actualizado, con las cargas **Desarrollo de escritorio de .NET** y **ASP.NET y desarrollo web**, y SDK **.NET 8**; o VS Code con C# Dev Kit y SDK .NET 8 instalado.
- Node.js 22 LTS y npm. Para reproducir las dependencias frontend del CI: **Bun 1.4.4**, usando `bun.lock`.
- Microsoft Edge WebView2 Evergreen Runtime para ejecutar la aplicación de escritorio.
- Acceso a los registros de paquetes para restaurar las dependencias. No se incluyen `node_modules`, paquetes NuGet descargados, SDKs ni runtimes de terceros dentro del ZIP; se incluyen sus declaraciones en `package.json`, `bun.lock` y todos los `.csproj`. No es una distribución de compilación offline.
- PowerShell 7 para ejecutar el smoke test publicado (`Test-EvoDesktopPackage.ps1`).

## Abrir y modificar

Extraer **toda** la carpeta `EVOOPTIMIZER` del ZIP, no archivos sueltos.

### Visual Studio

Abrir `EVOOPTIMIZER.sln`. Contiene los tres proyectos de la aplicación actual:

1. `EvoDesktop`: shell WPF/WebView2, sin reescribir la interfaz React.
2. `EvoNativeEngine`: API local autenticada y operaciones Windows.
3. `EvoNativeEngine.Tests`: ejecutable de pruebas, incluidas las de archivos reales de EvoClean.

Restaurar NuGet y compilar en Debug o Release. Los archivos React se editan en `src/`; el build de la solución compila los proyectos .NET, **no sustituye** el build de Vite ni el empaquetado del frontend. Para ejecutar la aplicación completa usar el script de publicación indicado más abajo; abrir directamente un shell sin su motor/`wwwroot` empaquetados no equivale al paquete completo.

### VS Code

Abrir la carpeta raíz (o `EVOOPTIMIZER.code-workspace`). Usar las terminales de esa carpeta para los comandos siguientes. C# Dev Kit puede cargar `EVOOPTIMIZER.sln`; TypeScript y React se editan directamente.

## Restaurar, compilar y probar

Desde la raíz del proyecto, en Windows:

```powershell
# Frontend: misma instalación reproducible que CI
bun install --frozen-lockfile
npm run lint
npm run build

# Restaurar y compilar todos los proyectos .NET actuales
dotnet restore .\EVOOPTIMIZER.sln
dotnet build .\EVOOPTIMIZER.sln --configuration Release

# Ejecutar las pruebas nativas (no son un proyecto xUnit: se ejecutan con dotnet run)
dotnet run --project .\src-native\EvoNativeEngine.Tests --configuration Release

# Pruebas de interfaz
npx playwright install chromium
npm run test:e2e
```

Si no se dispone de Bun, `npm install` restaura a partir de `package.json`; puede resolver versiones diferentes dentro de sus rangos. Para reproducir el proyecto tal como se validó, preferir Bun y el lock incluido. Los paquetes NuGet/versiones están en cada `.csproj` y se restauran con `dotnet restore`.

Las pruebas nativas realizan operaciones de archivo/HKCU en fixtures aislados y una prueba sobre un archivo único enviado a la papelera real de Windows. No vacían la papelera completa ni aplican presets de optimización del equipo. Consultar `docs/SMART_CLEANUP_ADVISOR.md` para alcance y límites.

## Generar la aplicación Windows completa

Después de restaurar dependencias:

```powershell
.\scripts\Publish-EvoDesktop.ps1
# Verificar el paquete (PowerShell 7)
.\scripts\Test-EvoDesktopPackage.ps1
# Ejecutar
.\dist-native\desktop-win-x64\EvoDesktop.exe
```

El script compila React y publica el shell + motor .NET autocontenidos en `dist-native/desktop-win-x64/`, con el frontend servido desde `engine/wwwroot`. Mantener **toda esa carpeta junta**. Para publicar nuevamente, limpiar el directorio de salida generado o indicar un directorio nuevo:

```powershell
.\scripts\Publish-EvoDesktop.ps1 -OutputDir .\dist-native\mi-compilacion
```

El paquete ejecutable requiere WebView2 Runtime; no requiere Node ni SDK .NET en el equipo de destino. Los permisos administrativos siguen siendo necesarios solo para las operaciones que los exigen; el shell no implementa elevación selectiva automática.

## Desarrollo React y motor local

En dos terminales locales de Windows:

```powershell
# Terminal 1
dotnet run --project .\src-native\EvoNativeEngine
# Terminal 2
npm run dev
```

Abrir `http://localhost:3000`. Vite reenvía `/api` al motor en loopback. El modo standalone de desarrollo sin `EVO_ENGINE_TOKEN` no está autenticado: **no exponer su puerto ni desplegar el motor públicamente**. El paquete desktop administra su propio token/origen local. Una interfaz web remota no controla Windows por sí sola.

PresentMon es una herramienta externa opcional para las capturas reales de FPS; no se inventan resultados cuando falta. Configurar `EVO_PRESENTMON_PATH` según `docs/FRAME_STABILITY_ENGINE.md`.

## Contenido completo y código heredado

- `src/`, `public/`, `index.html`: interfaz actual React/TypeScript, estilos y assets.
- `src-native/`: todo el código C#, XAML, manifests, `.csproj`, configuración y pruebas.
- `tests/`, `scripts/`, `.github/`: pruebas, publicación y CI.
- `package.json`, `bun.lock`, configuraciones Vite/TypeScript/Playwright: herramientas y dependencias frontend.
- `docs/`: arquitectura, recuperación, EvoClean, medición y límites.
- `src-tauri/`, `src-native/EvoWpfApp/` y scripts históricos: se incluyen **porque ya forman parte del repositorio**, sin omitirlos ni crear copias. Son antecedentes y **no** se usan para compilar la aplicación actual; por eso no se añaden como un segundo shell a la solución activa. No ejecutar scripts históricos/agresivos como sustituto de los motores actuales con respaldo.

Los documentos históricos pueden describir entregas anteriores; consultar primero `docs/WINDOWS_DESKTOP.md`, `docs/SMART_CLEANUP_ADVISOR.md` y `docs/VERIFIABLE_WINDOWS_STAGE.md`. No se incluyen cachés, credenciales, `.git`, backups personales, resultados de pruebas ni binarios generados. El ZIP contiene un manifiesto con las rutas y SHA-256 de todos sus archivos de proyecto para comprobar su integridad.
