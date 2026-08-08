import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types/config';

interface Props {
    /** Current config to display and mutate. */
    config: Config;
    /**
     * Persists an updated config and syncs state up through the `useConfig`
     * hook. SettingsScreen never writes config directly — it delegates here.
     */
    onConfigChange: (updated: Config) => Promise<void>;
    /** Navigates back to the main sound library view. */
    onBack: () => void;
}

/**
 * `SettingsScreen` renders the full settings panel. All mutations go through
 * `onConfigChange`, which calls `useConfig`'s `saveConfig`. The screen never
 * calls `save_config` directly — one function, one home.
 */
export function SettingsScreen({ config, onConfigChange, onBack }: Props) {
    const [outputDevices, setOutputDevices] = useState<string[]>([]);
    const [autostartBusy, setAutostartBusy] = useState(false);

    // Load platform output devices on mount
    useEffect(() => {
        invoke<string[]>('get_output_devices')
            .then(setOutputDevices)
            .catch(err => console.error('Failed to fetch output devices:', err));
    }, []);

    /** Updates a single field in config and persists immediately. */
    async function update<K extends keyof Config>(key: K, value: Config[K]) {
        await onConfigChange({ ...config, [key]: value });
    }

    /** Toggle autostart — must also call the plugin's enable/disable command. */
    async function handleAutostartToggle(enabled: boolean) {
        setAutostartBusy(true);
        try {
            if (enabled) {
                await invoke('plugin:autostart|enable');
            } else {
                await invoke('plugin:autostart|disable');
            }
            await update('autostart', enabled);
        } catch (err) {
            alert(`Failed to toggle autostart: ${err}`);
        } finally {
            setAutostartBusy(false);
        }
    }

    return (
        <div className="settings-shell">
            {/* Header */}
            <div className="settings-header">
                <button className="btn btn--ghost" onClick={onBack}>
                    ← Back
                </button>
                <h1 className="settings-header__title">Settings</h1>
            </div>

            {/* Audio Section */}
            <div className="settings-section">
                <div className="settings-section__label">Audio</div>
                <div className="settings-group">

                    <div className="settings-row">
                        <label className="settings-row__label" htmlFor="master-volume">
                            Master Volume
                        </label>
                        <div className="settings-row__control">
                            <input
                                id="master-volume"
                                type="range"
                                className="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={config.master_volume}
                                onChange={e => update('master_volume', parseFloat(e.target.value))}
                            />
                            <span className="volume-value">
                                {Math.round(config.master_volume * 100)}%
                            </span>
                        </div>
                    </div>

                    <div className="settings-row">
                        <label className="settings-row__label" htmlFor="output-device">
                            Output Device
                        </label>
                        <div className="settings-row__control">
                            <select
                                id="output-device"
                                className="select"
                                value={config.output_devices[0] ?? 'default'}
                                onChange={e => update('output_devices', [e.target.value])}
                            >
                                {outputDevices.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                </div>
            </div>

            {/* Behaviour Section */}
            <div className="settings-section">
                <div className="settings-section__label">Behaviour</div>
                <div className="settings-group">

                    <div className="settings-row">
                        <label className="settings-row__label" htmlFor="minimize-to-tray">
                            Minimize to tray on close
                        </label>
                        <div className="settings-row__control">
                            <label className="toggle">
                                <input
                                    id="minimize-to-tray"
                                    type="checkbox"
                                    checked={config.minimize_to_tray}
                                    onChange={e => update('minimize_to_tray', e.target.checked)}
                                />
                                <span className="toggle__track" />
                                <span className="toggle__thumb" />
                            </label>
                        </div>
                    </div>

                    <div className="settings-row">
                        <label className="settings-row__label" htmlFor="autostart">
                            Launch on login
                            {autostartBusy && (
                                <span className="settings-row__sublabel">saving…</span>
                            )}
                        </label>
                        <div className="settings-row__control">
                            <label className="toggle">
                                <input
                                    id="autostart"
                                    type="checkbox"
                                    checked={config.autostart}
                                    disabled={autostartBusy}
                                    onChange={e => handleAutostartToggle(e.target.checked)}
                                />
                                <span className="toggle__track" />
                                <span className="toggle__thumb" />
                            </label>
                        </div>
                    </div>

                    <div className="settings-row">
                        <label className="settings-row__label" htmlFor="allow-overlap">
                            Allow overlapping sounds
                        </label>
                        <div className="settings-row__control">
                            <label className="toggle">
                                <input
                                    id="allow-overlap"
                                    type="checkbox"
                                    checked={config.allow_overlap}
                                    onChange={e => update('allow_overlap', e.target.checked)}
                                />
                                <span className="toggle__track" />
                                <span className="toggle__thumb" />
                            </label>
                        </div>
                    </div>

                    <div className="settings-row">
                        <label className="settings-row__label" htmlFor="stop-all-hotkey">
                            Stop All Sounds Hotkey
                        </label>
                        <div className="settings-row__control">
                            <input
                                id="stop-all-hotkey"
                                type="text"
                                className="input"
                                readOnly
                                placeholder="Click, then press keys…"
                                value={config.stop_all_hotkey ?? ''}
                                style={{ minWidth: '160px', caretColor: 'transparent', cursor: 'pointer' }}
                                onKeyDown={e => {
                                    e.preventDefault();
                                    const parts: string[] = [];
                                    if (e.ctrlKey) parts.push('Ctrl');
                                    if (e.altKey) parts.push('Alt');
                                    if (e.shiftKey) parts.push('Shift');
                                    if (e.metaKey) parts.push('Meta');
                                    const key = e.key;
                                    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                                        parts.push(key.toUpperCase());
                                    }
                                    if (parts.length > 1) {
                                        update('stop_all_hotkey', parts.join('+'));
                                    }
                                }}
                                onFocus={e => { if (!config.stop_all_hotkey) e.target.placeholder = 'Press combo…'; }}
                                onBlur={e => { e.target.placeholder = 'Click, then press keys…'; }}
                            />
                            {config.stop_all_hotkey && (
                                <button
                                    className="btn--clear"
                                    onClick={() => update('stop_all_hotkey', null)}
                                    title="Clear hotkey"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
