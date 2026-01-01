
import axios from 'axios';
import type { AIConfig, AIConfigUpdate } from '../types/admin';

const API_URL = "http://localhost:8000/api/admin/ai";

export const AdminService = {
    getAllConfigs: async (): Promise<AIConfig[]> => {
        const response = await axios.get(`${API_URL}/configs`);
        return response.data;
    },

    getConfig: async (slug: string): Promise<AIConfig> => {
        const response = await axios.get(`${API_URL}/configs/${slug}`);
        return response.data;
    },

    updateConfig: async (slug: string, update: AIConfigUpdate): Promise<AIConfig> => {
        const response = await axios.put(`${API_URL}/configs/${slug}`, update);
        return response.data;
    },

    syncModels: async (): Promise<any> => {
        const response = await axios.post(`${API_URL}/models/sync`);
        return response.data;
    }
};
