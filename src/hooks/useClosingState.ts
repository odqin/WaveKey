import { useState, useCallback } from 'react';

export function useClosingState(delay = 180) {
    const [closing, setClosing] = useState(false);

    const close = useCallback((fn: () => void) => {
        setClosing(true);
        setTimeout(() => {
            fn();
            setClosing(false);
        }, delay);
    }, [delay]);

    return { closing, close };
}