
import { API_BASE_URL } from "@/config/api";

export interface AIConfig {
    slug: string;
    model_name: string;
    system_prompt: string;
    temperature: number;
    max_tokens: number;
    is_active: boolean;
    updated_at?: string;
}

export const adminAiApi = {
    fetchConfigs: async (): Promise<AIConfig[]> => {
        const response = await fetch(`${API_BASE_URL}/admin/ai/configs`);
        if (!response.ok) throw new Error("Failed to fetch AI configs");
        return response.json();
    },

    updateConfig: async (slug: string, data: Partial<AIConfig>): Promise<AIConfig> => {
        const response = await fetch(`${API_BASE_URL}/admin/ai/configs/${slug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`Failed to update config ${slug}`);
        return response.json();
    },

    updateGlobalModel: async (modelName: string): Promise<any> => {
        const response = await fetch(`${API_BASE_URL}/admin/ai/model-version?model_name=${modelName}`, {
            method: "POST",
        });
        if (!response.ok) throw new Error("Failed to update global model");
        return response.json();
    }
};
