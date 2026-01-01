
import type { MeetingQualityScore } from "@/store/slices/intelligenceSlice";

// --- Types ---
export interface OptimizationTip {
    id: string;
    metric: keyof MeetingQualityScore;
    message: string;
    severity: 'low' | 'medium' | 'high';
}

// --- OKLCH Color Palette ---
// Modern, accessible, and vibrant colors
export const SCORE_COLORS = {
    excellent: 'oklch(0.65 0.18 150)', // Vibrant Green
    good: 'oklch(0.75 0.16 85)',       // Warm Yellow/Amber
    warning: 'oklch(0.65 0.20 30)',    // Alert Orange/Red
    danger: 'oklch(0.55 0.22 25)',     // Deep Red
};

export const METRIC_COLORS = {
    engagement: 'oklch(0.65 0.18 260)',   // Blue
    clarity: 'oklch(0.70 0.16 180)',      // Cyan/Teal
    efficiency: 'oklch(0.65 0.18 300)',   // Purple
    participation: 'oklch(0.70 0.15 40)', // Orange
    decisionVelocity: 'oklch(0.60 0.18 140)' // Green
};

export const RING_GRADIENTS = {
    engagement: { from: 'oklch(0.65 0.22 260)', to: 'oklch(0.75 0.15 240)' }, // Electric Blue -> Soft Blue
    clarity: { from: 'oklch(0.75 0.18 180)', to: 'oklch(0.85 0.10 190)' },    // Teal -> Cyan
    participation: { from: 'oklch(0.70 0.20 40)', to: 'oklch(0.80 0.15 50)' }, // Orange -> Gold
    progress: { from: 'oklch(0.65 0.22 150)', to: 'oklch(0.75 0.18 140)' },    // Emerald -> Green
};

// --- Tip Pool ---
const TIP_POOL: Record<string, string[]> = {
    engagement: [
        "Faça uma pergunta direta a um participante silencioso.",
        "Use uma enquete ou reação para medir o consenso.",
        "Mude o formato de compartilhamento para renovar a atenção."
    ],
    clarity: [
        "Resuma o último ponto chave para garantir alinhamento.",
        "Pergunte 'Isso faz sentido?' para checar o entendimento.",
        "Simplifique o jargão usado nos últimos minutos."
    ],
    efficiency: [
        "Deixe este tópico para depois se estiver demorando muito.",
        "Revise a pauta para manter o foco.",
        "Esta discussão está levando a uma decisão?"
    ],
    participation: [
        "Convide quem ainda não falou para opinar.",
        "Faça uma rodada rápida de opiniões.",
        "Abra espaço para os mais introvertidos contribuírem."
    ],
    decisionVelocity: [
        "Caminhe para um 'Sim' ou 'Não' claro.",
        "Atribua um responsável para esta ação agora.",
        "Proponha uma decisão e peça objeções."
    ]
};

// --- Utils ---

export const getScoreColorOKLCH = (score: number): string => {
    if (score >= 80) return SCORE_COLORS.excellent;
    if (score >= 60) return SCORE_COLORS.good;
    if (score >= 40) return SCORE_COLORS.warning;
    return SCORE_COLORS.danger;
};

export const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-green-500'; // Fallback / Tailwind utility
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
};

export const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Regular';
    return 'Crítico';
};

export const generateOptimizationTip = (metrics: MeetingQualityScore): OptimizationTip | null => {
    // 1. Identify lowest metric (excluding 'overall' and 'lastUpdated')
    const keys = ['engagement', 'clarity', 'efficiency', 'participation', 'decisionVelocity'] as const;

    let lowestMetric: typeof keys[number] | null = null;
    let lowestValue = 101;

    keys.forEach(key => {
        if (metrics[key] < lowestValue) {
            lowestValue = metrics[key];
            lowestMetric = key;
        }
    });

    if (!lowestMetric || lowestValue >= 80) return null; // No tip needed if everything is excellent

    // 2. Select a random tip from the pool
    const tips = TIP_POOL[lowestMetric];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    return {
        id: `tip-${Date.now()}`,
        metric: lowestMetric,
        message: randomTip,
        severity: lowestValue < 50 ? 'high' : 'medium'
    };
};

export const getMeetingVibe = (metrics: MeetingQualityScore): string => {
    const { engagement, clarity, participation, efficiency, overall } = metrics;

    if (overall >= 85) return "✨ Sinergia Total";

    // Engagement Dominant
    if (engagement > 80 && participation > 70) return "🔥 Conversa Dinâmica";

    // High Focus (Low participation but high clarity - e.g. presentation)
    if (participation < 50 && clarity > 80) return "🎯 Foco Executivo";

    // Intense Debate (High engagement but low progress/efficiency)
    if (engagement > 75 && efficiency < 50) return "⚡ Debate Intenso";

    // Low Energy
    if (engagement < 40 && participation < 40) return "💤 Sala Silenciosa";

    // Confused
    if (clarity < 50 && engagement > 60) return "🌪️ Discussão Confusa";

    // Stagnant
    if (efficiency < 40 && metrics.decisionVelocity < 40) return "🐢 Discussão Estagnada";

    // Default based on good scores
    if (overall > 70) return "✅ Produtiva";

    return "⏳ Em Progresso";
};
