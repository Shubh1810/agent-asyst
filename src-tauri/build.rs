fn main() {
    tauri_build::build();

    // Only check on macOS
    #[cfg(target_os = "macos")]
    {
        let python_path = "/opt/homebrew/opt/python@3.13/bin/python3.13";
        
        // Try to import PyObjC modules using the specific Python version
        let check_cmd = std::process::Command::new(python_path)
            .arg("-c")
            .arg(r#"
try:
    import Quartz
    import AppKit
    print("PyObjC modules found")
except ImportError:
    exit(1)
            "#)
            .output();

        match check_cmd {
            Ok(output) => {
                if !output.status.success() {
                    println!("cargo:warning=PyObjC modules not found. Please run: {} -m pip install pyobjc-framework-Quartz pyobjc-framework-Cocoa", python_path);
                }
            }
            Err(_) => {
                println!("cargo:warning=Could not check PyObjC installation. Please ensure Python 3.13 is installed via Homebrew.");
            }
        }
    }
}
