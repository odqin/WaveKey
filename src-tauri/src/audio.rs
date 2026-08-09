use rodio::{cpal::traits::{DeviceTrait, HostTrait}, Decoder, OutputStream, Sink};
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

pub enum AudioCommand {
    Play { id: String, path: String, target_devices: Vec<String>, allow_overlap: bool, volume: f32 },
    Stop { id: String },
    StopAll,
    SetVolume { id: String, volume: f32 }, // NEW
}

pub struct AudioState {
    pub sender: Sender<AudioCommand>,
}

/// Initializes the dedicated background audio thread.
/// Because `rodio::Sink` and `OutputStream` are `!Send` on ALSA (Linux), 
/// we MUST keep them confined to a single thread. We communicate with this 
/// thread via channels.
pub fn init_audio_engine(app: AppHandle) -> AudioState {
    let (tx, rx) = mpsc::channel::<AudioCommand>();

    thread::spawn(move || {
        let mut active_playbacks: HashMap<String, Vec<(OutputStream, Sink)>> = HashMap::new();

        loop {
            match rx.recv_timeout(Duration::from_millis(150)) {
                Ok(cmd) => {
                    prune_finished(&mut active_playbacks, &app);

                    match cmd {
                        AudioCommand::Play { id, path, target_devices, allow_overlap, volume } => {
                            if !allow_overlap {
                                for (_, playbacks) in active_playbacks.drain() {
                                    for (_, sink) in playbacks {
                                        sink.stop();
                                    }
                                }
                            } else {
                                if let Some(existing_playbacks) = active_playbacks.remove(&id) {
                                    for (_, sink) in existing_playbacks {
                                        sink.stop();
                                    }
                                }
                            }

                            let mut playbacks = Vec::new();

                            for device_name in target_devices {
                                #[cfg(target_os = "linux")]
                                {
                                    if device_name != "default" {
                                        std::env::set_var("PULSE_SINK", &device_name);
                                    } else {
                                        std::env::remove_var("PULSE_SINK");
                                    }
                                }

                                #[cfg(target_os = "windows")]
                                let stream_res = {
                                    if device_name == "default" {
                                        Some(OutputStream::try_default())
                                    } else {
                                        use rodio::cpal::traits::{DeviceTrait, HostTrait};
                                        let host = rodio::cpal::default_host();
                                        if let Ok(mut devices) = host.output_devices() {
                                            if let Some(device) = devices.find(|d| d.name().unwrap_or_default() == device_name) {
                                                Some(OutputStream::try_from_device(&device))
                                            } else {
                                                None
                                            }
                                        } else {
                                            None
                                        }
                                    }
                                };

                                #[cfg(not(target_os = "windows"))]
                                let stream_res = {
                                    Some(OutputStream::try_default())
                                };

                                #[cfg(target_os = "linux")]
                                std::env::remove_var("PULSE_SINK");

                                if let Some(Ok((stream, handle))) = stream_res {
                                    if let Ok(file) = File::open(&path) {
                                        let reader = BufReader::new(file);
                                        if let Ok(source) = Decoder::new(reader) {
                                            if let Ok(sink) = Sink::try_new(&handle) {
                                                sink.set_volume(volume);
                                                sink.append(source);
                                                sink.play();
                                                playbacks.push((stream, sink));
                                            }
                                        } else {
                                            eprintln!("Failed to decode audio file: {}", path);
                                        }
                                    } else {
                                        eprintln!("Failed to open audio file: {}", path);
                                    }
                                } else {
                                    eprintln!("Failed to open audio stream for device: {}", device_name);
                                }
                            }

                            if !playbacks.is_empty() {
                                active_playbacks.insert(id, playbacks);
                            }
                        }
                        AudioCommand::Stop { id } => {
                            if let Some(playbacks) = active_playbacks.remove(&id) {
                                for (_, sink) in playbacks {
                                    sink.stop();
                                }
                            }
                        }
                        AudioCommand::StopAll => {
                            for (_, playbacks) in active_playbacks.drain() {
                                for (_, sink) in playbacks {
                                    sink.stop();
                                }
                            }
                        }
                        AudioCommand::SetVolume { id, volume } => {
    if let Some(playbacks) = active_playbacks.get(&id) {
        for (_, sink) in playbacks {
            sink.set_volume(volume);
        }
    }
}
                    }
                }
                Err(RecvTimeoutError::Timeout) => {
                    // No new command — this is what catches naturally-finished sounds
                    prune_finished(&mut active_playbacks, &app);
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    AudioState { sender: tx }
}

/// Removes sinks that finished playing on their own, and notifies the frontend
/// so it can clear "now playing" state for hotkey-triggered sounds too.
fn prune_finished(active_playbacks: &mut HashMap<String, Vec<(OutputStream, Sink)>>, app: &AppHandle) {
    let mut finished_ids = Vec::new();

    active_playbacks.retain(|id, playbacks| {
        playbacks.retain(|(_, sink)| !sink.empty());
        if playbacks.is_empty() {
            finished_ids.push(id.clone());
            false
        } else {
            true
        }
    });

    for id in finished_ids {
        let _ = app.emit("sound_finished", id);
    }
}

/// Internal equivalent for hotkeys to call.
pub fn play_or_stop_sound_internal(app: &AppHandle, id: String, path: String, target_devices: Vec<String>, allow_overlap: bool, volume: f32) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.sender
        .send(AudioCommand::Play { id, path, target_devices, allow_overlap, volume })
        .map_err(|e| format!("Failed to send audio command: {}", e))
}

/// Expose play_sound to the frontend.
#[tauri::command]
pub fn play_sound(app: tauri::AppHandle, id: String, path: String, target_devices: Vec<String>, allow_overlap: bool, volume: f32) -> Result<(), String> {
    play_or_stop_sound_internal(&app, id, path, target_devices, allow_overlap, volume)
}

#[tauri::command]
pub fn stop_all_audio(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.sender
        .send(AudioCommand::StopAll)
        .map_err(|e| format!("Failed to send StopAll command: {}", e))
}
#[tauri::command]
pub fn set_volume(app: tauri::AppHandle, id: String, volume: f32) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.sender
        .send(AudioCommand::SetVolume { id, volume })
        .map_err(|e| format!("Failed to send SetVolume command: {}", e))
}
