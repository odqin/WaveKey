use crate::config::{self, SoundEntry};
use hound::{SampleFormat, WavSpec, WavWriter};
use std::fs::File;
use std::path::PathBuf;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn import_sound(app: AppHandle, source_path: String, name: String) -> Result<SoundEntry, String> {
    process_import(&app, &source_path, &name)
}

pub fn process_import(app: &AppHandle, source_path: &str, name: &str) -> Result<SoundEntry, String> {
    // 1. Generate unique ID
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let id = format!("sound_{}", timestamp);

    // 2. Resolve destination path
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    let sounds_dir = app_data_dir.join("sounds");
    std::fs::create_dir_all(&sounds_dir).map_err(|e| e.to_string())?;

    let dest_filename = format!("{}.wav", id);
    let dest_path = sounds_dir.join(&dest_filename);

    // 3. Conversion via symphonia -> hound
    convert_to_wav(&source_path, &dest_path)?;

    // 4. Update config via config.rs
    let mut current_config = config::get_config(app.clone());
    let new_entry = SoundEntry {
        id: id.clone(),
        name: name.to_string(),
        file: dest_path.to_string_lossy().to_string(),
        hotkey: None,
        volume: 1.0,
    };
    current_config.sounds.push(new_entry.clone());
    config::save_config(app.clone(), current_config)?;

    Ok(new_entry)
}

fn convert_to_wav(source: &str, dest: &PathBuf) -> Result<(), String> {
    let src_file = File::open(source).map_err(|e| format!("Failed to open source file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(src_file), Default::default());
    let hint = Hint::new();

    let format_opts = FormatOptions {
        enable_gapless: true,
        ..Default::default()
    };
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Failed to probe audio format: {}", e))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or("No audio track found in file")?;

    let dec_opts = DecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &dec_opts)
        .map_err(|e| format!("Failed to initialize decoder: {}", e))?;

    let channels = track.codec_params.channels.ok_or("Unknown channel count")?.count() as u16;
    let sample_rate = track.codec_params.sample_rate.ok_or("Unknown sample rate")?;

    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let mut writer = WavWriter::create(dest, spec).map_err(|e| format!("Failed to create WAV file: {}", e))?;

    let mut sample_buf = None;
    let track_id = track.id; // Extract track_id so the immutable borrow of `format` is dropped before the loop!

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(_)) => break, // EOF
            Err(e) => return Err(format!("Error reading packet: {}", e)),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(audio_buf) => {
                if sample_buf.is_none() {
                    let spec = *audio_buf.spec();
                    let duration = audio_buf.capacity() as u64;
                    sample_buf = Some(SampleBuffer::<i16>::new(duration, spec));
                }

                if let Some(buf) = &mut sample_buf {
                    buf.copy_interleaved_ref(audio_buf);
                    for &sample in buf.samples() {
                        writer.write_sample(sample).map_err(|e| format!("Failed to write sample: {}", e))?;
                    }
                }
            }
            Err(symphonia::core::errors::Error::DecodeError(_)) => {
                // Recoverable error, skip packet
            }
            Err(e) => return Err(format!("Error decoding packet: {}", e)),
        }
    }

    writer.finalize().map_err(|e| format!("Failed to finalize WAV: {}", e))?;
    Ok(())
}
