use base64::Engine;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
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
struct OpenFilesPayload {
    file_paths: Vec<String>,
}

/// Payload for clipboard copy result event
#[derive(Clone, serde::Serialize)]
struct ClipboardCopyResult {
    success: bool,
    error: Option<String>,
    version: u32,
}

// Store pending CLI files to open
struct PendingFiles {
    paths: Mutex<Vec<String>>,
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
        let result = tokio::task::spawn_blocking(move || copy_png_to_clipboard(&image_base64))
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
                    eprintln!("arboard clipboard failed: {}, trying wl-copy fallback", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to create clipboard: {}, trying wl-copy fallback", e);
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
fn get_pending_files(state: State<PendingFiles>) -> Vec<String> {
    state.paths.lock().unwrap().drain(..).collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            println!("Single instance triggered with args: {:?}", argv);
            // Collect file paths from arguments (skip flags)
            let file_paths: Vec<String> = argv
                .iter()
                .skip(1) // Skip the first argument (usually the executable)
                .filter(|arg| !arg.starts_with('-'))
                .map(|arg| resolve_file_path(arg))
                .collect();

            if !file_paths.is_empty() {
                let _ = app.emit("open-files", OpenFilesPayload { file_paths });
            }
        }))
        .invoke_handler(tauri::generate_handler![
            queue_clipboard_copy_base64,
            get_pending_files
        ])
        .setup(|app| {
            // Create PendingFiles with CLI paths so state is available when frontend calls get_pending_files
            let initial_paths: Vec<String> = if cfg!(not(mobile)) {
                use tauri_plugin_cli::CliExt;
                let mut paths = Vec::new();
                if let Ok(matches) = app.cli().matches() {
                    if let Some(args) = matches.args.get("file") {
                        match &args.value {
                            serde_json::Value::String(s) => {
                                paths.push(resolve_file_path(s));
                            }
                            serde_json::Value::Array(arr) => {
                                for value in arr {
                                    if let Some(s) = value.as_str() {
                                        paths.push(resolve_file_path(s));
                                    }
                                }
                            }
                            _ => {}
                        };
                        if !paths.is_empty() {
                            println!("CLI file paths (resolved) for frontend: {:?}", paths);
                        }
                    }
                }
                paths
            } else {
                Vec::new()
            };

            app.manage(PendingFiles {
                paths: Mutex::new(initial_paths),
            });

            // Setup tray icon
            let open_app = MenuItem::with_id(app, "open_app", "Open OmniMark", true, None::<&str>)?;
            let open_file = MenuItem::with_id(app, "open_file", "Open File", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_app, &open_file, &quit])?;

            let _tray = TrayIconBuilder::new()
                .tooltip("OmniMark")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "open_app" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "open_file" => {
                        let _ = app.emit("tray-open-file", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click { .. } => {
                        // Left click: show/restore window
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            match event {
                // When window is focused, ensure webview has keyboard focus
                // This fixes hotkeys not working after alt-tab or window switching
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::Focused(true),
                    ..
                } => {
                    if label == "main" {
                        if let Some(window) = app.get_webview_window("main") {
                            // Focus the webview to ensure keyboard events are captured
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        });
}
