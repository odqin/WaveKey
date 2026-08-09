import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { useConfig } from './hooks/useConfig';
import { SoundLibrary } from './components/SoundLibrary';
import { VolumeSlider } from './components/VolumeSlider';
import { WaveformIcon } from './components/WaveformIcon';
import { useNamePrompt } from './hooks/useNamePrompt';
import { tileColor } from './utils/tileColor';
import { SettingsScreen } from './pages/SettingsScreen';
import { open as shellOpen } from '@tauri-apps/plugin-shell';

type View = 'library' | 'settings';

interface UpdateInfo {
    version: string;
    release_url: string;
    body: string;
}

export default function App() {
    const { config, saveConfig, reload } = useConfig();
    const { askForName, dialog: namePromptDialog } = useNamePrompt();

    const [view, setView] = useState<View>('library');
    const [displayView, setDisplayView] = useState<View>('library');
    const [viewTransition, setViewTransition] = useState<'idle' | 'out' | 'in'>('idle');
    const [bannerVisible, setBannerVisible] = useState(false);

    const [importing, setImporting] = useState(false);
    const [ytUrl, setYtUrl] = useState('');
    const [ytImporting, setYtImporting] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

    const [playingId, setPlayingId] = useState<string | null>(null);
    const [playingName, setPlayingName] = useState<string | null>(null);

    const handlePlayingChange = useCallback((id: string | null, name: string | null) => {
        setPlayingId(id);
        setPlayingName(name);
    }, []);

    useEffect(() => {
        let unlistenPlay: (() => void) | null = null;
        let unlistenStop: (() => void) | null = null;
        let unlistenFinished: (() => void) | null = null;

        listen<string>('sound_played', event => {
            const id = event.payload;
            setPlayingId(id);
            if (config) {
                const sound = config.sounds.find(s => s.id === id);
                setPlayingName(sound?.name ?? null);
            }
        }).then(fn => { unlistenPlay = fn; });

        listen('stop_all', () => {
            setPlayingId(null);
            setPlayingName(null);
        }).then(fn => { unlistenStop = fn; });

        listen<string>('sound_finished', event => {
            const id = event.payload;
            setPlayingId(currentId => {
                if (currentId === id) {
                    setPlayingName(null);
                    return null;
                }
                return currentId;
            });
        }).then(fn => { unlistenFinished = fn; });

        return () => {
            if (unlistenPlay) unlistenPlay();
            if (unlistenStop) unlistenStop();
            if (unlistenFinished) unlistenFinished();
        };
    }, [config]);

    // Crossfade between library and settings
    useEffect(() => {
        if (view !== displayView) {
            setViewTransition('out');
            const t = setTimeout(() => {
                setDisplayView(view);
                setViewTransition('in');
            }, 200);
            return () => clearTimeout(t);
        }
    }, [view, displayView]);

    useEffect(() => {
        if (viewTransition === 'in') {
            const t = requestAnimationFrame(() => setViewTransition('idle'));
            return () => cancelAnimationFrame(t);
        }
    }, [viewTransition]);

    // Animate banner in when it appears
    useEffect(() => {
        if (updateInfo) {
            const t = requestAnimationFrame(() => setBannerVisible(true));
            return () => cancelAnimationFrame(t);
        }
    }, [updateInfo]);

    function dismissBanner() {
        setBannerVisible(false);
        setTimeout(() => setUpdateInfo(null), 250);
    }

    useEffect(() => {
        invoke<UpdateInfo | null>('check_for_update')
            .then(info => { if (info) setUpdateInfo(info); })
            .catch(err => console.error('Update check failed:', err));
    }, []);

    useEffect(() => {
        let unlisten: (() => void) | null = null;
        listen<{ paths: string[] }>('tauri://file-drop', async event => {
            const filePath = event.payload.paths[0];
            if (!filePath.match(/\.(mp3|wav|ogg|flac)$/i)) {
                alert('Unsupported file type. Supported formats: mp3, wav, ogg, flac.');
                return;
            }
            const name = filePath.split(/[/\\]/).pop()?.split('.')[0] ?? 'Imported Sound';
            try {
                await invoke('import_sound', { sourcePath: filePath, name });
                await reload();
            } catch (err) {
                alert(`Failed to import dropped sound: ${err}`);
            }
        }).then(fn => { unlisten = fn; });
        return () => { if (unlisten) unlisten(); };
    }, [reload]);

    async function handleAddSound() {
        setImporting(true);
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac'] }],
            });
            if (!selected) return;
            const filePath = typeof selected === 'string' ? selected : selected[0];
            const name = await askForName('Name this sound');
            if (!name) return;
            await invoke('import_sound', { sourcePath: filePath, name });
            await reload();
        } catch (err) {
            alert(`Failed to import sound: ${err}`);
        } finally {
            setImporting(false);
        }
    }

    async function handleYouTubeImport() {
        if (!ytUrl) return;
        const name = await askForName('Name this YouTube sound');
        if (!name) return;
        setYtImporting(true);
        try {
            await invoke('import_from_youtube', { url: ytUrl, name });
            setYtUrl('');
            await reload();
        } catch (err) {
            alert(`Failed to import from YouTube: ${err}`);
        } finally {
            setYtImporting(false);
        }
    }

    if (!config) {
        return (
            <div className="app-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Loading…</span>
            </div>
        );
    }

    const playingColor = playingId ? tileColor(playingId).bg : null;
    const playingIcon = playingId ? tileColor(playingId).icon : null;

    return (
        <div className={`view-transition view-transition--${viewTransition}`}>
            {displayView === 'settings' ? (
                <SettingsScreen
                    config={config}
                    onConfigChange={saveConfig}
                    onBack={() => setView('library')}
                />
            ) : (
                <div className="app-shell">
                    {namePromptDialog}
                    {updateInfo && (
                        <div className={`update-banner ${bannerVisible ? '' : 'update-banner--hidden'}`}
                             style={{ background: 'var(--surface-1)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-subtle)' }}>
                            <div>
                                <strong>Update available:</strong> v{updateInfo.version}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-primary" onClick={() => shellOpen(updateInfo.release_url)}>
                                    Download
                                </button>
                                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={dismissBanner} title="Dismiss">
                                    <i className="ti ti-x"></i>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="main-container">
                        <div className="header">
                            <span className="header__title">WaveKey</span>
                            <button className="header__settings-btn" onClick={() => setView('settings')}>
                                <i className="ti ti-settings header__settings-icon"></i>
                            </button>
                        </div>

                        <div className="toolbar">
                            <div className="yt-input-group">
                                <input
                                    type="text"
                                    className="yt-input"
                                    placeholder="Paste YouTube URL..."
                                    value={ytUrl}
                                    onChange={e => setYtUrl(e.target.value)}
                                />
                            </div>
                            <button className="btn-primary" onClick={handleYouTubeImport} disabled={ytImporting || !ytUrl}>
                                {ytImporting ? 'Downloading...' : 'YT Import'}
                            </button>
                            <button className="btn-primary" onClick={handleAddSound} disabled={importing}>
                                {importing ? 'Importing...' : '+ Add sound'}
                            </button>
                            <div style={{ flex: 1 }}></div>
                            <button className="btn-danger" onClick={() => { invoke('stop_all_audio'); setPlayingId(null); setPlayingName(null); }}>
                                Stop all
                            </button>
                        </div>

                        <SoundLibrary
                            sounds={config.sounds}
                            config={config}
                            playingId={playingId}
                            onConfigChange={saveConfig}
                            onPlayingChange={handlePlayingChange}
                        />

                        <div
                            className="transport-bar"
                            style={playingColor ? { ['--now-playing-color' as any]: playingColor } : {}}
                        >
                            <div className="transport-bar__info">
                                {ytImporting ? (
                                    <div className="transport-bar__text">
                                        <div className="transport-bar__label">Importing</div>
                                        <div className="transport-bar__name">Downloading from YouTube…</div>
                                        <div className="yt-progress-track">
                                            <div className="yt-progress-fill" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {playingId && (
                                            <div className="transport-bar__chip">
                                                <WaveformIcon animate={true} color={playingIcon!} />
                                            </div>
                                        )}
                                        <div className="transport-bar__text">
                                            <div className="transport-bar__label">Now playing</div>
                                            {playingName
                                                ? <div className="transport-bar__name">{playingName}</div>
                                                : <div className="transport-bar__name transport-bar__name--idle">Nothing playing</div>
                                            }
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="transport-bar__volume">
                                <span className="transport-bar__volume-label">Vol</span>
                                <VolumeSlider
                                    value={config.master_volume}
                                    onChange={(v) => {
                                        saveConfig({ ...config, master_volume: v });
                                        if (playingId) {
                                            const sound = config.sounds.find(s => s.id === playingId);
                                            invoke('set_volume', { id: playingId, volume: v * (sound?.volume ?? 1) }).catch(console.error);
                                        }
                                    }}
                                />
                                <span className="transport-bar__volume-label">{Math.round(config.master_volume * 100)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}