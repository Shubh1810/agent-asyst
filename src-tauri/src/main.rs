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

#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
#[cfg(target_os = "macos")]
use cocoa::foundation::NSInteger;

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            move_window,
            set_window_size,
            set_window_visible
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Basic window setup
            window.set_decorations(false).unwrap();
            window.set_always_on_top(true).unwrap();
            window.set_skip_taskbar(true).unwrap();
            
            // Additional settings for staying on top of fullscreen apps
            #[cfg(target_os = "macos")]
            {
                use cocoa::base::id;
                let ns_window = window.ns_window().unwrap() as id;
                unsafe {
                    // Set window to appear above full screen windows
                    ns_window.setCollectionBehavior_(
                        NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces |
                        NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary |
                        NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle |
                        NSWindowCollectionBehavior::NSWindowCollectionBehaviorTransient
                    );
                    // Use NSInteger (i64) for window level
                    ns_window.setLevel_(3 as NSInteger);
                    ns_window.setIgnoresMouseEvents_(false);
                }
            }
            
            // Get initial scale factor
            let scale_factor = get_scale_factor(&window);
            
            // Set initial size in physical pixels for high DPI
            let physical_width = (48.0 * scale_factor).round() as u32;
            let physical_height = (48.0 * scale_factor).round() as u32;
            window.set_size(Size::Physical(PhysicalSize::new(physical_width, physical_height))).unwrap();
            
            // Set initial position (Physical for multi-monitor)
            let initial_x = (20.0 * scale_factor).round() as i32;
            let initial_y = (20.0 * scale_factor).round() as i32;
            window.set_position(Position::Physical(PhysicalPosition::new(initial_x, initial_y))).unwrap();
            
            window.show().unwrap();
            window.set_focus().unwrap();
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}