// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    Manager,
    Position,
    PhysicalPosition,
    Size,
    PhysicalSize,
    WebviewWindow,
};

use std::process::Command;

/// Get the scale factor for the monitor
fn get_scale_factor(window: &WebviewWindow) -> f64 {
    window.current_monitor()
        .unwrap_or(None)
        .map(|m| m.scale_factor())
        .unwrap_or(1.0)
}

/// Tauri command that repositions the "main" window using physical coordinates,
/// allowing cross-monitor movement.
#[tauri::command]
fn move_window(app_handle: tauri::AppHandle, x: i32, y: i32) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        // Switch to physical position to support multiple displays
        let physical_pos = PhysicalPosition::new(x, y); // Corrected to i32
        // Non-blocking set_position for snappier dragging
        let _ = window.set_position(Position::Physical(physical_pos));
    }
    Ok(())
}

/// Tauri command that resizes the "main" window.
#[tauri::command]
fn set_window_size(app_handle: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let scale_factor = get_scale_factor(&window);
        // Convert the requested size to physical pixels for high DPI displays
        let physical_width = (width as f64 * scale_factor).round() as u32;
        let physical_height = (height as f64 * scale_factor).round() as u32;
        
        window
            .set_size(Size::Physical(PhysicalSize::new(physical_width, physical_height)))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_window_visible(app_handle: tauri::AppHandle, visible: bool) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        if visible {
            window.show().map_err(|e| e.to_string())
        } else {
            window.hide().map_err(|e| e.to_string())
        }
    } else {
        Ok(())
    }
}

// Function to execute Apple Script
#[tauri::command]
fn run_apple_script(script: &str) -> Result<String, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    String::from_utf8(output.stdout)
        .map_err(|e| e.to_string())
}

// Common automation commands
#[tauri::command]
fn open_application(app_name: &str) -> Result<String, String> {
    let script = format!(r#"tell application "{}" to activate"#, app_name);
    run_apple_script(&script)
}

#[tauri::command]
fn type_text(text: &str) -> Result<String, String> {
    let script = format!(r#"
        tell application "System Events"
            keystroke "{}"
        end tell
    "#, text);
    run_apple_script(&script)
}

#[tauri::command]
fn click_button(button_name: &str) -> Result<String, String> {
    let script = format!(r#"
        tell application "System Events"
            click button "{}" of front window
        end tell
    "#, button_name);
    run_apple_script(&script)
}

#[tauri::command]
async fn automate_mac(action: &str, params: Option<String>) -> Result<String, String> {
    match action {
        "open_app" => {
            let app = params.unwrap_or_default();
            run_apple_script(&format!(r#"tell application "{}" to activate"#, app))
        },
        _ => Err("Unknown action".to_string())
    }
}

#[tauri::command]
fn start_drag(window: tauri::Window) {
    window.start_dragging().unwrap();
}

#[tauri::command]
async fn get_webview_window_position(window: tauri::Window) -> Result<(f64, f64), String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    Ok((position.x as f64, position.y as f64))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            move_window,
            set_window_size,
            set_window_visible,
            run_apple_script,
            open_application,
            type_text,
            click_button,
            automate_mac,
            start_drag,
            get_webview_window_position
        ])
        .setup(|app| {
            let window = app.get_webview_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            
            #[cfg(target_os = "macos")]
            {
                use tauri::WindowEvent;
                
                // Set window properties
                window.set_always_on_top(true)?;
                window.set_decorations(false)?;
                window.set_skip_taskbar(true)?;
                window.set_resizable(false)?;
                
                // Set up window event handler
                let window_handle = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::Focused(focused) = event {
                        if *focused {
                            let _ = window_handle.set_always_on_top(true);
                        }
                    }
                });
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}