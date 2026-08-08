import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types/config';

/**
 * `useConfig` is the single source of truth for the application's persisted
 * configuration. Every component that needs to read or write config must use
 * this hook — nothing should call `invoke('get_config')` or
 * `invoke('save_config')` directly. This prevents duplicated state and ensures
 * all parts of the UI stay in sync after any mutation.
 */
export function useConfig() {
    const [config, setConfig] = useState<Config | null>(null);

    /** Fetches the latest config from the Rust backend and updates local state. */
    const reload = useCallback(async () => {
        try {
            const loaded: Config = await invoke('get_config');
            setConfig(loaded);
        } catch (err) {
            console.error('Failed to load config:', err);
        }
    }, []);

    /**
     * Persists an updated config object to disk via `config::save_config` and
     * immediately syncs local state so the UI reflects the change without a
     * second round-trip.
     */
    const saveConfig = useCallback(async (updated: Config) => {
        await invoke('save_config', { config: updated });
        setConfig(updated);
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    return { config, saveConfig, reload };
}
