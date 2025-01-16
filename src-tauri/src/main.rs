// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};


#[cfg(target_os = "macos")]
use cocoa::base::{id, nil, NO, YES};
#[cfg(target_os = "macos")]
use cocoa::foundation::{NSUInteger, NSRect, NSString, NSInteger};
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};
#[cfg(target_os = "macos")]
use objc::runtime::{Sel, Class, class_addMethod};

use tauri::Emitter;
use serde_json::json;

use std::panic;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use serde_json::Value;
use std::sync::Arc;
use std::cell::RefCell;
use tauri::AppHandle;

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy)]
struct NSSize {
    width: f64,
    height: f64,
}

// Thread-local storage for Python stdin and observer
thread_local! {
    static PYTHON_STDIN: RefCell<Option<Arc<std::sync::Mutex<std::process::ChildStdin>>>> = RefCell::new(None);
    
    #[cfg(target_os = "macos")]
    static OBSERVER: RefCell<Option<id>> = RefCell::new(None);
    static APP_HANDLE: RefCell<Option<AppHandle>> = RefCell::new(None);
}

/// Get the scale factor for the monitor
fn get_scale_factor(window: &WebviewWindow) -> f64 {
    window
        .current_monitor()
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
            .set_size(Size::Physical(PhysicalSize::new(
                physical_width,
                physical_height,
            )))
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

    String::from_utf8(output.stdout).map_err(|e| e.to_string())
}

// Common automation commands
#[tauri::command]
fn open_application(app_name: &str) -> Result<String, String> {
    let script = format!(r#"tell application "{}" to activate"#, app_name);
    run_apple_script(&script)
}

#[tauri::command]
fn type_text(text: &str) -> Result<String, String> {
    let script = format!(
        r#"
        tell application "System Events"
            keystroke "{}"
        end tell
    "#,
        text
    );
    run_apple_script(&script)
}

#[tauri::command]
fn click_button(button_name: &str) -> Result<String, String> {
    let script = format!(
        r#"
        tell application "System Events"
            click button "{}" of front window
        end tell
    "#,
        button_name
    );
    run_apple_script(&script)
}

#[tauri::command]
async fn automate_mac(action: &str, params: Option<String>) -> Result<String, String> {
    match action {
        "open_app" => {
            let app = params.unwrap_or_default();
            run_apple_script(&format!(r#"tell application "{}" to activate"#, app))
        }
        _ => Err("Unknown action".to_string()),
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

#[cfg(target_os = "macos")]
fn is_screen_fullscreen(screen: id) -> bool {
    unsafe {
        let frame: NSRect = msg_send![screen, frame];
        let visible_frame: NSRect = msg_send![screen, visibleFrame];
        
        // If the visible frame height is significantly different from the total frame height,
        // we're likely in a full-screen space
        println!("Screen check - Frame height: {}, Visible height: {}", 
            frame.size.height, visible_frame.size.height);
            
        frame.size.height != visible_frame.size.height
    }
}


#[cfg(target_os = "macos")]
unsafe extern "C" fn space_change_callback(_this: id, _sel: Sel, _notification: id) {
    println!("Space change detected - notifying Python detector");
    
    unsafe {
        // Get our app to maintain window level during transition
        let app: id = msg_send![class!(NSApplication), sharedApplication];
        let app_windows: id = msg_send![app, windows];
        let app_count: NSUInteger = msg_send![app_windows, count];
        
        // First boost window level during transition to prevent flicker
        for i in 0..app_count {
            let window: id = msg_send![app_windows, objectAtIndex:i];
            if window != nil {
                let _: () = msg_send![window, setLevel: 2147483647];
                let _: () = msg_send![window, orderFrontRegardless];
            }
        }
        
        // Check if we're entering a fullscreen space
        let screen: id = msg_send![class!(NSScreen), mainScreen];
        let is_fullscreen = is_screen_fullscreen(screen);
        
        // Adjust window properties for fullscreen spaces
        for i in 0..app_count {
            let window: id = msg_send![app_windows, objectAtIndex:i];
            if window != nil {
                if is_fullscreen {
                    println!("Entering fullscreen space - adjusting window properties");
                    // In fullscreen spaces:
                    // - Use NSWindowCollectionBehaviorTransient to avoid disrupting fullscreen
                    // - Set higher level to stay above fullscreen window
                    // - Remove shadow and make more subtle
                    let behavior = 1 << 0 | 1 << 10; // CanJoinAllSpaces | Transient
                    let _: () = msg_send![window, setCollectionBehavior:behavior];
                    let _: () = msg_send![window, setLevel:25];
                    let _: () = msg_send![window, setHasShadow:NO];
                    let _: () = msg_send![window, setAlphaValue:0.95];
                } else {
                    println!("Entering normal space - restoring window properties");
                    // In normal spaces:
                    // - Use standard behavior
                    // - Set normal floating level
                    // - Restore opacity
                    let behavior = 1 << 0; // CanJoinAllSpaces only
                    let _: () = msg_send![window, setCollectionBehavior:behavior];
                    let _: () = msg_send![window, setLevel:5];
                    let _: () = msg_send![window, setAlphaValue:1.0];
                }
            }
        }
    }
    
    // Notify Python detector through stdin
    PYTHON_STDIN.with(|stdin| {
        if let Some(stdin) = stdin.borrow().as_ref() {
            if let Ok(mut stdin) = stdin.lock() {
                if let Err(e) = stdin.write_all(b"SPACE_CHANGED\n") {
                    eprintln!("Failed to notify Python: {}", e);
                } else if let Err(e) = stdin.flush() {
                    eprintln!("Failed to flush Python stdin: {}", e);
                }
            }
        }
    });
}

#[cfg(target_os = "macos")]
fn apply_macos_window_customizations(window: &WebviewWindow) -> Result<(), String> {
    println!("Starting window customization with enhanced debugging...");
    
    // Get window handle first
    let ns_window = window.ns_window().map_err(|e| {
        format!("Failed to get ns_window: {}", e)
    })?;
    let ns_window = ns_window as id;
    
    // Wrap all Objective-C calls in a single unsafe block with proper error handling
    unsafe {
        // Print current window properties
        let current_level: NSInteger = msg_send![ns_window, level];
        let current_collection_behavior: NSUInteger = msg_send![ns_window, collectionBehavior];
        println!("Current window level: {}", current_level);
        println!("Current collection behavior: {:#b}", current_collection_behavior);
        
        // Set combined behaviors for maximum compatibility
        let base_behavior: NSUInteger = 
            1 << 0;  // NSWindowCollectionBehaviorCanJoinAllSpaces only for now
        
        println!("Setting collection behavior: {:#b}", base_behavior);
        
        // Set window properties with error checking - one at a time
        let _: () = msg_send![ns_window, setCollectionBehavior: base_behavior];
        
        println!("Setting window level to 25");
        let _: () = msg_send![ns_window, setLevel: 25];
        
        // Additional window properties like Highlight - simplified
        let _: () = msg_send![ns_window, setOpaque: NO];
        let _: () = msg_send![ns_window, setMovable: YES];
        let _: () = msg_send![ns_window, setHasShadow: NO];
        
        // Print final window properties
        let final_level: NSInteger = msg_send![ns_window, level];
        let final_collection_behavior: NSUInteger = msg_send![ns_window, collectionBehavior];
        println!("Final window level: {}", final_level);
        println!("Final collection behavior: {:#b}", final_collection_behavior);
        
        // Set up space change observer - simplified
        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        if workspace == nil {
            return Err("Failed to get workspace".into());
        }
        
        let notification_center: id = msg_send![workspace, notificationCenter];
        if notification_center == nil {
            return Err("Failed to get notification center".into());
        }
        
        // Create observer
        let observer: id = msg_send![class!(NSObject), new];
        if observer == nil {
            return Err("Failed to create observer".into());
        }
        
        // Store observer first
        OBSERVER.with(|obs| {
            *obs.borrow_mut() = Some(observer);
        });

        // Basic selector setup
        let selector = sel!(spaceDidChange:);
        let types = std::ffi::CString::new("v@:@").map_err(|e| e.to_string())?;
        
        type Imp = unsafe extern "C" fn();
        let imp: Imp = std::mem::transmute(space_change_callback as unsafe extern "C" fn(_, _, _));
        
        let observer_class: *mut Class = msg_send![observer, class];
        class_addMethod(observer_class, selector, imp, types.as_ptr());
        
        // Set up notification
        let notification_name = NSString::alloc(nil).init_str("NSWorkspaceActiveSpaceDidChangeNotification");
        let _: () = msg_send![notification_center,
            addObserver:observer
            selector:selector
            name:notification_name
            object:nil];
        
        println!("Window customization complete");
        Ok(())
    }
}

// Command to re-invoke window settings
#[cfg(target_os = "macos")]
#[tauri::command]
fn re_invoke_window_settings(window: WebviewWindow) -> Result<(), String> {
    apply_macos_window_customizations(&window)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn re_invoke_window_settings(_window: WebviewWindow) -> Result<(), String> {
    Err("Not implemented on this platform.".into())
}

fn setup_python_environment() -> Result<(), String> {
    let python_path = "/Library/Frameworks/Python.framework/Versions/3.9/bin/python3.9";
    println!("Setting up Python environment using {}", python_path);

    // Check if Python 3.9 is available
    let python_check = Command::new(python_path)
        .arg("--version")
        .output()
        .map_err(|_| format!("Python 3.9 not found at {}", python_path))?;
        
    if !python_check.status.success() {
        return Err("Python 3.9 check failed".to_string());
    }

    // Install required packages using pip
    println!("Installing required packages...");
    let packages = [
        "pyobjc-framework-Cocoa",
        "pyobjc-framework-Quartz",
        "pyobjc-core"
    ];

    for package in packages.iter() {
        println!("Installing {}", package);
        let pip_result = Command::new(python_path)
            .args(["-m", "pip", "install", "--user", package])
            .output()
            .map_err(|e| format!("Failed to install {}: {}", package, e))?;

        if !pip_result.status.success() {
            return Err(format!("Failed to install {}: {}", 
                package, 
                String::from_utf8_lossy(&pip_result.stderr)));
        }
    }

    println!("Python environment setup complete");
    Ok(())
}

fn start_window_detector(app_handle: tauri::AppHandle) {
    let current_dir = std::env::current_dir()
        .expect("Failed to get current directory");
        
    // Setup Python environment first
    if let Err(e) = setup_python_environment() {
        eprintln!("Failed to setup Python environment: {}", e);
        return;
    }
        
    thread::spawn(move || {
        let detector_script = current_dir.join("window_detector.py");
        let python_path = "/Library/Frameworks/Python.framework/Versions/3.9/bin/python3.9";
        
        println!("Starting window detector");
        println!("Python path: {}", python_path);
        println!("Script path: {}", detector_script.display());

        let mut child = Command::new(python_path)
            .arg(&detector_script)
            .current_dir(&current_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to start window detector");

        // Get stdin handle for sending notifications
        let python_stdin = child.stdin.take().expect("Failed to get stdin");
        let python_stdin = Arc::new(std::sync::Mutex::new(python_stdin));
        
        // Store python_stdin in thread local storage
        PYTHON_STDIN.with(|stdin| {
            *stdin.borrow_mut() = Some(python_stdin.clone());
        });

        // Handle stderr in a separate thread
        if let Some(stderr) = child.stderr.take() {
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(error) = line {
                        eprintln!("Window Detector Error: {}", error);
                    }
                }
            });
        }

        // Handle stdout
        let stdout = child.stdout.take().expect("Failed to get stdout");
        let mut reader = BufReader::new(stdout);
        let mut buffer = Vec::new();
        
        loop {
            buffer.clear();
            match reader.read_until(b'\n', &mut buffer) {
                Ok(0) => {
                    println!("Python detector closed the pipe");
                    break;
                }
                Ok(_) => {
                    if let Ok(line) = String::from_utf8(buffer.clone()) {
                        let line = line.trim();
                        if line == "WINDOW_DETECTOR_READY" {
                            println!("Window detector is ready and connected!");
                            continue;
                        }
                        
                        // Handle window information from Python
                        if let Ok(window_info) = serde_json::from_str::<Value>(line) {
                            // Emit the window state update to the frontend
                            if let Err(e) = app_handle.emit("window_state_update", window_info) {
                                eprintln!("Failed to emit window state: {}", e);
                            } else {
                                println!("Window state update emitted to frontend");
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error reading from Python: {}", e);
                    break;
                }
            }
        }
    });
}

#[cfg(target_os = "macos")]
fn get_active_app_from_menubar() -> Option<String> {
    unsafe {
        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let active_app: id = msg_send![workspace, frontmostApplication];
        if active_app != nil {
            let app_name: id = msg_send![active_app, localizedName];
            if app_name != nil {
                // Convert NSString to Rust String using UTF8String
                let utf8_str: *const i8 = msg_send![app_name, UTF8String];
                if !utf8_str.is_null() {
                    let c_str = std::ffi::CStr::from_ptr(utf8_str);
                    return c_str.to_str().ok().map(|s| s.to_string());
                }
            }
        }
        None
    }
}

fn handle_window_state_update(app_handle: &tauri::AppHandle, window_info: Value) {
    println!("\n=== Window State Update Processing ===");
    println!("Raw window_info: {}", window_info);
    
    // Log the active app from Python
    if let Some(active_app) = window_info.get("active_app") {
        println!("\nActive App Details:");
        println!("Full active_app data: {:?}", active_app);
        
        // Log specific fields if they exist
        if let Some(obj) = active_app.as_object() {
            println!("  Name: {:?}", obj.get("name").and_then(|v| v.as_str()));
            println!("  Path: {:?}", obj.get("path").and_then(|v| v.as_str()));
            println!("  PID: {:?}", obj.get("pid"));
            println!("  Has Icon: {}", obj.get("icon").is_some());
            if let Some(icon) = obj.get("icon") {
                println!("  Icon data length: {}", icon.as_str().map_or(0, |s| s.len()));
            }
        }
    }
    
    // Emit the update to the frontend
    if let Some(window) = app_handle.get_webview_window("main") {
        println!("\nEmitting window state update to frontend");
        match window.emit("window_state_update", &window_info) {
            Ok(_) => println!("✓ Successfully emitted update to frontend"),
            Err(e) => println!("❌ Failed to emit window state: {}\n", e),
        }
    } else {
        println!("❌ Main window not found!");
    }
    println!("=== End Window State Update ===\n");
}

#[cfg(target_os = "macos")]
fn get_app_icon(app_name: &str) -> Option<String> {
    unsafe {
        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let app_path = NSString::alloc(nil).init_str(app_name);
        let full_path: id = msg_send![workspace, fullPathForApplication:app_path];
        
        if full_path != nil {
            let icon: id = msg_send![workspace, iconForFile:full_path];
            if icon != nil {
                // Set icon size
                let _: () = msg_send![icon, setSize:NSSize { width: 32.0, height: 32.0 }];
                
                // Get TIFF representation
                let tiff_data: id = msg_send![icon, TIFFRepresentation];
                if tiff_data != nil {
                    // Create bitmap representation
                    let bitmap: id = msg_send![class!(NSBitmapImageRep), alloc];
                    let bitmap: id = msg_send![bitmap, initWithData:tiff_data];
                    
                    if bitmap != nil {
                        // Convert to PNG
                        let png_data: id = msg_send![bitmap, representationUsingType:4 properties:nil]; // 4 = PNG
                        if png_data != nil {
                            // Convert to base64
                            let base64_str: id = msg_send![png_data, base64EncodedStringWithOptions:0];
                            let base64_str = std::ffi::CStr::from_ptr(msg_send![base64_str, UTF8String])
                                .to_string_lossy()
                                .into_owned();
                            
                            return Some(format!("data:image/png;base64,{}", base64_str));
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
unsafe extern "C" fn active_app_change_callback(_this: id, _sel: Sel, notification: id) {
    println!("Active app change detected from Rust");
    
    // Get the active app info
    if let Some(app_name) = get_active_app_from_menubar() {
        println!("New active app (from Rust): {}", app_name);
        
        // Get app icon
        let icon = get_app_icon(&app_name);
        println!("Icon fetched: {}", if icon.is_some() { "Yes" } else { "No" });
        
        // Emit directly to frontend first
        APP_HANDLE.with(|app_handle| {
            if let Some(app_handle) = app_handle.borrow().as_ref() {
                let window_info = json!({
                    "active_app": {
                        "name": app_name,
                        "path": "",
                        "pid": 0,
                        "icon": icon
                    }
                });

                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Err(e) = window.emit("window_state_update", &window_info) {
                        eprintln!("Failed to emit window state: {}", e);
                    } else {
                        println!("Window state update emitted to frontend");
                    }
                }
            }
        });
        
        // Also notify Python for other functionality
        PYTHON_STDIN.with(|stdin| {
            if let Some(stdin) = stdin.borrow().as_ref() {
                if let Ok(mut stdin) = stdin.lock() {
                    let command = format!("APP_CHANGED:{}\n", app_name);
                    if let Err(e) = stdin.write_all(command.as_bytes()) {
                        eprintln!("Failed to notify Python: {}", e);
                    } else if let Err(e) = stdin.flush() {
                        eprintln!("Failed to flush Python stdin: {}", e);
                    } else {
                        println!("Notified Python about app change");
                    }
                }
            }
        });
    }
}

#[cfg(target_os = "macos")]
fn setup_active_app_observer() -> Result<(), String> {
    unsafe {
        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let notification_center: id = msg_send![workspace, notificationCenter];
        
        // Create observer
        let observer: id = msg_send![class!(NSObject), new];
        
        // Store observer
        OBSERVER.with(|obs| {
            *obs.borrow_mut() = Some(observer);
        });
        
        // Add method to observer
        let selector = sel!(activeAppDidChange:);
        let types = std::ffi::CString::new("v@:@").map_err(|e| e.to_string())?;
        
        type Imp = unsafe extern "C" fn();
        let imp: Imp = std::mem::transmute(active_app_change_callback as unsafe extern "C" fn(_, _, _));
        
        let observer_class: *mut Class = msg_send![observer, class];
        class_addMethod(observer_class, selector, imp, types.as_ptr());
        
        // Register for notifications
        let notification_name = NSString::alloc(nil).init_str("NSWorkspaceDidActivateApplicationNotification");
        let _: () = msg_send![notification_center,
            addObserver:observer
            selector:selector
            name:notification_name
            object:nil];
            
        println!("Active app observer setup complete");
        Ok(())
    }
}

fn main() {
    // Set custom panic hook
    panic::set_hook(Box::new(|panic_info| {
        eprintln!("Panic occurred: {:?}", panic_info);
        if let Some(location) = panic_info.location() {
            eprintln!(
                "Panic occurred in file '{}' at line {}",
                location.file(),
                location.line()
            );
        }
    }));

    let result = tauri::Builder::default()
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
            get_webview_window_position,
            re_invoke_window_settings
        ])
        .setup(|app| {
            println!("Starting setup...");
            
            let app_handle = app.handle();
            
            // Store app handle in thread local
            APP_HANDLE.with(|handle| {
                *handle.borrow_mut() = Some(app_handle.clone());
            });
            
            // Setup active app observer
            #[cfg(target_os = "macos")]
            if let Err(e) = setup_active_app_observer() {
                eprintln!("Failed to setup active app observer: {}", e);
            }
            
            // Start the window detector with app handle
            start_window_detector(app_handle.clone());
            
            let window = app.get_webview_window("main").ok_or_else(|| {
                println!("Failed to get main window");
                "Failed to get main window"
            })?;

            println!("Setting window properties...");
            window.set_always_on_top(true)?;

            #[cfg(target_os = "macos")]
            {
                println!("Configuring macOS specific settings...");
                apply_macos_window_customizations(&window)?;
            }
            println!("Setup completed successfully");
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("Error running application: {}", e);
        std::process::exit(1);
    }
}
