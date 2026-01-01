
import { useState, useCallback, useMemo, useEffect } from "react";
import Fuse from "fuse.js";
import { workspaceApi, type Contact } from "@/api/client";
import { toast } from "sonner";

export interface IdentityEngineOptions {
    onAssignSuccess?: (contactName: string) => void;
    onClose?: () => void;
}

export function useIdentityEngine({ onAssignSuccess, onClose }: IdentityEngineOptions = {}) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

    // Load contacts on mount
    useEffect(() => {
        let mounted = true;

        async function loadContacts() {
            setIsLoading(true);
            try {
                const data = await workspaceApi.getContacts();
                if (mounted) {
                    setContacts(data);
                }
            } catch (error) {
                console.error("Failed to load contacts:", error);
                toast.error("Failed to load contacts for identity matching.");
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        loadContacts();

        return () => { mounted = false; };
    }, []);

    // Fuse.js instance for Fuzzy Search
    const fuse = useMemo(() => {
        return new Fuse(contacts, {
            keys: ['name', 'email', 'role'],
            threshold: 0.3, // Tolerance for typos
            distance: 100,
        });
    }, [contacts]);

    // Derived State: Suggestions (Top 3 based on interactions)
    // We prioritize contacts with high meeting/task counts or existing roles
    const suggestions = useMemo(() => {
        return [...contacts]
            .sort((a, b) => {
                const scoreA = (a.meetings_count || 0) * 2 + (a.tasks_count || 0);
                const scoreB = (b.meetings_count || 0) * 2 + (b.tasks_count || 0);
                return scoreB - scoreA;
            })
            .slice(0, 3);
    }, [contacts]);

    // Derived State: Filtered Results
    const filteredResults = useMemo(() => {
        if (!searchQuery.trim()) {
            return contacts;
        }

        const results = fuse.search(searchQuery);
        return results.map(result => result.item);
    }, [searchQuery, contacts, fuse]);

    // Action: Assign Identity
    const assignIdentity = useCallback(async (traceId: string, contactId: string) => {
        if (!traceId || !contactId) return;

        setIsAssigning(true);
        // Find contact name for optimistic update / success message
        const contact = contacts.find(c => c.id === contactId);
        const contactName = contact?.name || "Unknown";

        try {
            const response = await fetch('/api/voice/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trace_id: traceId,
                    contact_id: contactId
                })
            });

            if (!response.ok) throw new Error('Failed to assign speaker');

            // Success
            toast.success(`Identidade Vocal Sincronizada. A IA reconhecerá ${contactName} automaticamente no futuro.`);

            if (onAssignSuccess) {
                const data = await response.json();
                onAssignSuccess(data.contact_name || contactName);
            }

            if (onClose) {
                onClose();
            }

        } catch (error) {
            console.error("Assignment failed:", error);
            toast.error("Failed to assign identity. Please try again.");
        } finally {
            setIsAssigning(false);
        }
    }, [contacts, onAssignSuccess, onClose]);

    // Action: Create and Assign Identity (Quick Create)
    const createAndAssignIdentity = useCallback(async (traceId: string, name: string) => {
        if (!name.trim()) return;

        setIsAssigning(true);
        try {
            // Create the contact first
            const newContact = await workspaceApi.createContact({ name });
            const contactName = newContact.name;

            // Optimistically add to list and select it
            setContacts(prev => [newContact, ...prev]);
            setSelectedContactId(newContact.id);

            // Then assign - Reusing logic logic but inline to avoid weird dependency recursion or passing deps
            const response = await fetch('/api/voice/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trace_id: traceId,
                    contact_id: newContact.id
                })
            });

            if (!response.ok) throw new Error('Failed to assign speaker after creation');

            toast.success(`Contacto criado e Identidade Sincronizada: ${contactName}`);

            if (onAssignSuccess) {
                const data = await response.json();
                onAssignSuccess(data.contact_name || contactName);
            }
            if (onClose) onClose();

        } catch (error) {
            console.error("Quick create failed:", error);
            toast.error("Failed to create and assign contact.");
            setIsAssigning(false);
        }
    }, [onAssignSuccess, onClose]);

    return {
        contacts,
        suggestions, // The "Smart Suggestions"
        filteredResults, // The "Search Results"
        searchQuery,
        setSearchQuery,
        isLoading,
        isAssigning,
        selectedContactId,
        setSelectedContactId,
        assignIdentity,
        createAndAssignIdentity
    };
}
