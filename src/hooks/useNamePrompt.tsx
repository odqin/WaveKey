import { useCallback, useState } from 'react';
import { NameDialog } from '../components/NameDialog';

interface PendingPrompt {
    title: string;
    initialValue?: string;
    resolve: (value: string | null) => void;
}

export function useNamePrompt() {
    const [pending, setPending] = useState<PendingPrompt | null>(null);

    const askForName = useCallback((title: string, initialValue?: string): Promise<string | null> => {
        return new Promise(resolve => {
            setPending({ title, initialValue, resolve });
        });
    }, []);

    const dialog = pending ? (
        <NameDialog
            title={pending.title}
            initialValue={pending.initialValue}
            onSubmit={(name) => { pending.resolve(name); setPending(null); }}
            onCancel={() => { pending.resolve(null); setPending(null); }}
        />
    ) : null;

    return { askForName, dialog };
}