import { useState, useCallback } from "react";

/**
 * Hook for optimistic UI updates
 * Updates UI immediately, then syncs with server
 */
export function useOptimisticUpdate<T>(
    initialValue: T[],
    updateFn: (item: T) => Promise<void>,
    deleteFn?: (id: string) => Promise<void>
) {
    const [items, setItems] = useState<T[]>(initialValue);
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

    const addItem = useCallback(async (item: T) => {
        const tempId = `temp-${Date.now()}`;
        const tempItem = { ...item, id: tempId } as T;
        
        setItems(prev => [...prev, tempItem]);
        setPendingIds(prev => new Set(prev).add(tempId));

        try {
            await updateFn(item);
            // Replace temp item with real one
            setItems(prev => prev.map(i => 
                (i as any).id === tempId ? item : i
            ));
        } catch (error) {
            // Rollback on error
            setItems(prev => prev.filter(i => (i as any).id !== tempId));
            throw error;
        } finally {
            setPendingIds(prev => {
                const next = new Set(prev);
                next.delete(tempId);
                return next;
            });
        }
    }, [updateFn]);

    const removeItem = useCallback(async (id: string) => {
        const item = items.find(i => (i as any).id === id);
        if (!item) return;

        // Optimistic removal
        setItems(prev => prev.filter(i => (i as any).id !== id));
        setPendingIds(prev => new Set(prev).add(id));

        try {
            if (deleteFn) {
                await deleteFn(id);
            }
        } catch (error) {
            // Rollback on error
            setItems(prev => [...prev, item]);
            throw error;
        } finally {
            setPendingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [items, deleteFn]);

    const updateItem = useCallback(async (id: string, updates: Partial<T>) => {
        const item = items.find(i => (i as any).id === id);
        if (!item) return;

        // Optimistic update
        const updatedItem = { ...item, ...updates } as T;
        setItems(prev => prev.map(i => 
            (i as any).id === id ? updatedItem : i
        ));

        try {
            await updateFn(updatedItem);
        } catch (error) {
            // Rollback on error
            setItems(prev => prev.map(i => 
                (i as any).id === id ? item : i
            ));
            throw error;
        }
    }, [items, updateFn]);

    return {
        items,
        addItem,
        removeItem,
        updateItem,
        setItems,
        pendingIds,
    };
}

