<# Safe package smoke test: authentication, frontend and read-only API. No system tweaks. #>
[CmdletBinding()]
param([string]$PackageDir = "")
$ErrorActionPreference = 'Stop'
if (-not $PackageDir) { $PackageDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist-native\desktop-win-x64' }
$executable = Join-Path $PackageDir 'engine\EvoNativeEngine.exe'
if (-not (Test-Path $executable)) { throw 'Motor publicado no encontrado.' }
$priorToken = $env:EVO_ENGINE_TOKEN
$priorPort = $env:EVO_ENGINE_PORT
$env:EVO_ENGINE_TOKEN = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:EVO_ENGINE_PORT = '48129'
$headers = @{ 'X-Evo-Session' = $env:EVO_ENGINE_TOKEN }
$base = 'http://127.0.0.1:48129'
$process = $null
try {
    $process = Start-Process -FilePath $executable -WorkingDirectory (Split-Path -Parent $executable) -PassThru -WindowStyle Hidden
    $ready = $false
    for ($i = 0; $i -lt 80; $i++) {
        if ($process.HasExited) { throw 'El motor terminó al iniciar.' }
        try {
            $status = Invoke-RestMethod "$base/api/status" -Headers $headers -TimeoutSec 2
            if ($status.isReady) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'El motor no respondió a la petición autenticada.' }
    $unauthorized = Invoke-WebRequest "$base/api/status" -SkipHttpErrorCheck
    if ($unauthorized.StatusCode -ne 401) { throw 'API accesible sin token.' }
    $staticUnauthorized = Invoke-WebRequest "$base/" -SkipHttpErrorCheck
    if ($staticUnauthorized.StatusCode -ne 401) { throw 'Frontend accesible sin token.' }
    $foreign = Invoke-WebRequest "$base/api/status" -Headers @{ 'X-Evo-Session' = $env:EVO_ENGINE_TOKEN; Origin = 'http://127.0.0.1:3000' } -SkipHttpErrorCheck
    if ($foreign.StatusCode -ne 403) { throw 'Se aceptó un origen ajeno con token de escritorio.' }
    $frontend = Invoke-WebRequest "$base/" -Headers $headers
    if ($frontend.Content -notmatch 'id="root"' -or -not $frontend.Headers['Content-Security-Policy']) { throw 'Frontend/CSP no publicados correctamente.' }
    $catalog = Invoke-RestMethod "$base/api/operations" -Headers $headers
    if ($catalog.Count -lt 1) { throw 'Catálogo vacío.' }
    # Resolve recovery/cleanup DI without applying system changes.
    Invoke-WebRequest "$base/api/cleanup/receipts" -Headers $headers | Out-Null
    $cleanupProgress = Invoke-RestMethod "$base/api/cleanup/progress" -Headers $headers
    if ($cleanupProgress.action -ne 'idle') { throw 'Limpieza inesperadamente activa al iniciar.' }
    $cleanupCancel = Invoke-RestMethod "$base/api/cleanup/cancel" -Method Post -Headers $headers
    if ($cleanupCancel.accepted) { throw 'Se canceló una limpieza inexistente.' }
    $refusedRecovery = Invoke-WebRequest "$base/api/recovery/all" -Method Post -Headers $headers -ContentType 'application/json' -Body '{"confirmation":"INVALID"}' -SkipHttpErrorCheck
    if ($refusedRecovery.StatusCode -ne 400) { throw 'Recuperación global no exige confirmación.' }
    $refusedClean = Invoke-WebRequest "$base/api/clean/apply" -Method Post -Headers $headers -SkipHttpErrorCheck
    if ($refusedClean.StatusCode -ne 400) { throw 'La limpieza heredada sin selección no está bloqueada.' }
    if (Test-Path (Join-Path $PackageDir 'engine/Scripts/Invoke-EvoClean.ps1')) { throw 'Se publicó un script de borrado heredado.' }
    # Verify new experiment service DI can be resolved without running an optimization.
    Invoke-WebRequest "$base/api/benchmarks/experiments/active" -Headers $headers | Out-Null
    Invoke-RestMethod "$base/api/desktop/shutdown" -Method Post -Headers $headers | Out-Null
    if (-not $process.WaitForExit(15000)) { throw 'El motor no se detuvo mediante el endpoint autenticado.' }
    Write-Host 'PASS: paquete Windows, API autenticada, rechazo de orígenes, React/CSP y cierre controlado. Sin cambios de sistema.'
}
finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    $env:EVO_ENGINE_TOKEN = $priorToken
    $env:EVO_ENGINE_PORT = $priorPort
}
