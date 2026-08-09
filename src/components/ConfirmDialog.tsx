import { useClosingState } from '../hooks/useClosingState';

interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
    const { closing, close } = useClosingState();

    const handleConfirm = () => close(onConfirm);
    const handleCancel = () => close(onCancel);

    return (
        <div
            className={`modal-backdrop ${closing ? 'modal-backdrop--closing' : ''}`}
            onClick={handleCancel}
        >
            <div
                className="modal-card"
                style={{ padding: '28px 32px', minWidth: '320px', maxWidth: '380px' }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>{title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '22px', lineHeight: 1.5 }}>{message}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        className="btn-primary"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button className="btn-danger" onClick={handleConfirm}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}