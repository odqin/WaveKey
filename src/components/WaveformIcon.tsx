interface Props {
    animate?: boolean;
    color?: string;
}

export function WaveformIcon({ animate = false, color = 'currentColor' }: Props) {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect className={animate ? 'wave-bar wave-bar--1' : 'wave-bar'} x="0.5" y="6" width="2.2" height="4" rx="1.1" fill={color} />
            <rect className={animate ? 'wave-bar wave-bar--2' : 'wave-bar'} x="4.7" y="3" width="2.2" height="10" rx="1.1" fill={color} />
            <rect className={animate ? 'wave-bar wave-bar--3' : 'wave-bar'} x="8.9" y="1" width="2.2" height="14" rx="1.1" fill={color} />
            <rect className={animate ? 'wave-bar wave-bar--4' : 'wave-bar'} x="13.1" y="4.5" width="2.2" height="7" rx="1.1" fill={color} />
        </svg>
    );
}