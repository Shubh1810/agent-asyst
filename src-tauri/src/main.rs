// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    Manager,
    Position,
    PhysicalPosition,
    Size,
    PhysicalSize,
};

/// Tauri command that repositions the "main" window.
#[tauri::command]
fn move_window(app_handle: tauri::AppHandle, x: i32, y: i32) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window
            .set_position(Position::Physical(PhysicalPosition { x, y }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Tauri command that resizes the "main" window.
#[tauri::command]
fn set_window_size(app_handle: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window
            .set_size(Size::Physical(PhysicalSize { width, height }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_window_visible(window: tauri::Window, visible: bool) -> Result<(), String> {
    if visible {
        window.show().map_err(|e| e.to_string())
    } else {
        window.hide().map_err(|e| e.to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            move_window,
            set_window_size,
            set_window_visible
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_decorations(false).unwrap();
            window.set_always_on_top(true).unwrap();
            window.show().unwrap();
            window.set_focus().unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}