use rodio::{cpal::traits::{DeviceTrait, HostTrait}, Decoder, OutputStream, Sink};
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::{self, Sender};
use std::thread;
use tauri::{AppHandle, Manager, State};

pub enum AudioCommand {
    Play { id: String, path: String, target_devices: Vec<String>, allow_overlap: bool },
    Stop { id: String },
    StopAll,
}

pub struct AudioState {
    pub sender: Sender<AudioCommand>,
}

/// Initializes the dedicated background audio thread.
/// Because `rodio::Sink` and `OutputStream` are `!Send` on ALSA (Linux), 
/// we MUST keep them confined to a single thread. We communicate with this 
/// thread via channels.
pub fn init_audio_engine() -> AudioState {
    let (tx, rx) = mpsc::channel::<AudioCommand>();

    thread::spawn(move || {
        // active_playbacks maps an ID to a list of (OutputStream, Sink) pairs.
        // We MUST keep the OutputStream alive, otherwise the Sink dies immediately.
        let mut active_playbacks: HashMap<String, Vec<(OutputStream, Sink)>> = HashMap::new();

        for cmd in rx {
            // Housekeeping: remove finished sinks so we don't leak memory
            active_playbacks.retain(|_, playbacks| {
                playbacks.retain(|(_, sink)| !sink.empty());
                !playbacks.is_empty()
            });

            match cmd {
                AudioCommand::Play { id, path, target_devices, allow_overlap } => {
                    if !allow_overlap {
                        // Stop ALL existing sounds if overlap is not allowed
                        for (_, playbacks) in active_playbacks.drain() {
                            for (_, sink) in playbacks {
                                sink.stop();
                            }
                        }
                    } else {
                        // STOP ON RETRIGGER (monophonic per-sound always)
                        if let Some(existing_playbacks) = active_playbacks.remove(&id) {
                            for (_, sink) in existing_playbacks {
                                sink.stop(); // Stops immediately
                            }
                        }
                    }

                    let mut playbacks = Vec::new();

                    for device_name in target_devices {
                        // On Linux, cpal/rodio uses ALSA, which talks to PulseAudio via the "default" device.
                        // We can route to a specific PulseAudio sink by temporarily setting the PULSE_SINK env var.
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
                            // Just use try_default()! If PULSE_SINK is set, ALSA routes it there natively on Linux.
                            Some(OutputStream::try_default())
                        };

                        // Clean up env var immediately
                        #[cfg(target_os = "linux")]
                        std::env::remove_var("PULSE_SINK");

                        if let Some(Ok((stream, handle))) = stream_res {
                            if let Ok(file) = File::open(&path) {
                                let reader = BufReader::new(file);
                                if let Ok(source) = Decoder::new(reader) {
                                    if let Ok(sink) = Sink::try_new(&handle) {
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
            }
        }
    });

    AudioState { sender: tx }
}

/// Internal equivalent for hotkeys to call.
pub fn play_or_stop_sound_internal(app: &AppHandle, id: String, path: String, target_devices: Vec<String>, allow_overlap: bool) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.sender
        .send(AudioCommand::Play { id, path, target_devices, allow_overlap })
        .map_err(|e| format!("Failed to send audio command: {}", e))
}

/// Expose play_sound to the frontend.
#[tauri::command]
pub fn play_sound(app: tauri::AppHandle, id: String, path: String, target_devices: Vec<String>, allow_overlap: bool) -> Result<(), String> {
    play_or_stop_sound_internal(&app, id, path, target_devices, allow_overlap)
}

#[tauri::command]
pub fn stop_all_audio(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.sender
        .send(AudioCommand::StopAll)
        .map_err(|e| format!("Failed to send StopAll command: {}", e))
}
