use base64::Engine;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, Wry,
};

struct TrayMenuState {
    toggle_item: Mutex<Option<MenuItem<Wry>>>,
}

fn set_tray_text(app: &AppHandle, text: &str) {
    let state = app.state::<TrayMenuState>();
    let guard = state.toggle_item.lock().unwrap();
    if let Some(item) = guard.as_ref() {
        let _ = item.set_text(text);
    }
}

#[tauri::command]
fn minimize_to_tray(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        set_tray_text(&app, "Open Ursa Markup");
    }
}

#[tauri::command]
fn restore_from_tray(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        set_tray_text(&app, "Hide Ursa Markup");
    }
}

// Logic to toggle window visibility (used by the MENU item only)
fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(true) {
            let _ = window.hide();
            set_tray_text(app, "Open Ursa Markup");
        } else {
            let _ = window.show();
            let _ = window.set_focus();
                            set_tray_text(app, "Hide Ursa Markup");
        }
    }
}

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

#[derive(Clone, serde::Serialize)]
struct ClipboardCopyResult {
    success: bool,
    error: Option<String>,
    version: u32,
}

struct PendingFiles {
    paths: Mutex<Vec<String>>,
}

#[tauri::command]
async fn queue_clipboard_copy_base64(
    app: AppHandle,
    image_base64: String,
    version: u32,
) -> Result<(), String> {
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || copy_png_to_clipboard(&image_base64))
            .await
            .map_err(|e| format!("Task join error: {}", e))
            .and_then(|r| r);
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

fn copy_png_to_clipboard(image_base64: &str) -> Result<(), String> {
    use arboard::{Clipboard, ImageData};
    use image::GenericImageView;
    use std::borrow::Cow;

    let png_data = base64::engine::general_purpose::STANDARD
        .decode(image_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    let img =
        image::load_from_memory(&png_data).map_err(|e| format!("Failed to decode PNG: {}", e))?;
    let (width, height) = img.dimensions();
    let rgba_data = img.to_rgba8().into_raw();

    match Clipboard::new() {
        Ok(mut clipboard) => {
            let img_data = ImageData {
                width: width as usize,
                height: height as usize,
                bytes: Cow::Owned(rgba_data),
            };
            if clipboard.set_image(img_data).is_ok() {
                return Ok(());
            }
        }
        Err(_) => {}
    }

    let mut child = Command::new("wl-copy")
        .arg("--type")
        .arg("image/png")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("{}", e))?;
    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin.write_all(&png_data).map_err(|e| format!("{}", e))?;
    }
    child.wait().map_err(|e| format!("{}", e))?;
    Ok(())
}

#[tauri::command]
fn get_pending_files(state: State<PendingFiles>) -> Vec<String> {
    state.paths.lock().unwrap().drain(..).collect()
}

#[tauri::command]
fn exit_app() {
    std::process::exit(0);
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
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let file_paths: Vec<String> = argv
                .iter()
                .skip(1)
                .filter(|arg| !arg.starts_with('-'))
                .map(|arg| resolve_file_path(arg))
                .collect();
            if !file_paths.is_empty() {
                let _ = app.emit("open-files", OpenFilesPayload { file_paths });
            }
        }))
        .invoke_handler(tauri::generate_handler![
            minimize_to_tray,
            restore_from_tray,
            queue_clipboard_copy_base64,
            get_pending_files,
            exit_app
        ])
        .setup(|app| {
            // Initial state: App is open, so menu says "Hide"
            let toggle_i = MenuItem::with_id(app, "toggle", "Hide Ursa Markup", true, None::<&str>)?;
            let open_file_i = MenuItem::with_id(app, "open_file", "Open File", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&toggle_i, &open_file_i, &sep, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("ursamarkup-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .title("Ursa Markup")
                .tooltip("Ursa Markup")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => std::process::exit(0),
                    "toggle" => toggle_window(app),
                    "open_file" => {
                        let _ = app.emit("tray-open-file", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
            set_tray_text(app, "Hide Ursa Markup");
                        }
                    }
                })
                .build(app)?;

            // Store the MenuItem in state so we can update its text later
            app.manage(TrayMenuState {
                toggle_item: Mutex::new(Some(toggle_i)),
            });

            let initial_paths: Vec<String> = if cfg!(not(mobile)) {
                use tauri_plugin_cli::CliExt;
                let mut paths = Vec::new();
                if let Ok(matches) = app.cli().matches() {
                    if let Some(args) = matches.args.get("file") {
                        match &args.value {
                            serde_json::Value::String(s) => paths.push(resolve_file_path(s)),
                            serde_json::Value::Array(arr) => {
                                for v in arr {
                                    if let Some(s) = v.as_str() {
                                        paths.push(resolve_file_path(s));
                                    }
                                }
                            }
                            _ => {}
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
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::Focused(true),
                ..
            } = event
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            }
        });
}
