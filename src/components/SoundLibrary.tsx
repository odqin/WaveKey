import { invoke } from '@tauri-apps/api/core';
import { Config, SoundEntry } from '../types/config';
import { HotkeyRecorder } from './HotkeyRecorder';

interface Props {
    /** Full list of sound entries to display. */
    sounds: SoundEntry[];
    /** Full config object, passed through to child components that need it. */
    config: Config;
    /**
     * Called with an updated config after any mutation (hotkey assignment, etc.)
     * so the parent `useConfig` hook stays as the single source of truth.
     */
    onConfigChange: (updated: Config) => Promise<void>;
}

/**
 * `SoundLibrary` renders the grid of sound cards. Each card shows the sound
 * name, its assigned hotkey (editable via `HotkeyRecorder`), and a play
 * button. It is a pure display component — all state lives in the parent's
 * `useConfig` hook.
 */
export function SoundLibrary({ sounds, config, onConfigChange }: Props) {
    if (sounds.length === 0) {
        return (
            <div className="sound-empty">
                No sounds yet. Drag &amp; drop an audio file here, or click <strong>+ Add Sound</strong>.
            </div>
        );
    }

    return (
        <div className="sound-grid">
            {sounds.map(sound => (
                <div key={sound.id} className="sound-card">
                    <div className="sound-card__name">{sound.name}</div>

                    <div className="sound-card__actions">
                        <button
                            className="btn btn--success"
                            onClick={() =>
                                invoke('play_sound', {
                                    id: sound.id,
                                    path: sound.file,
                                    targetDevices: config.output_devices,
                                    allowOverlap: config.allow_overlap,
                                })
                            }
                        >
                            ▶ Play
                        </button>

                        <HotkeyRecorder
                            soundId={sound.id}
                            currentHotkey={sound.hotkey ?? null}
                            config={config}
                            onHotkeyChange={onConfigChange}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
