
export interface AIConfig {
    slug: string;
    model: string;
    temperature: number;
    prompt_template: string;
    max_tokens?: number;
    description?: string;
}

export interface AIConfigUpdate {
    model?: string;
    temperature?: number;
    prompt_template?: string;
    max_tokens?: number;
}
