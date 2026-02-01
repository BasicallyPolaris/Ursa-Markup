use base64::Engine;
use std::process::Command;

#[tauri::command]
fn copy_image_wayland(image_base64: String) -> Result<(), String> {
    // Decode base64
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(image_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Try wl-copy for Wayland
    let mut child = Command::new("wl-copy")
        .arg("--type")
        .arg("image/png")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn wl-copy: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin
            .write_all(&decoded)
            .map_err(|e| format!("Failed to write to wl-copy: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for wl-copy: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "wl-copy failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![copy_image_wayland])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
