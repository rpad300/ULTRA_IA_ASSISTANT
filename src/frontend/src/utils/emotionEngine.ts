export type EmotionType = 'happy' | 'neutral' | 'frustrated' | 'confused' | 'engaged' | 'bored';

interface SentimentResult {
    emotion: EmotionType;
    confidence: number;
    reason: string;
}



export interface MeetingMood {
    state: 'Harmony' | 'Tension' | 'Confusion' | 'Neutral';
    color: string; // OKLCH color
    intensity: number; // 0-1
}

export const analyzeSentimentDetailed = (text: string): SentimentResult => {
    const lowerText = text.toLowerCase();

    // Frustration Detection
    const frustrationWords = ['não', 'problema', 'erro', 'falha', 'no', 'problem', 'error', 'wrong', 'fail', 'bad', 'horrible', 'hate', 'disagree', 'discordo'];
    const frustrationMatches = frustrationWords.filter(w => lowerText.includes(w));
    if (frustrationMatches.length > 0) {
        return {
            emotion: 'frustrated',
            confidence: 60 + (frustrationMatches.length * 10), // Base 60, +10 per word
            reason: `Detetado vocabulário de tensão: "${frustrationMatches.slice(0, 2).join(', ')}"`
        };
    }

    // Confusion Detection
    const confusionWords = ['não entendi', 'confuso', 'como', 'what', 'confused', 'how', 'clarify', 'explain', 'explica', 'dúvida', 'why', 'porque'];
    const confusionMatches = confusionWords.filter(w => lowerText.includes(w));
    if (confusionMatches.length > 0) {
        return {
            emotion: 'confused',
            confidence: 65 + (confusionMatches.length * 5),
            reason: `Detetada incerteza ou dúvida: "${confusionMatches.slice(0, 2).join(', ')}"`
        };
    }

    // Engagement Detection
    const engagementWords = ['ótimo', 'excelente', 'perfeito', 'great', 'excellent', 'perfect', 'yes', 'sim', 'concordo', 'agree', 'awesome', 'nice', 'bom'];
    const engagementMatches = engagementWords.filter(w => lowerText.includes(w));
    if (engagementMatches.length > 2) { // Need more evidence for strong engagement
        return {
            emotion: 'happy', // High engagement often maps to happy/positive
            confidence: 70 + (engagementMatches.length * 5),
            reason: `Sinais de entusiasmo e concordância: "${engagementMatches.slice(0, 2).join(', ')}"`
        };
    }

    if (engagementMatches.length > 0) {
        return {
            emotion: 'engaged',
            confidence: 60 + (engagementMatches.length * 5),
            reason: `Participação ativa e positiva: "${engagementMatches.slice(0, 1).join(', ')}"`
        };
    }

    // Boredom/Passive Detection (Short responses)
    const boredomWords = ['ok', 'tudo bem', 'whatever', 'fine', 'sure', 'hum', 'aham'];
    const boredomMatches = boredomWords.filter(w => lowerText.includes(w));
    if (text.length < 10 && boredomMatches.length > 0) {
        return {
            emotion: 'bored',
            confidence: 55,
            reason: "Respostas curtas indiciam baixa energia"
        };
    }

    return {
        emotion: 'neutral',
        confidence: 50,
        reason: "Discurso neutro sem marcadores emocionais fortes"
    };
};

export const detectMeetingMood = (emotions: { emotion: EmotionType; confidence: number }[]): MeetingMood => {
    if (emotions.length === 0) return { state: 'Neutral', color: 'oklch(0.6 0.1 240)', intensity: 0.2 };

    const counts: Record<EmotionType, number> = {
        happy: 0, neutral: 0, frustrated: 0, confused: 0, engaged: 0, bored: 0
    };

    emotions.forEach(e => counts[e.emotion]++);

    const total = emotions.length;

    // High Priority: Tension
    if (counts.frustrated > 0 || (counts.frustrated / total) > 0.2) {
        return {
            state: 'Tension',
            color: 'oklch(0.6 0.2 30)', // Red/Orange
            intensity: 0.8 + (counts.frustrated * 0.1)
        };
    }

    // High Priority: Confusion
    if ((counts.confused / total) > 0.3) {
        return {
            state: 'Confusion',
            color: 'oklch(0.7 0.15 300)', // Purple
            intensity: 0.6 + (counts.confused * 0.1)
        };
    }

    // Positive States
    if ((counts.happy + counts.engaged) / total > 0.5) {
        return {
            state: 'Harmony',
            color: 'oklch(0.65 0.2 140)', // Green
            intensity: 0.7
        };
    }

    return {
        state: 'Neutral',
        color: 'oklch(0.6 0.05 240)', // Blue-ish Gray
        intensity: 0.3
    };
};

export const detectConflictRisks = (emotions: { participantId: string; emotion: EmotionType }[]): string[] => {
    const risks: string[] = [];
    const hasFrustrated = emotions.some(e => e.emotion === 'frustrated');
    const hasHappy = emotions.some(e => e.emotion === 'happy');
    const hasConfused = emotions.some(e => e.emotion === 'confused');

    if (hasFrustrated && hasHappy) {
        risks.push("Dissonância Emocional: Participantes frustrados e felizes coexistindo.");
    }

    if (hasFrustrated && hasConfused) {
        risks.push("Risco de Bloqueio: Frustração combinada com confusão.");
    }

    return risks;
};
