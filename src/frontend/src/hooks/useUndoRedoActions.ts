import { useUndoRedo } from "./useUndoRedo";
import { toast } from "@/components/ui/toast";


interface Action {
    type: string;
    description: string;
    undo: () => void;
    redo: () => void;
}

export function useUndoRedoActions() {
    const { state, setState, undo, redo, canUndo, canRedo, clear } = useUndoRedo<Action[]>([]);

    const addAction = (action: Action) => {
        setState([...state, action]);
        toast.success(action.description, {
            duration: 3000,
            action: {
                label: "Undo",
                onClick: () => {
                    undoAction();
                }
            }
        });
    };

    const undoAction = () => {
        if (canUndo && state.length > 0) {
            const lastAction = state[state.length - 1];
            lastAction.undo();
            undo();
            toast.success(`Undone: ${lastAction.description}`);
        }
    };

    const redoAction = () => {
        if (canRedo) {
            redo();
            const currentAction = state[state.length];
            if (currentAction) {
                currentAction.redo();
                toast.success(`Redone: ${currentAction.description}`);
            }
        }
    };

    // Keyboard shortcuts
    const handleKeyboard = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undoAction();
        } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redoAction();
        }
    };

    return {
        addAction,
        undoAction,
        redoAction,
        canUndo,
        canRedo,
        handleKeyboard,
        clear,
    };
}

