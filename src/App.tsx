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
        return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Loading…</div>;
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
        <div style={{ padding: '20px', fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

            {/* Update Banner */}
            {updateInfo && (
                <div style={{ background: '#d1ecf1', color: '#0c5460', padding: '10px 15px', borderRadius: '6px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <strong>Update Available:</strong> v{updateInfo.version}
                    </div>
                    <div>
                        <a href={updateInfo.release_url} target="_blank" rel="noreferrer" style={{ background: '#0c5460', color: 'white', padding: '5px 10px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.9em', marginRight: '10px' }}>Download</a>
                        <button onClick={() => setUpdateInfo(null)} style={{ background: 'transparent', border: 'none', color: '#0c5460', cursor: 'pointer', fontSize: '1.2em' }}>&times;</button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '1.4em' }}>WaveKey</h1>
                <button
                    title="Settings"
                    onClick={() => setView('settings')}
                    style={{ background: 'none', border: '1px solid #dee2e6', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '1.1em' }}
                >
                    ⚙️
                </button>
            </div>

            {/* Import toolbar */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                {/* YouTube import */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f8f9fa', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                    <input
                        type="text"
                        placeholder="Paste YouTube URL…"
                        value={ytUrl}
                        onChange={e => setYtUrl(e.target.value)}
                        style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
                    />
                    <button
                        onClick={handleYouTubeImport}
                        disabled={ytImporting || !ytUrl}
                        style={{
                            padding: '6px 14px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: (ytImporting || !ytUrl) ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            opacity: (ytImporting || !ytUrl) ? 0.65 : 1,
                        }}
                    >
                        {ytImporting ? 'Downloading…' : 'YT Import'}
                    </button>
                </div>

                {/* Local file import */}
                <button
                    onClick={handleAddSound}
                    disabled={importing}
                    style={{
                        padding: '8px 18px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: importing ? 'not-allowed' : 'pointer',
                        opacity: importing ? 0.65 : 1,
                    }}
                >
                    {importing ? 'Importing…' : '+ Add Sound'}
                </button>

                {/* Stop All button */}
                <button
                    onClick={() => invoke('stop_all_audio')}
                    style={{
                        padding: '8px 18px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginLeft: 'auto', // Pushes it to the right
                    }}
                    title="Stop all playing sounds"
                >
                    ⏹️ Stop All
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
