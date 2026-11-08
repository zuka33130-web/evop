/**
 * RYZER CORTEX ULTRA - Tauri IPC Bridge
 * Puente de Comunicación Local Segura entre React y el Motor Nativo (Tauri Rust / C#)
 */



export interface TauriExecutionResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
}

/**
 * Detecta si la aplicación está corriendo dentro de la ventana de escritorio de Tauri
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Invoca un script o comando de PowerShell a través del puente IPC de Tauri en Rust.
 * En entorno Web Preview, realiza fallback transparente al motor C# en 127.0.0.1:48120.
 */
export async function invokePowerShell(
  script: string,
  requiresAdmin = false
): Promise<TauriExecutionResult> {
  const startTime = performance.now();

  if (isTauriEnvironment()) {
    try {
      // Invocación nativa IPC de Tauri
      const { invoke } = (window as any).__TAURI__.tauri;
      const result = await invoke('execute_powershell_script', {
        script,
        requiresAdmin
      }) as TauriExecutionResult;

      return result;
    } catch (err: any) {
      return {
        success: false,
        exit_code: -1,
        stdout: '',
        stderr: err?.toString() || 'Error en invocación de IPC Tauri',
        execution_time_ms: Math.round(performance.now() - startTime)
      };
    }
  }

  return {
    success: false,
    exit_code: -1,
    stdout: '',
    stderr: 'PowerShell solo está disponible en Tauri. En el navegador usa las operaciones tipadas del motor C#.',
    execution_time_ms: Math.round(performance.now() - startTime)
  };
}
