import { useEffect, useRef, useState } from 'react';
import { useClosingState } from '../hooks/useClosingState';

interface Props {
    title: string;
    initialValue?: string;
    onSubmit: (name: string) => void;
    onCancel: () => void;
}

export function NameDialog({ title, initialValue = '', onSubmit, onCancel }: Props) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const { closing, close } = useClosingState();

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleSubmit = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        close(() => onSubmit(trimmed));
    };

    const handleCancel = () => close(onCancel);

    return (
        <div
            className={`modal-backdrop ${closing ? 'modal-backdrop--closing' : ''}`}
            onClick={handleCancel}
        >
            <div
                className="modal-card"
                style={{ padding: '28px 32px', minWidth: '320px' }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{title}</div>
                <input
                    ref={inputRef}
                    className="yt-input"
                    style={{ width: '100%', marginBottom: '20px' }}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSubmit();
                        if (e.key === 'Escape') handleCancel();
                    }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        className="btn-primary"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button className="btn-primary" onClick={handleSubmit} disabled={!value.trim()}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}