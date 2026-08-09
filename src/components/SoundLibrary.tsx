import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config, SoundEntry } from '../types/config';
import { HotkeyRecorder } from './HotkeyRecorder';
import { tileColor } from '../utils/tileColor';
import { WaveformIcon } from './WaveformIcon';
import { VolumeSlider } from './VolumeSlider';
import { useNamePrompt } from '../hooks/useNamePrompt';
import { ConfirmDialog } from './ConfirmDialog';
import { useClosingState } from '../hooks/useClosingState';

interface Props {
    sounds: SoundEntry[];
    config: Config;
    playingId: string | null;
    onConfigChange: (updated: Config) => Promise<void>;
    onPlayingChange: (id: string | null, name: string | null) => void;
}

interface ContextMenu {
    x: number;
    y: number;
    sound: SoundEntry;
}

export function SoundLibrary({ sounds, config, playingId, onConfigChange, onPlayingChange }: Props) {
    const { askForName, dialog: namePromptDialog } = useNamePrompt();
    const [deleteTarget, setDeleteTarget] = useState<SoundEntry | null>(null);
    const { closing: hotkeyClosing, close: closeHotkeyModal } = useClosingState();
    const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);
    const [hotkeyTarget, setHotkeyTarget] = useState<SoundEntry | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ctxMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setCtxMenu(null);
            }
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [ctxMenu]);

    useEffect(() => {
        if (playingId) {
            const sound = sounds.find(s => s.id === playingId);
            onPlayingChange(playingId, sound?.name ?? null);
        } else {
            onPlayingChange(null, null);
        }
    }, [playingId, sounds, onPlayingChange]);

    const handlePlay = useCallback((sound: SoundEntry) => {
        invoke('play_sound', {
            id: sound.id,
            path: sound.file,
            targetDevices: config.output_devices,
            allowOverlap: config.allow_overlap,
            volume: config.master_volume * (sound.volume ?? 1),
        }).catch(err => console.error('play_sound failed', err));

        if (!config.allow_overlap) {
            onPlayingChange(sound.id, sound.name);
        } else {
            onPlayingChange(playingId === sound.id ? null : sound.id, playingId === sound.id ? null : sound.name);
        }
    }, [config, playingId, onPlayingChange]);

    const MENU_WIDTH = 200;
    const MENU_HEIGHT = 280;

    const handleContextMenu = (e: React.MouseEvent, sound: SoundEntry) => {
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8);
        const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8);
        setCtxMenu({ x: Math.max(8, x), y: Math.max(8, y), sound });
    };

    const requestDelete = (sound: SoundEntry) => {
        setCtxMenu(null);
        setDeleteTarget(sound);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        const sound = deleteTarget;
        const updated: Config = {
            ...config,
            sounds: config.sounds.filter(s => s.id !== sound.id),
        };
        onConfigChange(updated);
        if (playingId === sound.id) onPlayingChange(null, null);
        setDeleteTarget(null);
    };

    const handleRename = async (sound: SoundEntry) => {
        setCtxMenu(null);
        const newName = await askForName('Rename sound', sound.name);
        if (!newName || newName === sound.name) return;
        const updated: Config = {
            ...config,
            sounds: config.sounds.map(s => s.id === sound.id ? { ...s, name: newName } : s),
        };
        onConfigChange(updated);
    };

    const handleVolumeChange = (sound: SoundEntry, vol: number) => {
        const updated: Config = {
            ...config,
            sounds: config.sounds.map(s => s.id === sound.id ? { ...s, volume: vol } : s),
        };
        onConfigChange(updated);
    };

    return (
        <>
            {namePromptDialog}

            <div className="tile-grid">
                {sounds.length === 0 && (
                    <div style={{ padding: '60px 40px', textAlign: 'center', background: 'var(--surface-2)', border: '0.5px solid var(--border-subtle)', borderRadius: '16px', color: 'var(--text-secondary)', fontSize: '14px', gridColumn: '1 / -1' }}>
                        No sounds yet. Drag &amp; drop an audio file here, or click <strong>+ Add Sound</strong>.
                    </div>
                )}
                {sounds.map(sound => {
                    const color = tileColor(sound.id);
                    const isPlaying = playingId === sound.id;
                    return (
                        <div
                            key={sound.id}
                            className={`sound-tile ${isPlaying ? 'playing' : ''}`}
                            onClick={() => handlePlay(sound)}
                            onContextMenu={e => handleContextMenu(e, sound)}
                            title={sound.name}
                            style={{
                                ['--chip-color' as any]: color.bg,
                                ...(isPlaying ? {
                                    border: `2px solid ${color.bg}`,
                                    ['--glow-color' as any]: `${color.bg}55`,
                                } : {})
                            }}
                        >
                            <div className="sound-tile__chip">
                                <WaveformIcon animate={isPlaying} color={color.icon} />
                            </div>

                            <span className="sound-tile__name">{sound.name}</span>

    <div className="sound-tile__keys">
        {sound.hotkey && sound.hotkey.split('+').map((key, i) => (
            <span key={i} className="sound-tile__key">{key}</span>
        ))}
    </div>

                        </div>
                    );
                })}
            </div>

            {ctxMenu && (() => {
    const liveSound = sounds.find(s => s.id === ctxMenu.sound.id) ?? ctxMenu.sound;
    return (
        <div ref={menuRef} className="ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
            <button className="ctx-menu__item" onClick={() => { setCtxMenu(null); handlePlay(liveSound); }}>
                <i className="ti ti-player-play"></i> Play
            </button>
            <div className="ctx-menu__divider" />
            <button className="ctx-menu__item" onClick={() => { setCtxMenu(null); setHotkeyTarget(liveSound); }}>
                <i className="ti ti-keyboard"></i> Set Hotkey
            </button>
            <button className="ctx-menu__item" onClick={() => handleRename(liveSound)}>
                <i className="ti ti-pencil"></i> Rename
            </button>
            <div className="ctx-menu__divider" />
            <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="ti ti-volume-2" style={{ fontSize: '13px' }}></i>Volume
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {Math.round((liveSound.volume ?? 1) * 100)}%
                    </span>
                </div>
                <VolumeSlider
                    className="ctx-menu__volume-track"
                    value={liveSound.volume ?? 1}
                    onChange={(v) => {
                        handleVolumeChange(liveSound, v);
                        if (playingId === liveSound.id) {
                            invoke('set_volume', { id: liveSound.id, volume: config.master_volume * v }).catch(console.error);
                        }
                    }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>Scroll to adjust</div>
            </div>
            <div className="ctx-menu__divider" />
            <button className="ctx-menu__item ctx-menu__item--danger" onClick={() => requestDelete(liveSound)}>
                <i className="ti ti-trash"></i> Delete
            </button>
        </div>
    );
})()}

            {deleteTarget && (
                <ConfirmDialog
                    title="Delete sound?"
                    message={`"${deleteTarget.name}" will be permanently removed from your library.`}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {hotkeyTarget && (
                <div
                    className={`modal-backdrop ${hotkeyClosing ? 'modal-backdrop--closing' : ''}`}
                    onClick={() => closeHotkeyModal(() => setHotkeyTarget(null))}
                >
                    <div
                        className="modal-card"
                        style={{ padding: '28px 32px', minWidth: '280px', textAlign: 'center' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Setting hotkey for</div>
                        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-primary)' }}>{hotkeyTarget.name}</div>
                        <HotkeyRecorder
                            soundId={hotkeyTarget.id}
                            currentHotkey={hotkeyTarget.hotkey ?? null}
                            config={config}
                            onHotkeyChange={async (updated) => {
                                await onConfigChange(updated);
                                closeHotkeyModal(() => setHotkeyTarget(null));
                            }}
                        />
                        <div style={{ marginTop: '16px' }}>
                            <button className="btn-primary" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} onClick={() => closeHotkeyModal(() => setHotkeyTarget(null))}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}