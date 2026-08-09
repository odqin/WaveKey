use global_hotkey::{hotkey::HotKey, GlobalHotKeyEvent, GlobalHotKeyManager};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::{AppHandle, Manager};

use crate::audio;
use crate::config;

pub struct HotkeyState {
    pub manager: GlobalHotKeyManager,
    // Maps Hotkey ID (u32) to Sound ID (String) for routing events
    pub id_to_sound: Mutex<HashMap<u32, String>>,
    // Maps Sound ID (String) to HotKey object for unregistering
    pub sound_to_hotkey: Mutex<HashMap<String, HotKey>>,
}

/// Initializes the hotkey manager and state.
pub fn init_hotkey_manager() -> HotkeyState {
    HotkeyState {
        manager: GlobalHotKeyManager::new().expect("Failed to initialize GlobalHotKeyManager"),
        id_to_sound: Mutex::new(HashMap::new()),
        sound_to_hotkey: Mutex::new(HashMap::new()),
    }
}

/// Spawns the background thread that listens for global hotkey events.
pub fn spawn_hotkey_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let receiver = GlobalHotKeyEvent::receiver();
        while let Ok(event) = receiver.recv() {
            // We only care about keydown/pressed events
            if event.state == global_hotkey::HotKeyState::Pressed {
                let state = app.state::<HotkeyState>();
                let id_map = state.id_to_sound.lock().unwrap();
                
                if let Some(sound_id) = id_map.get(&event.id) {
                        eprintln!("Hotkey fired: event.id={}, sound_id={}", event.id, sound_id); // TEMP DEBUG

                    if sound_id == "__STOP_ALL__" {
                        let _ = app.emit("stop_all", ());
                        let _ = audio::stop_all_audio(app.clone());
                    } else {
                            eprintln!("Hotkey event fired for unmapped id: {}", event.id); // TEMP DEBUG

                        // Fetch the file path from config. 
                        // (config.rs owns config logic, so we call its public function)
                        let cfg = config::get_config(app.clone());
                        if let Some(sound) = cfg.sounds.iter().find(|s| s.id == *sound_id) {
                            let _ = app.emit("sound_played", sound.id.clone());
                            let _ = audio::play_or_stop_sound_internal(&app, sound.id.clone(), sound.file.clone(), cfg.output_devices.clone(), cfg.allow_overlap, cfg.master_volume * sound.volume);
                        }
                    }
                }
            }
        }
    });
}

/// Registers a hotkey for a given sound ID. Unregisters any existing hotkey for that sound first.
#[tauri::command]
pub fn register_hotkey(app: tauri::AppHandle, sound_id: String, combo: String) -> Result<(), String> {
    // Unregister old hotkey if it exists to prevent leaks
    let _ = unregister_hotkey(app.clone(), sound_id.clone());

    let state = app.state::<HotkeyState>();
    
    // Parse the combo string (e.g. "CommandOrControl+Shift+A")
    let hotkey = HotKey::from_str(&combo)
        .map_err(|e| format!("Invalid hotkey format '{}': {}", combo, e))?;

    // Register with the OS
    state.manager.register(hotkey)
        .map_err(|e| format!("Failed to register OS hotkey: {}", e))?;

    // Store in maps
    state.id_to_sound.lock().unwrap().insert(hotkey.id(), sound_id.clone());
    state.sound_to_hotkey.lock().unwrap().insert(sound_id, hotkey);

    Ok(())
}

/// Unregisters the hotkey associated with a sound ID.
#[tauri::command]
pub fn unregister_hotkey(app: tauri::AppHandle, sound_id: String) -> Result<(), String> {
    let state = app.state::<HotkeyState>();
    
    let mut s_to_h = state.sound_to_hotkey.lock().unwrap();
    let mut i_to_s = state.id_to_sound.lock().unwrap();

    if let Some(hotkey) = s_to_h.remove(&sound_id) {
        let _ = state.manager.unregister(hotkey); // Ignore error if it was already unregistered
        i_to_s.remove(&hotkey.id());
    }

    Ok(())
}

/// Helper to register all hotkeys on startup from the config.
pub fn register_all_from_config(app: &AppHandle) {
    let cfg = config::get_config(app.clone());
    for sound in cfg.sounds {
        if let Some(combo) = sound.hotkey {
            if !combo.is_empty() {
                if let Err(e) = register_hotkey(app.clone(), sound.id.clone(), combo) {
                    eprintln!("Failed to register hotkey on startup for {}: {}", sound.id, e);
                }
            }
        }
    }

    if let Some(combo) = cfg.stop_all_hotkey {
        if !combo.is_empty() {
            if let Err(e) = register_hotkey(app.clone(), "__STOP_ALL__".to_string(), combo) {
                eprintln!("Failed to register stop-all hotkey on startup: {}", e);
            }
        }
    }
}
