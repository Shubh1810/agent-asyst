#!/usr/bin/env python3

import sys
import os
import time
import json
import logging
import traceback
from typing import Optional, Dict, Any
import objc
from AppKit import (
    NSWorkspace, 
    NSObject, 
    NSWorkspaceActiveSpaceDidChangeNotification, 
    NSScreen,
    NSImage,
    NSBitmapImageRep,
    NSPNGFileType,
)
from Foundation import NSData

from Quartz import (
    CGWindowListCopyWindowInfo,
    kCGWindowListOptionOnScreenOnly,
    kCGWindowListOptionOnScreenAboveWindow,
    kCGNullWindowID
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

def get_app_icon(app_name: str) -> Optional[str]:
    """Get the app icon as a base64 PNG string."""
    try:
        print(f"\n=== Fetching icon for {app_name} ===", file=sys.stderr)
        workspace = NSWorkspace.sharedWorkspace()
        app_path = workspace.fullPathForApplication_(app_name)
        
        if not app_path:
            print(f"❌ Could not find application path for {app_name}", file=sys.stderr)
            return None
            
        print(f"✓ Found app path: {app_path}", file=sys.stderr)
            
        # Get the icon
        icon = workspace.iconForFile_(app_path)
        if not icon:
            print(f"❌ Could not get icon for {app_name}", file=sys.stderr)
            return None
            
        print(f"✓ Got icon for {app_name}", file=sys.stderr)
            
        # Convert to PNG data
        icon_size = 32  # Reduced size for better performance
        icon.setSize_((icon_size, icon_size))
        print(f"✓ Resized icon to {icon_size}x{icon_size}", file=sys.stderr)
        
        # Get bitmap representation
        bitmap = NSBitmapImageRep.alloc().initWithData_(icon.TIFFRepresentation())
        if not bitmap:
            print(f"❌ Failed to create bitmap for {app_name}", file=sys.stderr)
            return None
            
        print(f"✓ Created bitmap representation", file=sys.stderr)
            
        # Convert to PNG data
        png_data = bitmap.representationUsingType_properties_(
            NSPNGFileType,
            None
        )
        
        if not png_data:
            print(f"❌ Failed to convert to PNG for {app_name}", file=sys.stderr)
            return None
            
        print(f"✓ Converted to PNG format", file=sys.stderr)
            
        # Convert to base64
        base64_str = png_data.base64EncodedStringWithOptions_(0)
        base64_len = len(base64_str) if base64_str else 0
        print(f"✓ Converted to base64 string (length: {base64_len})", file=sys.stderr)
        
        result = f"data:image/png;base64,{base64_str}"
        print(f"✓ Successfully created data URL for {app_name}", file=sys.stderr)
        sys.stderr.flush()
        
        return result
        
    except Exception as e:
        print(f"❌ Error getting app icon for {app_name}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        return None

def is_window_in_fullscreen(window_id: int) -> bool:
    """Check if a window is in fullscreen mode."""
    try:
        window_list = CGWindowListCopyWindowInfo(
            kCGWindowListOptionOnScreenOnly,  # Only get on-screen windows
        kCGNullWindowID
    )
        
        for window in window_list:
            if window.get('kCGWindowNumber', -1) == window_id:
                bounds = window.get('kCGWindowBounds', {})
                if bounds:
                    screen = NSScreen.mainScreen()
                    screen_frame = screen.frame()
                    
                    window_width = bounds.get('Width', 0)
                    window_height = bounds.get('Height', 0)
                    
                    return (window_width >= screen_frame.size.width and 
                           window_height >= screen_frame.size.height)
        return False
    except Exception as e:
        print(f"Error checking fullscreen: {e}", file=sys.stderr)
        return False

def get_active_app_info():
    """Get detailed info about the currently active application."""
    try:
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.activeApplication()
        if active_app:
            print(f"\n=== Active App Info ===", file=sys.stderr)
            
            # Get all available info
            app_name = active_app.get('NSApplicationName', 'Unknown')
            app_path = active_app.get('NSApplicationPath', '')
            process_id = active_app.get('NSApplicationProcessIdentifier', 0)
            
            print(f"Name: {app_name}", file=sys.stderr)
            print(f"Path: {app_path}", file=sys.stderr)
            print(f"PID: {process_id}", file=sys.stderr)
            
            # Try to get icon using the app path first for better reliability
            app_icon = None
            if app_path:
                print(f"Getting icon from path: {app_path}", file=sys.stderr)
                icon = workspace.iconForFile_(app_path)
                if icon:
                    # Convert icon to data URL
                    icon_size = 32
                    icon.setSize_((icon_size, icon_size))
                    bitmap = NSBitmapImageRep.alloc().initWithData_(icon.TIFFRepresentation())
                    if bitmap:
                        png_data = bitmap.representationUsingType_properties_(NSPNGFileType, None)
                        if png_data:
                            base64_str = png_data.base64EncodedStringWithOptions_(0)
                            app_icon = f"data:image/png;base64,{base64_str}"
                            print("✓ Got icon from app path", file=sys.stderr)
            
            # Fallback to name-based icon fetch if path method failed
            if not app_icon:
                print("Falling back to name-based icon fetch", file=sys.stderr)
                app_icon = get_app_icon(app_name)
            
            print(f"Icon fetched: {'Yes' if app_icon else 'No'}", file=sys.stderr)
            
            # Send immediate update for current app
            state = {
                'timestamp': time.time(),
                'active_app': {
                    'name': app_name,
                    'path': app_path,
                    'pid': process_id,
                    'icon': app_icon
                }
            }
            
            # Send to Rust immediately
            try:
                print("\n=== Sending immediate app update to Rust ===", file=sys.stderr)
                json_str = json.dumps(state)
                os.write(sys.stdout.fileno(), json_str.encode('utf-8') + b'\n')
                print("✓ Immediate app update sent", file=sys.stderr)
            except Exception as e:
                print(f"Error sending immediate update: {e}", file=sys.stderr)
            
            sys.stderr.flush()
            return state['active_app']
            
    except Exception as e:
        print(f"Error getting active app info: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
    return None

def handle_app_change(app_name: str):
    """Handle app change notification from Rust with reliable icon fetching."""
    try:
        print(f"\n>>> Processing app change: {app_name} <<<", file=sys.stderr)
        sys.stderr.flush()
        
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.activeApplication()
        
        if active_app:
            app_name = active_app.get('NSApplicationName', app_name)
            app_path = active_app.get('NSApplicationPath', '')
            process_id = active_app.get('NSApplicationProcessIdentifier', 0)
            
            print(f"Found active app: {app_name}", file=sys.stderr)
            print(f"Path: {app_path}", file=sys.stderr)
            
            # Get icon directly from the app path
            app_icon = None
            if app_path:
                icon = workspace.iconForFile_(app_path)
                if icon:
                    icon_size = 32
                    icon.setSize_((icon_size, icon_size))
                    bitmap = NSBitmapImageRep.alloc().initWithData_(icon.TIFFRepresentation())
                    if bitmap:
                        png_data = bitmap.representationUsingType_properties_(NSPNGFileType, None)
                        if png_data:
                            base64_str = png_data.base64EncodedStringWithOptions_(0)
                            app_icon = f"data:image/png;base64,{base64_str}"
                            print("✓ Got icon directly from app path", file=sys.stderr)
            
            # Fallback to name-based icon fetch
            if not app_icon:
                print("Falling back to name-based icon fetch", file=sys.stderr)
                app_icon = get_app_icon(app_name)
            
            # Create and send immediate state update
            state = {
                'timestamp': int(time.time() * 1000),
                'active_app': {
                    'name': app_name,
                    'path': app_path,
                    'pid': process_id,
                    'icon': app_icon
                }
            }
            
            # Send to Rust immediately
            print("\n=== Sending immediate app update to Rust ===", file=sys.stderr)
            json_str = json.dumps(state)
            print(f"Sending update for {app_name} with icon: {'Yes' if app_icon else 'No'}", file=sys.stderr)
            # Write JSON string followed by newline and flush
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
            print("✓ App update sent to Rust\n", file=sys.stderr)
            sys.stderr.flush()
        else:
            print(f"❌ Could not get active app info for {app_name}", file=sys.stderr)
            
    except Exception as e:
        print(f"Error handling app change: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()

def create_window_state(windows):
    """Create a state object from the list of windows."""
    return {
        "windows": windows,
        "timestamp": time.time()
    }

def send_state_to_rust(state):
    try:
        print("=== Sending window list to Rust ===")
        json_str = json.dumps(state)
        print(json_str)
        sys.stdout.flush()
    except Exception as e:
        print(f"Error sending state: {e}", file=sys.stderr)
        sys.stderr.flush()

def check_active_space_windows():
    try:
        windows = get_visible_windows()
        state = create_window_state(windows)
        send_state_to_rust(state)
    except Exception as e:
        print(f"Error checking windows: {e}", file=sys.stderr)
        sys.stderr.flush()

class WindowObserver(NSObject):
    def init(self):
        self = objc.super(WindowObserver, self).init()
        if self is not None:
            self.workspace = NSWorkspace.sharedWorkspace()
            print("Window detector initialized")
            return self
        return None
    
    def start_observing(self):
        """Start observing and do initial window check."""
        try:
            logger.info("Starting window observation")
            # Do initial window check
            check_active_space_windows()
            # Signal that we're ready
            print("WINDOW_DETECTOR_READY")
            sys.stdout.flush()
            logger.info("Window detector ready")
        except Exception as e:
            logger.error(f"Error starting observation: {e}")
            raise

    def applicationDidActivate_(self, notification):
        """Handle application activation."""
        check_active_space_windows()

    def applicationDidDeactivate_(self, notification):
        """Handle application deactivation."""
        check_active_space_windows()

def main():
    try:
        observer = WindowObserver.alloc().init()
        if observer is None:
            logger.error("Failed to initialize WindowObserver")
            return 1
        
        observer.start_observing()
        
        print("\n>>> Python window detector entering main loop <<<", file=sys.stderr)
        sys.stderr.flush()
        
        while True:
            try:
                command = os.read(sys.stdin.fileno(), 1024).strip()
                
                print(f"\n>>> Received command: {command!r} <<<", file=sys.stderr)
                sys.stderr.flush()
                
                if not command:  # EOF
                    print(">>> EOF detected, exiting... <<<", file=sys.stderr)
                    break
                    
                if command == b"SPACE_CHANGED":
                    print("\n>>> Processing space change notification... <<<", file=sys.stderr)
                    observer.check_active_space_windows()
                    print(">>> Space change processing complete <<<", file=sys.stderr)
                elif command.startswith(b"APP_CHANGED:"):
                    app_name = command.split(b":", 1)[1].decode('utf-8')
                    print(f"\n>>> Processing app change for: {app_name} <<<", file=sys.stderr)
                    handle_app_change(app_name)
                    print(">>> App change processing complete <<<", file=sys.stderr)
                
                sys.stdout.flush()
                sys.stderr.flush()
                
            except Exception as e:
                print(f"\n>>> Error processing command: {e} <<<", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
                sys.stderr.flush()
                continue
                
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        traceback.print_exc(file=sys.stderr)
        return 1
    finally:
        print("\n>>> Python window detector shutting down <<<", file=sys.stderr)
        sys.stderr.flush()
        
    return 0

if __name__ == '__main__':
    sys.exit(main())