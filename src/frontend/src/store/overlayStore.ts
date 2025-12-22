import { create } from 'zustand';

interface OverlayState {
    isOpen: boolean;
    mode: 'teleprompter' | 'hints';
    scriptContent?: string;
    scriptTitle?: string;
    openOverlay: (mode: 'teleprompter' | 'hints', scriptContent?: string, scriptTitle?: string) => void;
    closeOverlay: () => void;
    setMode: (mode: 'teleprompter' | 'hints') => void;
    setScript: (content: string, title?: string) => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
    isOpen: false,
    mode: 'teleprompter',
    scriptContent: undefined,
    scriptTitle: undefined,
    openOverlay: (mode, scriptContent, scriptTitle) => set({ 
        isOpen: true, 
        mode, 
        scriptContent, 
        scriptTitle 
    }),
    closeOverlay: () => set({ isOpen: false }),
    setMode: (mode) => set({ mode }),
    setScript: (content, title) => set({ scriptContent: content, scriptTitle: title }),
}));

