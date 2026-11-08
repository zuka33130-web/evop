// Prevents additional console window on Windows in release, do NOT remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;

// Estructura estandarizada de respuesta IPC entre Rust y React
#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub execution_time_ms: u64,
}

// Flag de Windows para ocultar ventanas de comandos (CREATE_NO_WINDOW = 0x08000000)
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Comando de Tauri invocado desde React para ejecutar scripts de PowerShell
/// de forma invisible y con elevación UAC cuando sea requerido.
#[tauri::command]
async fn execute_powershell_script(
    script: String,
    requires_admin: Option<bool>,
) -> Result<ExecutionResult, String> {
    let start = std::time::Instant::now();
    let is_admin = requires_admin.unwrap_or(false);

    // Preparar el comando de PowerShell según si requiere elevación UAC o no
    let output_result = if is_admin {
        // Ejecución UAC invisible usando Start-Process con -Verb RunAs
        let encoded_script = base64_encode(&script);
        let wrapper = format!(
            "$s = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{}')); Invoke-Expression $s",
            encoded_script
        );

        Command::new("powershell.exe")
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-Command")
            .arg(format!("Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"{}\"' -Wait", wrapper))
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    } else {
        // Ejecución estándar invisible
        Command::new("powershell.exe")
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-Command")
            .arg(&script)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    };

    let elapsed = start.elapsed().as_millis() as u64;

    match output_result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let exit_code = output.status.code().unwrap_or(-1);

            Ok(ExecutionResult {
                success: output.status.success(),
                exit_code,
                stdout,
                stderr,
                execution_time_ms: elapsed,
            })
        }
        Err(err) => Err(format!("Error al invocar proceso de PowerShell: {}", err)),
    }
}

/// Helper para codificar en Base64 seguro para evitar conflictos de comillas en PowerShell
fn base64_encode(input: &str) -> String {
    use std::fmt::Write;
    let mut result = String::new();
    let bytes = input.as_bytes();
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        let _ = write!(result, "{}", CHARS[((triple >> 18) & 63) as usize] as char);
        let _ = write!(result, "{}", CHARS[((triple >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            let _ = write!(result, "{}", CHARS[((triple >> 6) & 63) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            let _ = write!(result, "{}", CHARS[(triple & 63) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![execute_powershell_script])
        .run(tauri::generate_context!())
        .expect("Error al inicializar la aplicación de escritorio Tauri");
}
