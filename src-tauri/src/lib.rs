use base64::{engine::general_purpose, Engine as _};
use std::io::Cursor;
use std::io::Write;
use std::sync::Mutex;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;
use xcap::Monitor;

#[derive(Clone, Copy, PartialEq, Debug)]
enum ImageQuality {
    High,
    Medium,
    Low,
}

struct QualityMenuItems {
    high: CheckMenuItem<Wry>,
    medium: CheckMenuItem<Wry>,
    low: CheckMenuItem<Wry>,
}

struct AppState {
    quality: Mutex<ImageQuality>,
    menu_items: Mutex<Option<QualityMenuItems>>,
}

#[derive(serde::Serialize)]
struct MonitorCapture {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_factor: f32,
    image_base64: String,
}

#[tauri::command]
async fn capture_screen(state: tauri::State<'_, AppState>) -> Result<Vec<MonitorCapture>, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let mut captures = Vec::new();
    let quality = *state.quality.lock().unwrap();

    for monitor in monitors {
        let x = monitor.x();
        let y = monitor.y();
        let scale_factor = monitor.scale_factor();

        let image = monitor.capture_image().map_err(|e| e.to_string())?;
        let width = image.width();
        let height = image.height();

        println!(
            "Monitor: x={}, y={}, scale={}, image={}x{}",
            x, y, scale_factor, width, height
        );

        let mut bytes: Vec<u8> = Vec::new();
        let mime_type;

        match quality {
            ImageQuality::High => {
                image
                    .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
                    .map_err(|e| e.to_string())?;
                mime_type = "image/png";
            }
            ImageQuality::Medium => {
                let mut cursor = Cursor::new(&mut bytes);
                let mut encoder =
                    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 75);
                encoder
                    .encode(
                        image.as_raw(),
                        image.width(),
                        image.height(),
                        image::ColorType::Rgba8.into(),
                    )
                    .map_err(|e| e.to_string())?;
                mime_type = "image/jpeg";
            }
            ImageQuality::Low => {
                let mut cursor = Cursor::new(&mut bytes);
                let mut encoder =
                    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 50);
                encoder
                    .encode(
                        image.as_raw(),
                        image.width(),
                        image.height(),
                        image::ColorType::Rgba8.into(),
                    )
                    .map_err(|e| e.to_string())?;
                mime_type = "image/jpeg";
            }
        }

        let base64_str = general_purpose::STANDARD.encode(&bytes);

        captures.push(MonitorCapture {
            x,
            y,
            width,
            height,
            scale_factor,
            image_base64: format!("data:{};base64,{}", mime_type, base64_str),
        });
    }

    Ok(captures)
}

#[tauri::command]
async fn copy_to_clipboard(base64_image: String) -> Result<(), String> {
    // Handle both png and jpeg prefixes
    let base64_clean = if base64_image.starts_with("data:image/png;base64,") {
        base64_image.replace("data:image/png;base64,", "")
    } else {
        base64_image.replace("data:image/jpeg;base64,", "")
    };

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
    let base64_clean = if base64_image.starts_with("data:image/png;base64,") {
        base64_image.replace("data:image/png;base64,", "")
    } else {
        base64_image.replace("data:image/jpeg;base64,", "")
    };

    let bytes = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn log_msg(msg: String) {
    println!("[FRONTEND] {}", msg);
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            // Trigger capture before showing
            let _ = window.emit("start_capture", ());
            // Window will be shown by frontend after capture is done
        }
    }
}

fn update_quality_menu(app: &AppHandle, quality: ImageQuality) {
    let state = app.state::<AppState>();
    let guard = state.menu_items.lock().unwrap();
    if let Some(menu_items) = guard.as_ref() {
        let _ = menu_items
            .high
            .set_checked(matches!(quality, ImageQuality::High));
        let _ = menu_items
            .medium
            .set_checked(matches!(quality, ImageQuality::Medium));
        let _ = menu_items
            .low
            .set_checked(matches!(quality, ImageQuality::Low));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--flag1", "--flag2"])))
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState {
            quality: Mutex::new(ImageQuality::High),
            menu_items: Mutex::new(None),
        })
        .setup(|app| {
            // Initialize store
            let _ = app.store("settings.json");

            // Initialize Global Shortcut (Alt+Q and F1)
            let app_handle = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, event| {
                        println!("Shortcut triggered: {:?} {:?}", shortcut, event.state);
                        if event.state == ShortcutState::Pressed {
                            if shortcut.matches(Modifiers::ALT, Code::KeyQ) {
                                println!("Alt+Q matched, toggling window");
                                toggle_window(&app_handle);
                            }
                            if shortcut.matches(Modifiers::empty(), Code::F1) {
                                println!("F1 matched, toggling window");
                                toggle_window(&app_handle);
                            }
                        }
                    })
                    .build(),
            )?;

            // Register Alt+Q and F1
            let shortcut_alt_q = Shortcut::new(Some(Modifiers::ALT), Code::KeyQ);
            let shortcut_f1 = Shortcut::new(None, Code::F1);
            app.global_shortcut().register(shortcut_alt_q)?;
            app.global_shortcut().register(shortcut_f1)?;

            // System Tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;

            let quality_high =
                CheckMenuItem::with_id(app, "quality_high", "High", true, true, None::<&str>)?;
            let quality_medium =
                CheckMenuItem::with_id(app, "quality_medium", "Medium", true, false, None::<&str>)?;
            let quality_low =
                CheckMenuItem::with_id(app, "quality_low", "Low", true, false, None::<&str>)?;

            let quality_menu = Submenu::with_items(
                app,
                "Quality",
                true,
                &[&quality_high, &quality_medium, &quality_low],
            )?;

            // Store menu items in state
            {
                let state = app.state::<AppState>();
                *state.menu_items.lock().unwrap() = Some(QualityMenuItems {
                    high: quality_high.clone(),
                    medium: quality_medium.clone(),
                    low: quality_low.clone(),
                });
            }

            let menu = Menu::with_items(app, &[&show_i, &settings_i, &quality_menu, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        toggle_window(app);
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("settings") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quality_high" => {
                        let state = app.state::<AppState>();
                        *state.quality.lock().unwrap() = ImageQuality::High;
                        update_quality_menu(app, ImageQuality::High);
                    }
                    "quality_medium" => {
                        let state = app.state::<AppState>();
                        *state.quality.lock().unwrap() = ImageQuality::Medium;
                        update_quality_menu(app, ImageQuality::Medium);
                    }
                    "quality_low" => {
                        let state = app.state::<AppState>();
                        *state.quality.lock().unwrap() = ImageQuality::Low;
                        update_quality_menu(app, ImageQuality::Low);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } => {
                        let app = tray.app_handle();
                        toggle_window(app);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture_screen,
            copy_to_clipboard,
            save_image,
            log_msg
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
