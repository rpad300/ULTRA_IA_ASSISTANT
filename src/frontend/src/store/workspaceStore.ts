import { create } from 'zustand';
import { type Company, type Project, type Thread, type Message, type Contact, workspaceApi } from '@/api/client';

interface WorkspaceState {
    companies: Company[];
    projects: Project[];
    selectedCompanyId: string | null;
    selectedProjectId: string | null;
    isLoading: boolean;

    threads: Thread[];
    selectedThreadId: string | null;
    messages: Message[];

    contacts: Contact[];

    setCompanies: (companies: Company[]) => void;
    setProjects: (projects: Project[]) => void;
    setThreads: (threads: Thread[]) => void;
    setMessages: (messages: Message[]) => void;
    selectCompany: (id: string) => void;
    selectProject: (id: string) => void;
    selectThread: (id: string) => void;
    setLoading: (loading: boolean) => void;

    // Actions
    fetchCompanies: () => Promise<void>;
    fetchCompany: (id: string) => Promise<Company | null>;
    createCompany: (data: Partial<Company>) => Promise<void>;
    updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
    deleteCompany: (id: string) => Promise<void>;

    fetchProjects: (companyId: string) => Promise<void>;
    fetchProject: (projectId: string) => Promise<Project | null>;
    createProject: (companyId: string, data: { name: string; description?: string }) => Promise<void>;
    fetchThreads: (projectId: string) => Promise<Thread[]>;
    fetchMessages: (threadId: string) => Promise<void>;
    sendMessage: (threadId: string, content: string) => Promise<void>;

    // Contact Actions
    fetchContacts: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    companies: [],
    projects: [],
    threads: [],
    contacts: [],
    selectedCompanyId: null,
    selectedProjectId: null,
    selectedThreadId: null,
    isLoading: false,

    setCompanies: (companies) => set({ companies }),
    setProjects: (projects) => set({ projects }),
    setThreads: (threads) => set({ threads }),
    setMessages: (messages) => set({ messages }),
    selectCompany: (id) => set({ selectedCompanyId: id, selectedProjectId: null, selectedThreadId: null }),
    selectProject: (id) => set({ selectedProjectId: id, selectedThreadId: null }),
    selectThread: (id) => set({ selectedThreadId: id }),
    setLoading: (loading) => set({ isLoading: loading }),

    fetchCompanies: async () => {
        set({ isLoading: true });
        try {
            const companies = await workspaceApi.getCompanies();
            // Ensure companies is always an array
            set({ companies: Array.isArray(companies) ? companies : [], isLoading: false });
        } catch (error) {
            console.error("Failed to fetch companies:", error);
            // Ensure companies remains an array even on error
            set({ companies: [], isLoading: false });
        }
    },

    fetchCompany: async (id: string) => {
        try {
            const state = get();
            const existing = state.companies.find(c => c.id === id);
            if (existing) return existing;

            const company = await workspaceApi.getCompany(id);
            return company;
        } catch (error) {
            console.error("Failed to fetch company:", error);
            return null;
        }
    },

    createCompany: async (data: Partial<Company>) => {
        set({ isLoading: true });
        try {
            await workspaceApi.createCompany(data);
            const companies = await workspaceApi.getCompanies();
            set({ companies, isLoading: false });
        } catch (error) {
            console.error(error);
            set({ isLoading: false });
        }
    },

    updateCompany: async (id: string, data: Partial<Company>) => {
        set({ isLoading: true });
        try {
            await workspaceApi.updateCompany(id, data);
            const companies = await workspaceApi.getCompanies();
            set({ companies, isLoading: false });
        } catch (error) {
            console.error(error);
            set({ isLoading: false });
        }
    },

    deleteCompany: async (id: string) => {
        set({ isLoading: true });
        try {
            await workspaceApi.deleteCompany(id);
            const companies = await workspaceApi.getCompanies(); // Refetch
            const state = get();
            if (state.selectedCompanyId === id) {
                set({ selectedCompanyId: null, selectedProjectId: null, threads: [] });
            }
            set({ companies, isLoading: false });
        } catch (error) {
            console.error(error);
            set({ isLoading: false });
        }
    },

    fetchProjects: async (companyId: string) => {
        set({ isLoading: true });
        try {
            const projects = await workspaceApi.getProjects(companyId);
            // Ensure projects is always an array
            set({ projects: Array.isArray(projects) ? projects : [], isLoading: false });
        } catch (error) {
            console.error("Failed to fetch projects:", error);
            // Ensure projects remains an array even on error
            set({ projects: [], isLoading: false });
        }
    },

    fetchProject: async (projectId: string) => {
        // Helper to get a single project (e.g. for Threads view context)
        try {
            // Check if already in state
            const state = get();
            const existing = state.projects.find(p => p.id === projectId);
            if (existing) return existing;

            const project = await workspaceApi.getProject(projectId);
            // Optionally add to state if appropriate, but be careful of companyId mismatch if we mix projects from diff companies
            // For now just return it
            return project;
        } catch (error) {
            console.error("Failed to fetch project:", error);
            return null;
        }
    },

    createProject: async (companyId: string, data: { name: string; description?: string }) => {
        set({ isLoading: true });
        try {
            await workspaceApi.createProject(companyId, data.name, data.description);
            // Refetch projects for the company
            const projects = await workspaceApi.getProjects(companyId);
            set({ projects, isLoading: false });
        } catch (error) {
            console.error("Failed to create project:", error);
            set({ isLoading: false });
            throw error;
        }
    },

    fetchThreads: async (projectId: string) => {
        console.log("fetchThreads called for project:", projectId);
        set({ isLoading: true });
        try {
            const threads = await workspaceApi.getThreads(projectId);
            console.log("Threads received from API:", threads);
            // Ensure threads is always an array
            const threadsArray = Array.isArray(threads) ? threads : [];
            console.log("Setting threads in store:", threadsArray.length, "threads");
            set({ threads: threadsArray, isLoading: false });
            return threadsArray;
        } catch (error) {
            console.error("Failed to fetch threads:", error);
            // Ensure threads remains an array even on error
            set({ threads: [], isLoading: false });
            throw error;
        }
    },

    // Chat Actions
    messages: [],

    fetchMessages: async (threadId: string) => {
        // Don't set global loading for messages to avoid flicker
        try {
            const messages = await workspaceApi.getMessages(threadId);
            set({ messages });
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        }
    },

    sendMessage: async (threadId: string, content: string) => {
        // Optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: Message = {
            id: tempId,
            role: 'user',
            content,
            created_at: new Date().toISOString()
        };

        const state = get();
        const previousMessages = [...state.messages];
        set({ messages: [...previousMessages, optimisticMsg] });

        try {
            const response = await workspaceApi.sendMessage(threadId, content);

            // Replace optimistic message with real one from server
            if (response) {
                const updatedMessages = previousMessages.map(msg =>
                    msg.id === tempId ? response : msg
                );
                set({ messages: updatedMessages });
            }

            // Note: AI response will come via WebSocket if enabled, or component should handle polling
        } catch (error) {
            console.error("Failed to send message:", error);
            // Revert optimistic update on failure
            set({ messages: previousMessages });
            throw error; // Re-throw so component can handle it
        }
    },

    fetchContacts: async () => {
        set({ isLoading: true });
        try {
            const contacts = await workspaceApi.getContacts();
            // Ensure contacts is always an array
            set({ contacts: Array.isArray(contacts) ? contacts : [], isLoading: false });
        } catch (error) {
            console.error("Failed to fetch contacts:", error);
            set({ contacts: [], isLoading: false });
        }
    }
}));
