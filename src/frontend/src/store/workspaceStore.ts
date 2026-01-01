import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type Company, type Project, type Thread, type Message, type Contact, type Profile, workspaceApi } from '@/api/client';

interface WorkspaceState {
    companies: Company[];
    projects: Project[];
    profiles: Profile[];
    selectedCompanyId: string | null;
    selectedProjectId: string | null;
    selectedProfileId: string | null;
    isLoading: boolean;

    threads: Thread[];
    selectedThreadId: string | null;
    messages: Message[];

    contacts: Contact[];

    setCompanies: (companies: Company[]) => void;
    setProjects: (projects: Project[]) => void;
    setThreads: (threads: Thread[]) => void;
    setMessages: (messages: Message[]) => void;
    selectCompany: (id: string | null) => void;
    selectProject: (id: string | null) => void;
    selectProfile: (id: string | null) => void;
    selectThread: (id: string) => void;
    setLoading: (loading: boolean) => void;

    // Actions
    fetchCompanies: () => Promise<void>;
    fetchCompany: (id: string) => Promise<Company | null>;
    createCompany: (data: Partial<Company>) => Promise<void>;
    updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
    deleteCompany: (id: string) => Promise<void>;
    hardDeleteCompany: (id: string) => Promise<void>;

    fetchProjects: (companyId: string) => Promise<void>;
    fetchProfiles: (companyId: string) => Promise<void>;
    fetchProject: (projectId: string) => Promise<Project | null>;
    createProject: (companyId: string, data: { name: string; description?: string }) => Promise<void>;
    fetchThreads: (projectId: string) => Promise<Thread[]>;
    fetchMessages: (threadId: string) => Promise<void>;
    sendMessage: (threadId: string, content: string) => Promise<void>;

    // Contact Actions
    fetchContacts: () => Promise<void>;

    // User / Identity
    currentUser: { id: string; name: string; avatar?: string; role?: string } | null;
    setCurrentUser: (user: { id: string; name: string; avatar?: string; role?: string }) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            companies: [],
            projects: [],
            profiles: [],
            threads: [],
            contacts: [],

            selectedCompanyId: null,
            selectedProjectId: null,
            selectedProfileId: null,
            selectedThreadId: null,
            messages: [],
            isLoading: false,

            // Default mock user for "Real Session" feel
            currentUser: { id: 'me-1', name: 'You', role: 'Owner' },
            setCurrentUser: (user) => set({ currentUser: user }),

            setCompanies: (companies) => set({ companies }),
            setProjects: (projects) => set({ projects }),
            setThreads: (threads) => set({ threads }),
            setMessages: (messages) => set({ messages }),

            selectCompany: (id) => {
                set({ selectedCompanyId: id, selectedProjectId: null, selectedProfileId: null, selectedThreadId: null, threads: [], profiles: [] });
                // SOTA: Optionally trigger fetchProjects here if we want auto-load
            },

            selectProject: (id) => set({ selectedProjectId: id, selectedThreadId: null }),
            selectProfile: (id) => set({ selectedProfileId: id }),
            selectThread: (id) => set({ selectedThreadId: id }),
            setLoading: (loading) => set({ isLoading: loading }),

            fetchCompanies: async () => {
                set({ isLoading: true });
                try {
                    const companies = await workspaceApi.getCompanies();
                    set({ companies: Array.isArray(companies) ? companies : [], isLoading: false });
                } catch (error) {
                    console.error("Failed to fetch companies:", error);
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
                    const companies = await workspaceApi.getCompanies();
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

            hardDeleteCompany: async (id: string) => {
                set({ isLoading: true });
                try {
                    await workspaceApi.deleteCompanyPermanent(id);
                    const companies = await workspaceApi.getCompanies();
                    const state = get();
                    if (state.selectedCompanyId === id) {
                        set({ selectedCompanyId: null, selectedProjectId: null, threads: [] });
                    }
                    set({ companies, isLoading: false });
                } catch (error) {
                    console.error("Hard delete failed:", error);
                    set({ isLoading: false });
                    throw error;
                }
            },

            fetchProjects: async (companyId: string) => {
                set({ isLoading: true });
                try {
                    const projects = await workspaceApi.getProjects(companyId);
                    set({ projects: Array.isArray(projects) ? projects : [], isLoading: false });
                } catch (error) {
                    console.error("Failed to fetch projects:", error);
                    set({ projects: [], isLoading: false });
                }
            },

            fetchProfiles: async (companyId: string) => {
                set({ isLoading: true });
                try {
                    const profiles = await workspaceApi.getProfiles(companyId);
                    set({ profiles: Array.isArray(profiles) ? profiles : [], isLoading: false });
                } catch (error) {
                    console.error("Failed to fetch profiles:", error);
                    set({ profiles: [], isLoading: false });
                }
            },

            fetchProject: async (projectId: string) => {
                try {
                    const state = get();
                    const existing = state.projects.find(p => p.id === projectId);
                    if (existing) return existing;

                    const project = await workspaceApi.getProject(projectId);
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
                    const projects = await workspaceApi.getProjects(companyId);
                    set({ projects, isLoading: false });
                } catch (error) {
                    console.error("Failed to create project:", error);
                    set({ isLoading: false });
                    throw error;
                }
            },

            fetchThreads: async (projectId: string) => {
                set({ isLoading: true });
                try {
                    const threads = await workspaceApi.getThreads(projectId);
                    const threadsArray = Array.isArray(threads) ? threads : [];
                    set({ threads: threadsArray, isLoading: false });
                    return threadsArray;
                } catch (error) {
                    console.error("Failed to fetch threads:", error);
                    set({ threads: [], isLoading: false });
                    throw error;
                }
            },

            fetchMessages: async (threadId: string) => {
                try {
                    const messages = await workspaceApi.getMessages(threadId);
                    set({ messages });
                } catch (error) {
                    console.error("Failed to fetch messages:", error);
                }
            },

            sendMessage: async (threadId: string, content: string) => {
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

                    if (response) {
                        const updatedMessages = previousMessages.map(msg =>
                            msg.id === tempId ? response : msg
                        );
                        set({ messages: updatedMessages });
                    }
                } catch (error) {
                    console.error("Failed to send message:", error);
                    set({ messages: previousMessages });
                    throw error;
                }
            },

            fetchContacts: async () => {
                set({ isLoading: true });
                try {
                    const contacts = await workspaceApi.getContacts();
                    set({ contacts: Array.isArray(contacts) ? contacts : [], isLoading: false });
                } catch (error) {
                    console.error("Failed to fetch contacts:", error);
                    set({ contacts: [], isLoading: false });
                }
            }
        }),
        {
            name: 'workspace-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                selectedCompanyId: state.selectedCompanyId,
                selectedProjectId: state.selectedProjectId,
                selectedProfileId: state.selectedProfileId
            }),
        }
    )
);
