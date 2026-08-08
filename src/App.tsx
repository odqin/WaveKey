import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { useConfig } from './hooks/useConfig';
import { SoundLibrary } from './components/SoundLibrary';
import { SettingsScreen } from './pages/SettingsScreen';

/** Top-level view the user is currently on. */
type View = 'library' | 'settings';

interface UpdateInfo {
    version: string;
    release_url: string;
    body: string;
}

/**
 * `App` is the root component. It owns the view-routing state (library vs
 * settings) and sources all config data from a single `useConfig()` call —
 * no child component fetches config independently.
 */
export default function App() {
    const { config, saveConfig, reload } = useConfig();
    const [view, setView] = useState<View>('library');
    const [importing, setImporting] = useState(false);
    const [ytUrl, setYtUrl] = useState('');
    const [ytImporting, setYtImporting] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

    useEffect(() => {
        invoke<UpdateInfo | null>('check_for_update')
            .then(info => {
                if (info) setUpdateInfo(info);
            })
            .catch(err => console.error("Update check failed:", err));
    }, []);

    // Wire up the file-drop listener once on mount
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

    /** Opens a native file picker and imports the selected audio file. */
    async function handleAddSound() {
        setImporting(true);
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac'] }],
            });
            if (!selected) return;
            const filePath = typeof selected === 'string' ? selected : selected[0];
            const name = prompt('Name this sound:');
            if (!name) return;
            await invoke('import_sound', { sourcePath: filePath, name });
            await reload();
        } catch (err) {
            alert(`Failed to import sound: ${err}`);
        } finally {
            setImporting(false);
        }
    }

    /** Downloads and imports a YouTube video's audio track. */
    async function handleYouTubeImport() {
        if (!ytUrl) return;
        const name = prompt('Name this YouTube sound:');
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
                <span className="text-secondary">Loading…</span>
            </div>
        );
    }

    if (view === 'settings') {
        return (
            <SettingsScreen
                config={config}
                onConfigChange={saveConfig}
                onBack={() => setView('library')}
            />
        );
    }

    return (
        <div className="app-shell">

            {/* Update Banner */}
            {updateInfo && (
                <div className="update-banner">
                    <div>
                        <strong>Update available:</strong> v{updateInfo.version}
                    </div>
                    <div className="update-banner__actions">
                        <a
                            href={updateInfo.release_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn--accent-outline"
                        >
                            Download
                        </a>
                        <button
                            className="btn--clear"
                            onClick={() => setUpdateInfo(null)}
                            title="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="header">
                <span className="header__title">WaveKey</span>
                <button
                    className="btn--icon"
                    title="Settings"
                    onClick={() => setView('settings')}
                >
                    ⚙️
                </button>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                {/* YouTube import */}
                <div className="yt-input-group">
                    <input
                        type="text"
                        className="input"
                        placeholder="Paste YouTube URL…"
                        value={ytUrl}
                        onChange={e => setYtUrl(e.target.value)}
                        style={{ minWidth: '200px' }}
                    />
                    <button
                        className="btn btn--danger"
                        onClick={handleYouTubeImport}
                        disabled={ytImporting || !ytUrl}
                    >
                        {ytImporting ? 'Downloading…' : 'YT Import'}
                    </button>
                </div>

                {/* Local file import */}
                <button
                    className="btn btn--accent"
                    onClick={handleAddSound}
                    disabled={importing}
                >
                    {importing ? 'Importing…' : '+ Add Sound'}
                </button>

                {/* Stop All */}
                <button
                    className="btn btn--danger"
                    onClick={() => invoke('stop_all_audio')}
                    title="Stop all playing sounds"
                    style={{ marginLeft: 'auto' }}
                >
                    ⏹ Stop All
                </button>
            </div>

            {/* Sound grid */}
            <SoundLibrary
                sounds={config.sounds}
                config={config}
                onConfigChange={saveConfig}
            />
        </div>
    );
}
