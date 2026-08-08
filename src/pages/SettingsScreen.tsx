import React, { useEffect, useState } from 'react';
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

    const labelStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0',
        fontSize: '0.95em',
    };

    const sectionStyle: React.CSSProperties = {
        marginBottom: '28px',
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <button
                    onClick={onBack}
                    style={{ background: 'none', border: '1px solid #dee2e6', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}
                >
                    ← Back
                </button>
                <h1 style={{ margin: 0, fontSize: '1.4em' }}>Settings</h1>
            </div>

            {/* Audio */}
            <div style={sectionStyle}>
                <h2 style={{ fontSize: '1em', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Audio</h2>

                <div style={labelStyle}>
                    <label htmlFor="master-volume">Master Volume</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            id="master-volume"
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={config.master_volume}
                            onChange={e => update('master_volume', parseFloat(e.target.value))}
                            style={{ width: '140px' }}
                        />
                        <span style={{ minWidth: '36px', textAlign: 'right' }}>
                            {Math.round(config.master_volume * 100)}%
                        </span>
                    </div>
                </div>

                <div style={labelStyle}>
                    <label htmlFor="output-device">Output Device</label>
                    <select
                        id="output-device"
                        value={config.output_devices[0] ?? 'default'}
                        onChange={e => update('output_devices', [e.target.value])}
                        style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '180px' }}
                    >
                        {outputDevices.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Behaviour */}
            <div style={sectionStyle}>
                <h2 style={{ fontSize: '1em', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Behaviour</h2>

                <div style={labelStyle}>
                    <label htmlFor="minimize-to-tray">Minimize to tray on close</label>
                    <input
                        id="minimize-to-tray"
                        type="checkbox"
                        checked={config.minimize_to_tray}
                        onChange={e => update('minimize_to_tray', e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                </div>

                <div style={labelStyle}>
                    <label htmlFor="autostart">
                        Launch on login
                        {autostartBusy && <span style={{ marginLeft: '8px', color: '#6c757d', fontSize: '0.85em' }}>saving…</span>}
                    </label>
                    <input
                        id="autostart"
                        type="checkbox"
                        checked={config.autostart}
                        disabled={autostartBusy}
                        onChange={e => handleAutostartToggle(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: autostartBusy ? 'not-allowed' : 'pointer' }}
                    />
                </div>

                <div style={labelStyle}>
                    <label htmlFor="allow-overlap">Allow overlapping sounds</label>
                    <input
                        id="allow-overlap"
                        type="checkbox"
                        checked={config.allow_overlap}
                        onChange={e => update('allow_overlap', e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                </div>

                <div style={labelStyle}>
                    <label htmlFor="stop-all-hotkey">Stop All Sounds Hotkey</label>
                    <input
                        id="stop-all-hotkey"
                        type="text"
                        readOnly
                        placeholder="Click here, then press keys…"
                        value={config.stop_all_hotkey ?? ''}
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
                            const combo = parts.join('+');
                            if (parts.length > 1) {
                                update('stop_all_hotkey', combo);
                            }
                        }}
                        onFocus={e => { if (!config.stop_all_hotkey) e.target.placeholder = 'Press your hotkey combo…'; }}
                        onBlur={e => { e.target.placeholder = 'Click here, then press keys…'; }}
                        style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '180px', cursor: 'pointer', caretColor: 'transparent' }}
                    />
                    {config.stop_all_hotkey && (
                        <button
                            onClick={() => update('stop_all_hotkey', null)}
                            style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', fontSize: '1.1em' }}
                            title="Clear hotkey"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
