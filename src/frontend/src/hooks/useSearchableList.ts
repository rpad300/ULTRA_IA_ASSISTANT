import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "./useDebounce";

/**
 * Generic hook for filtering and searching through a list of items
 * 
 * @template T - The type of items in the list
 * @param items - Array of items to search through
 * @param searchFields - Array of field names (or functions) to search in
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns Object with search query, setter, debounced query, and filtered results
 * 
 * @example
 * ```tsx
 * const { searchQuery, setSearchQuery, filteredItems } = useSearchableList(
 *   companies,
 *   ['name', 'industry', 'description']
 * );
 * ```
 * 
 * @example With custom search function
 * ```tsx
 * const { searchQuery, setSearchQuery, filteredItems } = useSearchableList(
 *   projects,
 *   [
 *     (item) => item.name,
 *     (item) => item.description || '',
 *     (item) => item.company?.name || ''
 *   ]
 * );
 * ```
 */
export function useSearchableList<T>(
    items: T[],
    searchFields: (keyof T | ((item: T) => string))[],
    debounceMs: number = 300
) {
    const [searchQuery, setSearchQuery] = useState("");

    const debouncedSearchQuery = useDebounce(searchQuery, debounceMs);

    const filteredItems = useMemo(() => {
        if (!debouncedSearchQuery.trim()) {
            return items;
        }

        const query = debouncedSearchQuery.toLowerCase().trim();

        return items.filter((item) => {
            return searchFields.some((field) => {
                let searchableText: string;

                if (typeof field === "function") {
                    // Custom search function
                    searchableText = field(item)?.toLowerCase() || "";
                } else {
                    // Direct property access
                    const value = item[field];
                    searchableText = 
                        typeof value === "string" 
                            ? value.toLowerCase() 
                            : String(value || "").toLowerCase();
                }

                return searchableText.includes(query);
            });
        });
    }, [items, debouncedSearchQuery, searchFields]);

    const clearSearch = useCallback(() => {
        setSearchQuery("");
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        debouncedSearchQuery,
        filteredItems,
        clearSearch,
        hasResults: filteredItems.length > 0,
        hasSearchQuery: !!debouncedSearchQuery.trim(),
    };
}

