#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod audio;
mod config;
mod downloader;
mod hotkeys;
mod import;
mod virtual_device;
mod updater;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())   // add this
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(hotkeys::init_hotkey_manager())
        .manage(virtual_device::init())
        .setup(|app| {
            // Audio engine needs an AppHandle to emit events, so it's set up here
            // instead of via .manage() above.
            app.manage(audio::init_audio_engine(app.handle().clone()));

            // Register hotkeys from persisted config
            hotkeys::spawn_hotkey_listener(app.handle().clone());
            hotkeys::register_all_from_config(app.handle());

            // Build system tray with Show/Quit menu
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().cloned().unwrap())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            audio::play_sound,
            audio::stop_all_audio,
                audio::set_volume, // NEW

            config::get_config,
            config::save_config,
            hotkeys::register_hotkey,
            hotkeys::unregister_hotkey,
            virtual_device::get_output_devices,
            virtual_device::check_vbcable_installed,
            virtual_device::install_vbcable,
            import::import_sound,
            downloader::import_from_youtube,
            updater::check_for_update
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "main" => {
                let cfg = config::get_config(app_handle.clone());
                if cfg.minimize_to_tray {
                    api.prevent_close();
                    if let Some(win) = app_handle.get_webview_window("main") {
                        let _ = win.hide();
                    }
                }
            }
            RunEvent::Exit => {
                let state = app_handle.state::<virtual_device::VirtualDeviceState>();
                virtual_device::cleanup(&state);
            }
            _ => {}
        });
}
