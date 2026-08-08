export interface SoundEntry {
    id: string;
    name: string;
    file: string;
    hotkey: string | null;
    volume: number;
}

export interface Config {
    master_volume: number;
    output_devices: string[];
    sounds: SoundEntry[];
    /** When true, closing the main window minimizes to tray instead of quitting. */
    minimize_to_tray: boolean;
    /** When true, the app launches on OS login. */
    autostart: boolean;
    allow_overlap: boolean;
    stop_all_hotkey: string | null;
}
