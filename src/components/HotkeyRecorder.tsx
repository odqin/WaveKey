import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types/config';

interface Props {
    /** The sound entry ID whose hotkey is being recorded. */
    soundId: string;
    /** The currently assigned hotkey string, or null if none. */
    currentHotkey: string | null;
    /**
     * The full current config object. Passed in from the parent so this
     * component never calls `get_config` itself — it reads from the shared
     * hook and mutates via `saveConfig`.
     */
    config: Config;
    /**
     * Called with the updated config after a hotkey is saved, so the parent
     * hook's state stays in sync (one source of truth).
     */
    onHotkeyChange: (updated: Config) => Promise<void>;
}

/**
 * `HotkeyRecorder` listens for a keyboard combination and persists it as the
 * hotkey for a specific sound entry. It delegates config persistence entirely
 * to the `onHotkeyChange` prop — it does not call `save_config` directly.
 */
export function HotkeyRecorder({ soundId, currentHotkey, config, onHotkeyChange }: Props) {
    const [recording, setRecording] = useState(false);

    useEffect(() => {
        if (!recording) return;

        const handleKeyDown = async (e: KeyboardEvent) => {
            e.preventDefault();

            const keys: string[] = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.shiftKey) keys.push('Shift');
            if (e.altKey) keys.push('Alt');
            if (e.metaKey) keys.push('Command');

            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            let key = e.key.toUpperCase();
            if (key === ' ') key = 'Space';
            keys.push(key);

            const comboStr = keys.join('+');
            setRecording(false);

            const soundIndex = config.sounds.findIndex(s => s.id === soundId);
            if (soundIndex === -1) return;

            const updated: Config = {
                ...config,
                sounds: config.sounds.map(s =>
                    s.id === soundId ? { ...s, hotkey: comboStr } : s
                ),
            };

            try {
                await onHotkeyChange(updated);
                await invoke('register_hotkey', { soundId, combo: comboStr });
            } catch (err) {
                console.error('Failed to save or register hotkey', err);
                alert(`Error saving hotkey: ${err}`);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recording, soundId, config, onHotkeyChange]);

    return (
    <div className="hotkey-recorder">
        <button
            className={`hotkey-recorder__btn${recording ? ' hotkey-recorder__btn--recording' : ''}`}
            onClick={() => setRecording(true)}
        >
            {recording ? '● Listening…' : 'Set Hotkey'}
        </button>
        <span className="hotkey-recorder__chip">
            {currentHotkey ?? 'No hotkey set'}
        </span>
    </div>
);
}
