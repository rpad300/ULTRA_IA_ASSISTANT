export interface TranscriptBlock {
    id: string;        // Turn ID único vindo do Backend
    traceId?: string;   // Link para a Biometria
    speakerId?: string; // ID do Contacto (UUID)
    speaker: string;   // Nome para exibição
    text: string;
    isFinal: boolean;  // Se a IA já parou de "corrigir" esta frase
    timestamp: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    updatedAt: number; // Para forçar re-render de sub-componentes

    // Legacy / Compat
    topic?: string;
    isHighlighted?: boolean;
    clusterId?: string;
}
