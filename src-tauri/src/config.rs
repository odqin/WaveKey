use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Represents a single sound entry in the configuration.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoundEntry {
    pub id: String,
    pub name: String,
    pub file: String,
    pub hotkey: Option<String>,
    pub volume: f32,
}

/// Represents the global application configuration.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub master_volume: f32,
    pub output_devices: Vec<String>,
    pub sounds: Vec<SoundEntry>,
    /// When true, closing the main window minimizes to the system tray instead of quitting.
    #[serde(default)]
    pub minimize_to_tray: bool,
    /// When true, the app registers itself to launch on OS login.
    #[serde(default)]
    pub autostart: bool,
    /// When true, playing a sound allows existing sounds to keep playing.
    #[serde(default = "default_allow_overlap")]
    pub allow_overlap: bool,
    /// The global hotkey to stop all playing sounds.
    pub stop_all_hotkey: Option<String>,
}

fn default_allow_overlap() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self {
            master_volume: 1.0,
            output_devices: vec!["default".to_string()],
            sounds: vec![],
            minimize_to_tray: false,
            autostart: false,
            allow_overlap: true,
            stop_all_hotkey: None,
        }
    }
}

/// Helper to safely resolve the path to `config.json` inside the OS app-data directory.
fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    // Ensure the directory exists before we attempt to read or write to it
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }
    
    Ok(app_data_dir.join("config.json"))
}

/// Loads the configuration from the OS app-data directory.
/// If the file is missing or malformed, it logs the error and gracefully falls back to default.
#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> Config {
    let config_path = match get_config_path(&app) {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Error resolving config path: {}. Falling back to default config.", e);
            return Config::default();
        }
    };

    if !config_path.exists() {
        let default_config = Config::default();
        if let Err(e) = save_config_internal(&config_path, &default_config) {
            eprintln!("Failed to create default config file on first run: {}", e);
        }
        return default_config;
    }

    let file_content = match fs::read_to_string(&config_path) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read config file from disk: {}. Falling back to default config.", e);
            return Config::default();
        }
    };

    match serde_json::from_str(&file_content) {
        Ok(config) => config,
        Err(e) => {
            eprintln!("Malformed config.json format ({}). Falling back to default config without crashing.", e);
            Config::default()
        }
    }
}

/// Saves the configuration back to the OS app-data directory.
#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: Config) -> Result<(), String> {
    let config_path = get_config_path(&app)?;
    save_config_internal(&config_path, &config)
}

/// Internal helper to serialize and write the config to disk.
fn save_config_internal(path: &PathBuf, config: &Config) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config to JSON: {}", e))?;
    
    fs::write(path, json)
        .map_err(|e| format!("Failed to write config file to disk: {}", e))?;
        
    Ok(())
}

