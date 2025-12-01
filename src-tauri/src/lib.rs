use base64::{engine::general_purpose, Engine as _};
use image::RgbaImage;
use std::io::Cursor;
use std::io::Write;
use tauri::Manager;
use xcap::Monitor;

#[derive(serde::Serialize)]
struct MonitorCapture {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    image_base64: String,
}

#[tauri::command]
async fn capture_screen() -> Result<Vec<MonitorCapture>, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let mut captures = Vec::new();

    for monitor in monitors {
        let x = monitor.x();
        let y = monitor.y();
        let width = monitor.width();
        let height = monitor.height();

        let image = monitor.capture_image().map_err(|e| e.to_string())?;

        // Convert RgbaImage to PNG bytes
        let mut bytes: Vec<u8> = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        let base64_str = general_purpose::STANDARD.encode(&bytes);

        captures.push(MonitorCapture {
            x,
            y,
            width,
            height,
            image_base64: format!("data:image/png;base64,{}", base64_str),
        });
    }

    Ok(captures)
}

#[tauri::command]
async fn copy_to_clipboard(base64_image: String) -> Result<(), String> {
    let base64_clean = base64_image.replace("data:image/png;base64,", "");
    let bytes = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let width = rgba.width() as usize;
    let height = rgba.height() as usize;
    let pixels = rgba.into_raw();

    let image_data = arboard::ImageData {
        width,
        height,
        bytes: std::borrow::Cow::Owned(pixels),
    };

    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_image(image_data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn save_image(path: String, base64_image: String) -> Result<(), String> {
    let base64_clean = base64_image.replace("data:image/png;base64,", "");
    let bytes = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    use base64::{engine::general_purpose, Engine as _};
    use image::RgbaImage;
    use std::io::Cursor;
    use std::io::Write;
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
        AppHandle, Emitter, Manager,
    };
    use tauri_plugin_global_shortcut::{
        Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
    };
    use xcap::Monitor;

    #[derive(serde::Serialize)]
    struct MonitorCapture {
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        image_base64: String,
    }

    #[tauri::command]
    async fn capture_screen() -> Result<Vec<MonitorCapture>, String> {
        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        let mut captures = Vec::new();

        for monitor in monitors {
            let x = monitor.x();
            let y = monitor.y();
            let width = monitor.width();
            let height = monitor.height();

            let image = monitor.capture_image().map_err(|e| e.to_string())?;

            // Convert RgbaImage to PNG bytes
            let mut bytes: Vec<u8> = Vec::new();
            image
                .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
                .map_err(|e| e.to_string())?;

            let base64_str = general_purpose::STANDARD.encode(&bytes);

            captures.push(MonitorCapture {
                x,
                y,
                width,
                height,
                image_base64: format!("data:image/png;base64,{}", base64_str),
            });
        }

        Ok(captures)
    }

    #[tauri::command]
    async fn copy_to_clipboard(base64_image: String) -> Result<(), String> {
        let base64_clean = base64_image.replace("data:image/png;base64,", "");
        let bytes = general_purpose::STANDARD
            .decode(base64_clean)
            .map_err(|e| e.to_string())?;
        let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
        let rgba = img.to_rgba8();
        let width = rgba.width() as usize;
        let height = rgba.height() as usize;
        let pixels = rgba.into_raw();

        let image_data = arboard::ImageData {
            width,
            height,
            bytes: std::borrow::Cow::Owned(pixels),
        };

        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.set_image(image_data).map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    async fn save_image(path: String, base64_image: String) -> Result<(), String> {
        let base64_clean = base64_image.replace("data:image/png;base64,", "");
        let bytes = general_purpose::STANDARD
            .decode(base64_clean)
            .map_err(|e| e.to_string())?;
        let mut file = std::fs::File::create(path).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            // Trigger capture before showing
            let _ = window.emit("start_capture", ());
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_tray_icon::init())
        .setup(|app| {
            // Initialize Tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show qpaste", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        toggle_window(app);
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
                        toggle_window(app);
                    }
                })
                .build(app)?;

            // Initialize Global Shortcut (F1)
            let app_handle = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            if shortcut.matches(Modifiers::empty(), Code::F1) {
                                toggle_window(&app_handle);
                            }
                        }
                    })
                    .build(),
            )?;

            // Register F1
            let shortcut = Shortcut::new(Some(Modifiers::empty()), Code::F1);
            app.global_shortcut().register(shortcut)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture_screen,
            copy_to_clipboard,
            save_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
