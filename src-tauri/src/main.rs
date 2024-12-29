// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    Manager,
    Position,
    Size,
    LogicalPosition,
    LogicalSize,
    PhysicalSize,
    WebviewWindow,
};

/// Get the scale factor for the monitor
fn get_scale_factor(window: &WebviewWindow) -> f64 {
    window.current_monitor()
        .unwrap_or(None)
        .map(|m| m.scale_factor())
        .unwrap_or(1.0)
}

/// Tauri command that repositions the "main" window.
#[tauri::command]
fn move_window(app_handle: tauri::AppHandle, x: i32, y: i32) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let scale_factor = get_scale_factor(&window);
        // Convert physical pixels to logical pixels
        let logical_pos = LogicalPosition::new(x as f64, y as f64);
        
        window
            .set_position(Position::Logical(logical_pos))
            .map_err(|e| e.to_string())?;
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
            
            let scale_factor = get_scale_factor(&window);
            
            // Set initial size in physical pixels for high DPI
            let physical_width = (48.0 * scale_factor).round() as u32;
            let physical_height = (48.0 * scale_factor).round() as u32;
            window.set_size(Size::Physical(PhysicalSize::new(physical_width, physical_height))).unwrap();
            
            // Set initial position
            let initial_pos = LogicalPosition::new(20.0, 20.0);
            window.set_position(Position::Logical(initial_pos)).unwrap();
            
            window.show().unwrap();
            window.set_focus().unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}