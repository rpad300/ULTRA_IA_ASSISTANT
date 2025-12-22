import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

// Create axios instance with centralized configuration
export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds timeout
});

// Request interceptor for adding auth tokens, etc.
api.interceptors.request.use(
    (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Debug logging
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config);
        return config;
    },
    (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        return response;
    },
    async (error) => {
        // Don't log 503 errors for audio-service endpoints as they're expected when service is not running
        const isAudioService503 = error.config?.url?.includes('/audio-service/') && error.response?.status === 503;

        // Debug logging
        if (error.response) {
            if (!isAudioService503) {
                console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response.status}`, {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data,
                    headers: error.response.headers
                });
            }
        } else {
            console.error('[API Network Error]', error.message, error.config);
        }

        // Handle 401 Unauthorized - redirect to login
        if (error.response?.status === 401) {
            // Clear token and redirect
            localStorage.removeItem('auth_token');
            // Could dispatch event or use router here
        }

        // Handle network errors
        if (!error.response) {
            console.error('Network error:', error.message);
        }

        return Promise.reject(error);
    }
);

export interface Company {
    id: string;
    name: string;
    description?: string;
    website?: string;
    status: 'active' | 'inactive';
    industry?: string;
    drive_root_folder_id?: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    company_id: string;
    created_at?: string;
    updated_at?: string;
}

export interface Thread {
    id: string;
    title: string;
    project_id: string;
    company_id?: string;
    status: string;
    profile_id?: string;
    description?: string;
    calendar_event_id?: string;
    updated_at: string;
    profiles?: {
        name: string;
        type: string;
    };
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export interface Session {
    id: string;
    thread_id: string;
    type: string;
    started_at: string;
    ended_at?: string;
    stt_provider?: string;
    transcript_file_id?: string;
    summary_file_id?: string;
    audio_file_path?: string;
    audio_file_drive_id?: string;
    created_at: string;
    updated_at: string;
}

// Also export as type for compatibility
export type MessageType = Message;

export interface Contact {
    id: string;
    name: string;
    email: string;
    role?: string;
    company_id?: string;
    company?: {
        id: string;
        name: string;
    };
    phone?: string;
    status?: 'active' | 'inactive';
    meetings_count?: number;
    tasks_count?: number;
    voice_profile?: any;
    created_at?: string;
    updated_at?: string;
}

// Paginated response type
interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export const workspaceApi = {
    getCompanies: async () => {
        const res = await api.get<PaginatedResponse<Company>>('/companies');
        // Extract items from paginated response
        return res.data.items || [];
    },
    getCompany: async (id: string) => {
        // We might not have a direct endpoint for single company in the router yet?
        // Let's assume we might need to add it or filter from list if backend lacks it.
        // Actually, let's check backend router. If missing, we add it.
        // For now, let's assume filtering from getCompanies is inefficient but safe fallback if endpoint missing
        // But better: GET /companies/{id}
        const res = await api.get<Company>(`/companies/${id}`);
        return res.data;
    },
    createCompany: async (data: Partial<Company>) => {
        const res = await api.post<Company>('/companies', data);
        return res.data;
    },
    updateCompany: async (id: string, data: Partial<Company>) => {
        const res = await api.put<Company>(`/companies/${id}`, data);
        return res.data;
    },
    deleteCompany: async (id: string) => {
        await api.delete(`/companies/${id}`);
    },
    getProjects: async (companyId: string) => {
        const res = await api.get<Project[]>(`/companies/${companyId}/projects`);
        return res.data;
    },
    getProject: async (projectId: string) => {
        // We need a direct endpoint or fetch from parent.
        // The current router setup might need checking.
        // Assuming we implement GET /projects/{id}
        const res = await api.get<Project>(`/projects/${projectId}`);
        return res.data;
    },
    createProject: async (companyId: string, name: string, description?: string) => {
        const res = await api.post<Project>('/projects', { company_id: companyId, name, description });
        return res.data;
    },
    updateProject: async (projectId: string, data: Partial<Project>) => {
        const res = await api.put<Project>(`/projects/${projectId}`, data);
        return res.data;
    },
    deleteProject: async (projectId: string) => {
        await api.delete(`/projects/${projectId}`);
    },
    getProjectFiles: async (projectId: string) => {
        const res = await api.get<any[]>(`/projects/${projectId}/files`);
        return res.data;
    },
    getSessionAudioUrl: (sessionId: string) => {
        return `${API_BASE_URL}/sessions/${sessionId}/audio`;
    },
    uploadProjectFile: async (projectId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post(`/projects/${projectId}/files`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return res.data;
    },
    getThreads: async (projectId: string) => {
        const res = await api.get<Thread[]>(`/projects/${projectId}/threads`);
        return res.data;
    },
    deleteThread: async (threadId: string) => {
        await api.delete(`/threads/${threadId}`);
    },
    createThread: async (projectId: string, data: { title: string; profile_id?: string; description?: string; calendar_event_id?: string; status?: string }) => {
        const res = await api.post<Thread>(`/projects/${projectId}/threads`, data);
        return res.data;
    },
    getThread: async (threadId: string) => {
        const url = `/threads/${threadId}`;
        const fullUrl = `${API_BASE_URL}${url}`;
        console.log(`[getThread] Calling API with threadId: ${threadId}`);
        console.log(`[getThread] Full URL: ${fullUrl}`);
        try {
            const res = await api.get<Thread>(url);
            console.log(`[getThread] Success! Status: ${res.status}, Thread data:`, res.data);
            return res.data;
        } catch (error: any) {
            console.error(`[getThread] Error! Status: ${error?.response?.status}, URL: ${fullUrl}`, error);
            throw error;
        }
    },
    getProfiles: async (companyId: string) => {
        const res = await api.get<Array<{ id: string; name: string; type: string; base_prompt?: string; company_id: string; created_at: string; updated_at: string }>>(`/companies/${companyId}/profiles`);
        return res.data;
    },
    getProfile: async (profileId: string) => {
        const res = await api.get<{ id: string; name: string; type: string; base_prompt?: string; company_id: string; created_at: string; updated_at: string }>(`/profiles/${profileId}`);
        return res.data;
    },
    createProfile: async (data: { name: string; type: string; base_prompt?: string; company_id: string }) => {
        const res = await api.post<{ id: string; name: string; type: string; base_prompt?: string; company_id: string; created_at: string; updated_at: string }>('/profiles', data);
        return res.data;
    },
    updateProfile: async (profileId: string, data: { name?: string; type?: string; base_prompt?: string }) => {
        const res = await api.put<{ id: string; name: string; type: string; base_prompt?: string; company_id: string; created_at: string; updated_at: string }>(`/profiles/${profileId}`, data);
        return res.data;
    },
    deleteProfile: async (profileId: string) => {
        await api.delete(`/profiles/${profileId}`);
    },
    getMessages: async (threadId: string) => {
        const res = await api.get<Message[]>(`/threads/${threadId}/messages`);
        return res.data;
    },
    sendMessage: async (threadId: string, content: string) => {
        const res = await api.post<Message>(`/threads/${threadId}/messages`, { role: 'user', content });
        return res.data;
    },
    finalizeSession: async (threadId: string, transcript: string, sessionId?: string) => {
        const res = await api.post(`/threads/${threadId}/finalize`, {
            transcript,
            ended_at: new Date().toISOString(),
            session_id: sessionId
        });
        return res.data;
    },
    createSession: async (threadId: string) => {
        const res = await api.post<Session>(`/threads/${threadId}/sessions`);
        return res.data;
    },
    getSession: async (sessionId: string) => {
        const res = await api.get<Session>(`/sessions/${sessionId}`);
        return res.data;
    },
    // Contacts API
    getContacts: async () => {
        const res = await api.get<PaginatedResponse<Contact>>('/contacts');
        // Extract items from paginated response
        return res.data.items || [];
    },
    getContact: async (id: string) => {
        const res = await api.get<Contact>(`/contacts/${id}`);
        return res.data;
    },
    createContact: async (data: Partial<Contact>) => {
        const res = await api.post<Contact>('/contacts', data);
        return res.data;
    },
    updateContact: async (id: string, data: Partial<Contact>) => {
        const res = await api.put<Contact>(`/contacts/${id}`, data);
        return res.data;
    },
    deleteContact: async (id: string) => {
        await api.delete(`/contacts/${id}`);
    },
    // Analytics
    get: async <T = any>(url: string) => {
        const res = await api.get<T>(url);
        return res;
    },
    // Tasks API
    getTasks: async (filters?: { company_id?: string; project_id?: string; thread_id?: string; status?: string; priority?: string }) => {
        const params = new URLSearchParams();
        if (filters?.company_id) params.append('company_id', filters.company_id);
        if (filters?.project_id) params.append('project_id', filters.project_id);
        if (filters?.thread_id) params.append('thread_id', filters.thread_id);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.priority) params.append('priority', filters.priority);
        const res = await api.get<PaginatedResponse<any>>(`/tasks?${params}`);
        // Extract items from paginated response
        return res.data.items || [];
    },
    getTask: async (id: string) => {
        const res = await api.get<Contact>(`/tasks/${id}`);
        return res.data;
    },
    createTask: async (data: Partial<any>) => {
        const res = await api.post<Contact>('/tasks', data);
        return res.data;
    },
    updateTask: async (id: string, data: Partial<any>) => {
        const res = await api.put<Contact>(`/tasks/${id}`, data);
        return res.data;
    },
    deleteTask: async (id: string) => {
        await api.delete(`/tasks/${id}`);
    },
    // System Health
    getSystemHealth: async () => {
        const res = await api.get<{
            status: string;
            timestamp: string;
            environment: string;
            services: {
                supabase: { status: string; latency_ms?: number; connected: boolean; error?: string };
                qdrant: { status: string; latency_ms?: number; connected: boolean; collection?: string; vectors_count?: number; error?: string };
                gemini: { status: string; latency_ms?: number; connected: boolean; model?: string; error?: string };
                drive: { status: string; latency_ms?: number; connected: boolean; user?: string; error?: string };
                picovoice: { status: string; latency_ms?: number; connected: boolean; details?: any; error?: string };
            };
        }>('/health/detailed');
        return res.data;
    },
    connectDrive: async () => {
        const res = await api.post<{ status: string; message: string }>('/auth/drive/connect');
        return res.data;
    },
};

// Audio Service Control API (C# Service)
export interface AudioServiceStatus {
    isCapturing: boolean;
    isAssemblyAIConnected?: boolean;
    isBackendConnected?: boolean;
    isConnected: boolean; // Legacy - use isAssemblyAIConnected and isBackendConnected
    selectedDeviceId: string | null;
    sessionId?: string | null;
    microphone?: {
        level: number;
        detectingAudio: boolean;
        deviceName: string | null;
        deviceId?: string | null;
        enabled: boolean;
    };
    systemAudio?: {
        level: number;
        detectingAudio: boolean;
        deviceName: string | null;
        deviceId?: string | null;
        enabled: boolean;
    };
}

export interface AudioDevice {
    id: string;
    name: string;
    // dataFlow is not returned by C# service, it returns categorized lists
}

export interface AudioDevicesResponse {
    microphones: AudioDevice[];
    speakers: AudioDevice[];
}

export const audioServiceApi = {
    getStatus: async (): Promise<AudioServiceStatus> => {
        const res = await api.get<AudioServiceStatus>('/audio-service/status');
        return res.data;
    },
    startStreaming: async (systemDeviceId?: string, microphoneDeviceId?: string, keyterms?: string[], sessionId?: string, useAssemblyAI: boolean = true): Promise<{ success: boolean; message: string }> => {
        const res = await api.post<{ success: boolean; message: string }>('/audio-service/start', {
            systemDeviceId: (systemDeviceId === 'default') ? null : (systemDeviceId || null),
            microphoneDeviceId: (microphoneDeviceId === 'default') ? null : (microphoneDeviceId || null),
            keyterms: keyterms || null,
            session_id: sessionId || null,
            useAssemblyAI
        });
        return res.data;
    },
    stopStreaming: async (): Promise<{ success: boolean; message: string }> => {
        const res = await api.post<{ success: boolean; message: string }>('/audio-service/stop');
        return res.data;
    },
    getDevices: async (): Promise<{ devices: AudioDevicesResponse }> => {
        // Backend returns List[AudioDevice]. We need to map it to { devices: { microphones: [], speakers: [] } }
        const res = await api.get<AudioDevice[]>('/audio-service/devices');

        const allDevices = res.data || [];
        // Map to expected structure
        const devices: AudioDevicesResponse = {
            // Check for is_microphone (from Pydantic) or isMicrophone (legacy/C# direct)
            microphones: allDevices.filter(d => (d as any).is_microphone === true || (d as any).isMicrophone === true),
            speakers: allDevices.filter(d => (d as any).is_microphone === false || (d as any).isMicrophone === false)
        };

        return { devices };
    },
    setDevice: async (deviceId: string): Promise<{ success: boolean; deviceId: string }> => {
        const res = await api.put<{ success: boolean; deviceId: string }>('/audio-service/device', {
            deviceId
        });
        return res.data;
    },
    startTestRecording: async (filePath?: string | null, microphoneDeviceId?: string | null, systemDeviceId?: string | null, keyterms?: string[], transcriptionService?: string): Promise<{ success: boolean; path: string; message: string; sessionId?: string }> => {
        const res = await api.post<{ success: boolean; path: string; message: string; sessionId?: string }>('/audio-service/test/start', {
            filePath: filePath || null,
            microphoneDeviceId: (microphoneDeviceId === 'default') ? null : (microphoneDeviceId || null),
            systemDeviceId: (systemDeviceId === 'default') ? null : (systemDeviceId || null),
            keyterms: keyterms || null,
            transcription_service: transcriptionService
        });
        return res.data;
    },
    stopTestRecording: async (): Promise<{ success: boolean; message: string }> => {
        const res = await api.post<{ success: boolean; message: string }>('/audio-service/test/stop');
        return res.data;
    },
    setGain: async (gain: number): Promise<{ success: boolean; message: string }> => {
        const res = await api.post<{ success: boolean; message: string }>('/audio-service/gain', { gain });
        return res.data;
    },
    enrollNative: async (contactId: string, filePath: string, transcript?: string): Promise<any> => {
        const res = await api.post<any>(`/voice-profiles/enroll-native/${contactId}`, {
            file_path: filePath,
            transcript: transcript
        });
        return res.data;
    },
    setTranscriptionPreference: async (sessionId: string, service: 'assemblyai' | 'whisper'): Promise<any> => {
        const res = await api.post('/ws/preference', { session_id: sessionId, service });
        return res.data;
    }
};
