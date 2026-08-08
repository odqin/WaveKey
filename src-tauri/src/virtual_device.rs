use std::sync::Mutex;
use tauri::AppHandle;

#[cfg(any(target_os = "linux", target_os = "windows"))]
use std::process::Command;

#[cfg(any(target_os = "linux", target_os = "windows"))]
use rodio::cpal::traits::{DeviceTrait, HostTrait};

pub struct VirtualDeviceState {
    pub module_id: Mutex<Option<String>>,
}

pub fn init() -> VirtualDeviceState {
    #[cfg(target_os = "linux")]
    {
        println!("Initializing Linux virtual audio device...");
        let output = Command::new("pactl")
            .arg("load-module")
            .arg("module-null-sink")
            .arg("sink_name=wavekey_mic")
            .arg("sink_properties=device.description=WaveKey_Mic")
            .output();

        match output {
            Ok(output) if output.status.success() => {
                let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
                println!("Successfully created virtual sink with module ID: {}", id);
                VirtualDeviceState {
                    module_id: Mutex::new(Some(id)),
                }
            }
            Ok(output) => {
                let err = String::from_utf8_lossy(&output.stderr);
                eprintln!("Failed to create virtual sink (pactl exited with {}): {}", output.status, err);
                VirtualDeviceState { module_id: Mutex::new(None) }
            }
            Err(e) => {
                eprintln!("Failed to execute pactl: {}", e);
                VirtualDeviceState { module_id: Mutex::new(None) }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, the device isn't dynamically created via shell on startup,
        // it's a persistent system driver. State is empty.
        VirtualDeviceState {
            module_id: Mutex::new(None),
        }
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        VirtualDeviceState {
            module_id: Mutex::new(None),
        }
    }
}

pub fn cleanup(state: &VirtualDeviceState) {
    #[cfg(target_os = "linux")]
    {
        if let Some(id) = state.module_id.lock().unwrap().take() {
            println!("Unloading virtual sink module {}...", id);
            let _ = Command::new("pactl")
                .arg("unload-module")
                .arg(&id)
                .status();
        }
    }
}

#[tauri::command]
pub fn get_output_devices() -> Vec<String> {
    #[cfg(target_os = "linux")]
    {
        let mut devices = vec!["default".to_string()];
        
        // Use pactl to explicitly list PulseAudio/PipeWire sinks by name
        if let Ok(output) = Command::new("pactl").arg("list").arg("sinks").arg("short").output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() > 1 {
                    let name = parts[1].to_string();
                    if !devices.contains(&name) {
                        devices.push(name);
                    }
                }
            }
        }
        
        devices
    }

    #[cfg(target_os = "windows")]
    {
        let mut devices = vec!["default".to_string()];
        
        let host = rodio::cpal::default_host();
        if let Ok(out_devices) = host.output_devices() {
            for d in out_devices {
                if let Ok(name) = d.name() {
                    if !devices.contains(&name) {
                        devices.push(name);
                    }
                }
            }
        }
        devices
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        vec!["default".to_string()]
    }
}

#[tauri::command]
pub fn check_vbcable_installed() -> bool {
    #[cfg(target_os = "windows")]
    {
        let host = rodio::cpal::default_host();
        if let Ok(out_devices) = host.output_devices() {
            for d in out_devices {
                if let Ok(name) = d.name() {
                    if name.contains("CABLE Input") || name.contains("VB-Audio") {
                        return true;
                    }
                }
            }
        }
        false
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        true // Assume true on non-Windows platforms so the UI doesn't incorrectly prompt
    }
}

#[tauri::command]
pub fn install_vbcable(_app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        
        // Resolve the bundled executable path
        let resource_dir = _app.path().resource_dir().map_err(|e| format!("Failed to get resource dir: {}", e))?;
        let installer_path = resource_dir.join("resources").join("vbcable").join("VBCABLE_Setup_x64.exe");
        
        if !installer_path.exists() {
            return Err(format!("Installer not found at {:?}", installer_path));
        }

        let installer_str = installer_path.to_string_lossy().to_string();
        
        // Execute with elevation via powershell
        let status = Command::new("powershell")
            .arg("-Command")
            .arg(format!("Start-Process -FilePath '{}' -ArgumentList '-i','-h' -Verb RunAs -Wait", installer_str))
            .status()
            .map_err(|e| format!("Failed to execute powershell: {}", e))?;
            
        if !status.success() {
            return Err("Installer process failed or was canceled by user".to_string());
        }
        
        Ok(())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not supported on this OS".to_string())
    }
}
