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
            <div style={{
                padding: '40px',
                textAlign: 'center',
                background: '#f8f9fa',
                borderRadius: '8px',
                color: '#6c757d',
                marginTop: '10px',
            }}>
                No sounds yet. Drag &amp; drop an audio file here, or click <strong>+ Add Sound</strong>.
            </div>
        );
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '15px',
            marginTop: '10px',
        }}>
            {sounds.map(sound => (
                <div
                    key={sound.id}
                    style={{
                        border: '1px solid #dee2e6',
                        padding: '15px',
                        borderRadius: '8px',
                        background: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}
                >
                    <strong style={{ fontSize: '1.05em' }}>{sound.name}</strong>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                            style={{
                                padding: '7px 14px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
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
                            currentHotkey={sound.hotkey}
                            config={config}
                            onHotkeyChange={onConfigChange}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
