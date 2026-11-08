# EVO Desktop: React + C#/.NET 8 + WebView2

## Diseño

`EvoDesktop.exe` (WPF, .NET 8) aloja WebView2 y arranca **su propio** `engine/EvoNativeEngine.exe`. El motor sirve el frontend compilado desde `engine/wwwroot` y las API en el mismo origen local `http://127.0.0.1:48120`. No se requiere Vite/Node en el PC de destino.

No es una reescritura de React ni un segundo motor de optimización. Los proyectos antiguos `EvoWpfApp` y `src-tauri` permanecen como código heredado y no se usan en este paquete.

## Publicar

En Windows, con Node, dependencias del frontend y SDK .NET 8 instalados:

```powershell
npm install
.\scripts\Publish-EvoDesktop.ps1
```

El repositorio usa bun.lock; para instalación reproducible: `bun install --frozen-lockfile` con Bun 1.4.4. El script genera `dist-native/desktop-win-x64/`. Copiar **la carpeta completa**, no solo el EXE. Si se vuelve a publicar, elegir un OutputDir nuevo para no mezclar assets de versiones anteriores.

```text
EvoDesktop.exe
[dependencias autocontenidas .NET/WebView2]
engine/
  EvoNativeEngine.exe
  Scripts/Invoke-EvoClean.ps1
  wwwroot/index.html
  wwwroot/assets/...
```

El equipo de destino necesita Windows x64 y **Microsoft Edge WebView2 Evergreen Runtime**. Si falta, se informa el error; no se descarga un instalador de manera silenciosa. El paquete .NET es autocontenido, no necesita SDK ni Node. PresentMon sigue siendo una dependencia externa opcional configurada con EVO_PRESENTMON_PATH antes de iniciar EvoDesktop.

Esta entrega produce un **paquete portátil**, no un MSI, actualizador ni binario firmado. La firma, instalador y distribución deben completarse antes de distribución general.

## Inicio y cierre

El shell espera a que el motor responda autenticado antes de navegar. No se conecta a una instancia ajena ni reutiliza un proceso que ya estaba escuchando. Solo una instancia del motor por usuario; si hay otra o el puerto está ocupado, se muestra error.

Al cerrar se advierte que los ajustes **permanecen aplicados**: cerrar no restaura Windows. El shell solicita el cierre autenticado, espera cinco segundos y, como último recurso, termina el árbol del proceso que él creó. Finalizar una operación/captura abruptamente puede dejar cambios parciales; conservar/restaurar backups. Detener operaciones antes de cerrar.

## Privilegios

El manifest usa `asInvoker`: ni la UI ni el motor se elevan automáticamente. Diagnóstico y cambios de usuario pueden funcionar; los módulos que requieren administrador siguen rechazados por el motor. Esta entrega **no implementa elevación UAC selectiva** ni un servicio privilegiado. No se presenta como una solución completa para HKLM en modo estándar. No se recomienda ejecutar una interfaz web completa como administrador; la separación de un broker mínimo privilegiado es un paso futuro.

## Comunicación local y aislamiento

- Token criptográfico nuevo por lanzamiento (32 bytes), entregado al hijo por entorno, nunca por URL ni JavaScript ni logs.
- WebView2 recibe una cookie de sesión HttpOnly/SameSite Strict y el cliente nativo su propia cookie. La API admite también `X-Evo-Session` para pruebas/herramientas autorizadas; no se debe guardar el token en archivos.
- El motor valida token mediante comparación de tiempo constante, origen exacto en escritorio y Host loopback para reducir riesgos de CSRF/rebinding. Se protegen tanto API como assets.
- Shell bloquea navegación fuera de su origen, host objects, mensajes al host, permisos y devtools. Enlaces HTTPS de documentación permitida se abren en el navegador externo, no en la vista privilegiada.
- CSP local, no cache de respuestas ni referrer; se retiró la dependencia de Google Fonts para permitir uso offline. Los estilos inline siguen permitidos porque React/gráficos los usan.
- No se protege frente a malware local que ya pueda leer memoria/entorno del mismo usuario. Un XSS en el frontend del mismo origen seguiría pudiendo invocar API: cookie HttpOnly no sustituye prevención de XSS.

Sin `EVO_ENGINE_TOKEN`, el motor conserva **modo standalone/desarrollo local sin autenticación**, con advertencia. No exponer/proxificar su puerto. En ese modo el shutdown del shell está deshabilitado. La preview remota de Arena no tiene acceso transparente al motor local autenticado.

## Validación

CI publica el paquete Windows y ejecuta `scripts/Test-EvoDesktopPackage.ps1` (PowerShell 7): inicia únicamente el motor publicado, comprueba API/React autenticados, 401 sin token, 403 con origen ajeno, CSP, resolución DI del experimento y cierre controlado. No aplica tweaks.

La compilación y el smoke test **no verifican visualmente WebView2**, descargas de archivos ni UAC. Pruebas manuales pendientes: abrir en una sesión interactiva Windows con/sin Runtime, comprobar navegación/exports offline, cierre durante captura, puerto ocupado y todas las pantallas. Las pruebas de ETW y mejoras de FPS siguen pendientes en hardware real.
