import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types/config';
import { HotkeyKeycapInput } from '../components/HotkeyKeycapInput';
import { getVersion } from '@tauri-apps/api/app';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
interface Props {
    config: Config;
    onConfigChange: (updated: Config) => Promise<void>;
    onBack: () => void;
}

export function SettingsScreen({ config, onConfigChange, onBack }: Props) {
    const [outputDevices, setOutputDevices] = useState<string[]>([]);
    const [autostartBusy, setAutostartBusy] = useState(false);
    const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
const [appVersion, setAppVersion] = useState('');

useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('—'));
}, []);
    useEffect(() => {
        invoke<string[]>('get_output_devices')
            .then(setOutputDevices)
            .catch(err => console.error('Failed to fetch output devices:', err));
    }, []);

    async function update<K extends keyof Config>(key: K, value: Config[K]) {
        await onConfigChange({ ...config, [key]: value });
    }

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

    const currentDevice = config.output_devices[0] ?? 'default';

    return (
        <div className="app-shell">
            <div className="main-container">
                <div className="settings-header-container">
                    <button className="settings-back-btn" onClick={onBack}>
                        <i className="ti ti-chevron-left"></i>
                        <span>Back</span>
                    </button>
                    <span className="settings-title">Settings</span>
                </div>

                <div className="settings-section-title">Audio</div>
                <div className="settings-group">
                    <div className="settings-row" style={{ borderBottom: 'none' }}>
                        <span className="settings-label">Output device</span>
                        
                        {/* Custom Dropdown */}
                        <div style={{ position: 'relative' }}>
                            <div
                                className="custom-dropdown-trigger"
                                onClick={() => setDeviceDropdownOpen(!deviceDropdownOpen)}
                            >
                                <span>{currentDevice}</span>
                                <i className="ti ti-chevron-down"></i>
                            </div>
                            
                            {deviceDropdownOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setDeviceDropdownOpen(false)}></div>
                                    <div className="ctx-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100, minWidth: '100%', animation: 'none', background: 'var(--surface-1)' }}>
                                        {outputDevices.map(d => (
                                            <button
                                                key={d}
                                                className="ctx-menu__item"
                                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                                onClick={() => {
                                                    update('output_devices', [d]);
                                                    setDeviceDropdownOpen(false);
                                                }}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="settings-section-title">Behaviour</div>
                <div className="settings-group">
                    <div className="settings-row">
                        <span className="settings-label">Minimize to tray on close</span>
                        <div
                            className={`custom-toggle ${config.minimize_to_tray ? 'on' : 'off'}`}
                            onClick={() => update('minimize_to_tray', !config.minimize_to_tray)}
                        >
                            <div className="custom-toggle-thumb"></div>
                        </div>
                    </div>

                    <div className="settings-row">
                        <span className="settings-label">Launch on login {autostartBusy && <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '6px' }}>(saving...)</span>}</span>
                        <div
                            className={`custom-toggle ${config.autostart ? 'on' : 'off'}`}
                            onClick={() => {
                                if (!autostartBusy) handleAutostartToggle(!config.autostart);
                            }}
                            style={{ opacity: autostartBusy ? 0.5 : 1, cursor: autostartBusy ? 'not-allowed' : 'pointer' }}
                        >
                            <div className="custom-toggle-thumb"></div>
                        </div>
                    </div>

                    <div className="settings-row">
                        <span className="settings-label">Allow overlapping sounds</span>
                        <div
                            className={`custom-toggle ${config.allow_overlap ? 'on' : 'off'}`}
                            onClick={() => update('allow_overlap', !config.allow_overlap)}
                        >
                            <div className="custom-toggle-thumb"></div>
                        </div>
                    </div>

                   <div className="settings-row" style={{ borderBottom: 'none' }}>
                    <span className="settings-label">Stop all sounds hotkey</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <HotkeyKeycapInput
                      value={config.stop_all_hotkey}
                      onRecord={async (combo) => {
                      try {
                    await invoke('register_hotkey', { soundId: '__STOP_ALL__', combo });
                    await update('stop_all_hotkey', combo);
                     } catch (err) {
                    alert(`Failed to register hotkey: ${err}`);
                        }
                           }}
                         />
                      {config.stop_all_hotkey && (
                     <button
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
                          onClick={async () => {
                      try {
                             await invoke('unregister_hotkey', { soundId: '__STOP_ALL__' });
                           } catch (err) {
                        console.error('Failed to unregister stop-all hotkey', err);
                    }
                         update('stop_all_hotkey', null);
                        }}
                         title="Clear hotkey"
                    >
                       <i className="ti ti-x"></i>
                           </button>
                        )}
                      </div>
                        </div>
                       </div>
                       <div className="settings-section-title">About</div>
<div className="settings-group">
    <div className="settings-row" style={{ alignItems: 'flex-start' }}>
        <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>WaveKey</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>
                    v{appVersion || '—'}
                </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                A lightweight local soundboard for clips, hotkeys, and quick playback.
            </span>
        </div>
    </div>

    <div className="settings-row" style={{ borderBottom: 'none' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
            <span
                className="settings-label"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => shellOpen('https://github.com/odqin/WaveKey')}
            >
                GitHub <i className="ti ti-external-link" style={{ fontSize: '12px' }}></i>
            </span>
            <span
                className="settings-label"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => shellOpen('https://github.com/odqin/WaveKey/issues/new')}
            >
                Report an issue <i className="ti ti-external-link" style={{ fontSize: '12px' }}></i>
            </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>© 2026 WaveKey</span>
    </div>
</div>
                        </div>

                 </div>
                 
    );
}
