
import axios from 'axios';

// Interfaces (Should overlap with Backend Pydantic models)
export interface Contact {
    id: string;
    name: string;
    role?: string;
    company_id?: string;
    email?: string;
    phone?: string;
    voice_profile?: string; // Audio buffer hash or ID
    last_interaction?: string;
}

export interface AssignGuestPayload {
    guest_id: string; // e.g. "Guest 1"
    session_id: string;
}

const API_URL = "http://localhost:8000/api";

export const ContactService = {
    /**
     * Fetch all contacts for the dropdown
     */
    getAllContacts: async (): Promise<Contact[]> => {
        const response = await axios.get(`${API_URL}/contacts`);
        return response.data; // Assuming paginated response handled or flattened
    },

    /**
     * Search contacts (optional, good for large lists)
     */
    searchContacts: async (query: string): Promise<Contact[]> => {
        // Backend search endpoint needed if we want server-side search.
        // For now, client-side filtering is fine for < 1000 contacts.
        const all = await ContactService.getAllContacts();
        return all.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    },

    /**
     * Assign a session guest to a permanent contact
     */
    assignGuest: async (contactId: string, payload: AssignGuestPayload): Promise<any> => {
        const response = await axios.post(`${API_URL}/contacts/${contactId}/assign_guest`, payload);
        return response.data;
    }
};
