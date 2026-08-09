import { useRef, useCallback } from 'react';

interface Props {
    value: number; // 0..1
    onChange: (value: number) => void;
    className?: string;
}

export function VolumeSlider({ value, onChange, className }: Props) {
    const trackRef = useRef<HTMLDivElement>(null);

    const updateFromClientX = useCallback((clientX: number) => {
        const el = trackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        onChange(x);
    }, [onChange]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.buttons !== 1) return;
        updateFromClientX(e.clientX);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const step = 0.05;
        const delta = e.deltaY < 0 ? step : -step;
        const next = Math.max(0, Math.min(1, value + delta));
        onChange(next);
    };

    return (
        <div
            ref={trackRef}
            className={className ?? 'transport-bar__volume-track'}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onWheel={handleWheel}
        >
            <div className="transport-bar__volume-fill" style={{ width: `${value * 100}%` }} />
            <div className="transport-bar__volume-thumb" style={{ left: `${value * 100}%` }} />
        </div>
    );
}