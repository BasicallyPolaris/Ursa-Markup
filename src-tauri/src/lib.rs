use base64::Engine;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Resolve path to absolute so frontend readFile works regardless of CWD.
fn resolve_file_path(path: &str) -> String {
    let p = Path::new(path);
    if p.is_absolute() {
        p.canonicalize()
            .ok()
            .and_then(|pb| pb.to_str().map(String::from))
            .unwrap_or_else(|| path.to_string())
    } else {
        std::env::current_dir()
            .ok()
            .and_then(|cwd| cwd.join(p).canonicalize().ok())
            .and_then(|pb| pb.to_str().map(String::from))
            .unwrap_or_else(|| path.to_string())
    }
}

#[derive(Clone, serde::Serialize)]
struct OpenFilePayload {
    file_path: String,
}

/// Payload for clipboard copy result event
#[derive(Clone, serde::Serialize)]
struct ClipboardCopyResult {
    success: bool,
    error: Option<String>,
    version: u32,
}

// Store pending CLI file to open
struct PendingFile {
    path: Mutex<Option<String>>,
}

/// Queue a clipboard copy operation from base64 PNG data
/// This returns immediately and processes the copy in the background
/// Emits "clipboard-copy-result" event when complete
#[tauri::command]
async fn queue_clipboard_copy_base64(
    app: AppHandle,
    image_base64: String,
    version: u32,
) -> Result<(), String> {
    // Spawn a background task - returns immediately to frontend
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            copy_png_to_clipboard(&image_base64)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))
        .and_then(|r| r);

        // Emit result back to frontend for toast notification
        let _ = app.emit(
            "clipboard-copy-result",
            ClipboardCopyResult {
                success: result.is_ok(),
                error: result.err(),
                version,
            },
        );
    });

    Ok(())
}

/// Copy PNG data (base64 encoded) to clipboard
fn copy_png_to_clipboard(image_base64: &str) -> Result<(), String> {
    use arboard::{Clipboard, ImageData};
    use image::GenericImageView;
    use std::borrow::Cow;

    // Decode base64 to PNG bytes
    let png_data = base64::engine::general_purpose::STANDARD
        .decode(image_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Decode PNG to get RGBA data for arboard
    let img =
        image::load_from_memory(&png_data).map_err(|e| format!("Failed to decode PNG: {}", e))?;

    let (width, height) = img.dimensions();
    let rgba_data = img.to_rgba8().into_raw();

    // Try arboard first (cross-platform clipboard library)
    match Clipboard::new() {
        Ok(mut clipboard) => {
            let img_data = ImageData {
                width: width as usize,
                height: height as usize,
                bytes: Cow::Owned(rgba_data),
            };

            match clipboard.set_image(img_data) {
                Ok(()) => return Ok(()),
                Err(e) => {
                    eprintln!(
                        "arboard clipboard failed: {}, trying wl-copy fallback",
                        e
                    );
                }
            }
        }
        Err(e) => {
            eprintln!(
                "Failed to create clipboard: {}, trying wl-copy fallback",
                e
            );
        }
    }

    // Fallback: Use wl-copy for Wayland (pass PNG directly - no re-encoding needed!)
    let mut child = Command::new("wl-copy")
        .arg("--type")
        .arg("image/png")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn wl-copy: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin
            .write_all(&png_data)
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

#[tauri::command]
fn get_pending_file(state: State<PendingFile>) -> Option<String> {
    state.path.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            println!("Single instance triggered with args: {:?}", argv);
            // Check if a file path was passed as argument
            if argv.len() > 1 {
                let file_path = &argv[1];
                // Validate it's not a flag (doesn't start with -)
                if !file_path.starts_with('-') {
                    let resolved = resolve_file_path(file_path);
                    let _ = app.emit(
                        "open-file",
                        OpenFilePayload {
                            file_path: resolved,
                        },
                    );
                }
            }
        }))
        .invoke_handler(tauri::generate_handler![
            queue_clipboard_copy_base64,
            get_pending_file
        ])
        .setup(|app| {
            // Create PendingFile with CLI path so state is available when frontend calls get_pending_file
            let initial_path: Option<String> = if cfg!(not(mobile)) {
                use tauri_plugin_cli::CliExt;
                let mut path = None;
                if let Ok(matches) = app.cli().matches() {
                    if let Some(args) = matches.args.get("file") {
                        path = match &args.value {
                            serde_json::Value::String(s) => Some(resolve_file_path(s)),
                            serde_json::Value::Array(arr) => arr
                                .first()
                                .and_then(|v| v.as_str())
                                .map(|s| resolve_file_path(s)),
                            _ => None,
                        };
                        if let Some(ref p) = path {
                            println!("CLI file path (resolved) for frontend: {}", p);
                        }
                    }
                }
                path
            } else {
                None
            };

            app.manage(PendingFile {
                path: Mutex::new(initial_path),
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
