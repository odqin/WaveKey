use crate::config::SoundEntry;
use crate::import;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
const YT_DLP_NAME: &str = "yt-dlp.exe";
#[cfg(not(target_os = "windows"))]
const YT_DLP_NAME: &str = "yt-dlp";

fn ensure_yt_dlp(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    
    let yt_dlp_path = app_data_dir.join(YT_DLP_NAME);

    if !yt_dlp_path.exists() {
        println!("yt-dlp not found, downloading to {:?}...", yt_dlp_path);
        
        #[cfg(target_os = "windows")]
        let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        #[cfg(target_os = "linux")]
        let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
        #[cfg(target_os = "macos")]
        let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";

        let response = reqwest::blocking::get(url)
            .map_err(|e| format!("Network failure downloading yt-dlp: {}", e))?;
            
        if !response.status().is_success() {
            return Err(format!("Failed to download yt-dlp (status {})", response.status()));
        }
        
        let bytes = response.bytes().map_err(|e| format!("Failed to read yt-dlp payload: {}", e))?;
        let mut file = File::create(&yt_dlp_path).map_err(|e| format!("Failed to create yt-dlp file: {}", e))?;
        file.write_all(&bytes).map_err(|e| format!("Failed to write yt-dlp file: {}", e))?;
        
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&yt_dlp_path)
                .map_err(|e| e.to_string())?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&yt_dlp_path, perms).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(yt_dlp_path)
}

#[tauri::command]
pub async fn import_from_youtube(app: AppHandle, url: String, name: String) -> Result<SoundEntry, String> {
    // Run entirely in a background thread to prevent UI freezing during download/conversion
    tauri::async_runtime::spawn_blocking(move || {
        if !url.contains("youtube.com") && !url.contains("youtu.be") {
            return Err("Invalid URL: Must be a valid YouTube link.".to_string());
        }

        let yt_dlp_path = ensure_yt_dlp(&app)?;

        let temp_dir = app
            .path()
            .app_data_dir()
            .unwrap()
            .join("temp");
        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
        
        // Clean up old temp files if they were orphaned
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let _ = fs::remove_file(entry.path());
            }
        }

        let temp_file_template = temp_dir.join("yt_dlp_temp_%(id)s.%(ext)s");

        let output = Command::new(&yt_dlp_path)
            .arg("-x")
            .arg("--audio-format")
            .arg("wav")
            .arg("-o")
            .arg(temp_file_template.to_string_lossy().to_string())
            .arg(&url)
            .output()
            .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

        if !output.status.success() {
            let err_log = String::from_utf8_lossy(&output.stderr);
            if err_log.contains("ffmpeg") || err_log.contains("ffprobe") {
                 return Err("yt-dlp requires ffmpeg to extract WAV. Please install ffmpeg on your OS, or this will fail.".to_string());
            } else if err_log.contains("Video unavailable") || err_log.contains("Private video") {
                return Err("Video unavailable: It may be private, age-restricted, or deleted.".to_string());
            }
            return Err(format!("yt-dlp error: {}", err_log));
        }

        let mut downloaded_file = None;
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("wav") {
                    downloaded_file = Some(path);
                    break;
                }
            }
        }
        
        let temp_file = downloaded_file.ok_or("yt-dlp succeeded but no WAV file was found in temp dir")?;

        let result = import::process_import(&app, &temp_file.to_string_lossy(), &name);
        
        let _ = fs::remove_file(temp_file);

        result
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
