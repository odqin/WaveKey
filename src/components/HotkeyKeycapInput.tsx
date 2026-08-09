import { useRef, useState } from 'react';

interface Props {
    value: string | null;
    onRecord: (combo: string) => Promise<void>;
}

export function HotkeyKeycapInput({ value, onRecord }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [recording, setRecording] = useState(false);

    return (
        <div style={{ position: 'relative' }}>
            <input
                ref={inputRef}
                type="text"
                readOnly
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                onFocus={() => setRecording(true)}
                onBlur={() => setRecording(false)}
                onKeyDown={async e => {
                    e.preventDefault();
                    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

                    const parts: string[] = [];
                    if (e.ctrlKey) parts.push('Ctrl');
                    if (e.altKey) parts.push('Alt');
                    if (e.shiftKey) parts.push('Shift');
                    if (e.metaKey) parts.push('Command');
                    parts.push(e.key.toUpperCase());

                    if (parts.length > 1) {
                        await onRecord(parts.join('+'));
                        inputRef.current?.blur();
                    }
                }}
            />
            <div
                className="sound-tile__keys"
                style={{ minHeight: 0, cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', background: recording ? 'var(--accent-glow)' : 'transparent' }}
                onClick={() => inputRef.current?.focus()}
            >
                {recording ? (
                    <span className="sound-tile__key" style={{ color: 'var(--accent)' }}>Press keys…</span>
                ) : value ? (
                    value.split('+').map((key, i) => (
                        <span key={i} className="sound-tile__key">{key}</span>
                    ))
                ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Click to set</span>
                )}
            </div>
        </div>
    );
}