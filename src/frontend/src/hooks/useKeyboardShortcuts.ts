import { useEffect } from "react";

interface Shortcut {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    handler: (e: KeyboardEvent) => void;
    preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], deps: any[] = []) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            shortcuts.forEach(shortcut => {
                const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
                const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : true;
                const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
                const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

                if (ctrlMatch && metaMatch && shiftMatch && keyMatch) {
                    if (shortcut.preventDefault !== false) {
                        e.preventDefault();
                    }
                    shortcut.handler(e);
                }
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, ...deps]);
}

