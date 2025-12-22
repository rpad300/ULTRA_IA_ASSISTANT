/**
 * Insight Detection Service
 * 
 * This service handles the business logic for detecting meeting insights.
 * The logic is separated from the UI component to make it:
 * - Easier to test
 * - Easier to maintain
 * - Easier to move to backend later
 * - Language-agnostic (can be configured)
 */

import type { GuidanceInsight } from "@/components/sessions/MeetingGuidancePane";

export interface TranscriptBlock {
    speaker: string;
    text: string;
    timestamp: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface DetectedAction {
    id: string;
    text: string;
    confirmed: boolean;
    timestamp: number;
}

export interface InsightDetectionConfig {
    // Keywords for topic detection
    topics: {
        budget: string[];
        deadline: string[];
        risk: string[];
        decision: string[];
        technical: string[];
    };

    // Question keywords
    questionKeywords: string[];

    // Thresholds
    negativeSentimentThreshold: number;
    minBlocksForAnalysis: number;

    // Language
    language: 'pt' | 'en';
}

const DEFAULT_CONFIG: InsightDetectionConfig = {
    topics: {
        budget: ['budget', 'custo', 'preço', 'price', 'cost', 'orçamento', 'financeiro'],
        deadline: ['prazo', 'deadline', 'data', 'date', 'entrega', 'delivery', 'timeline'],
        risk: ['risco', 'risk', 'problema', 'problem', 'issue', 'concern', 'preocupação'],
        decision: ['decisão', 'decision', 'decidir', 'decide', 'escolher', 'choose', 'aprovar', 'approve'],
        technical: ['tecnologia', 'technology', 'técnico', 'technical', 'implementação', 'implementation', 'código', 'code'],
    },
    questionKeywords: ['?', 'pergunta', 'question', 'como', 'quando', 'onde', 'quem', 'por que', 'why', 'how', 'when', 'where', 'who'],
    negativeSentimentThreshold: 0.4, // 40% of recent messages
    minBlocksForAnalysis: 3,
    language: 'pt',
};

/**
 * Detects insights from meeting transcript and context
 */
export function detectInsights(
    transcriptBlocks: TranscriptBlock[],
    detectedActions: DetectedAction[],
    risks: any[],
    clarifications: any[],
    config: Partial<InsightDetectionConfig> = {}
): GuidanceInsight[] {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const insights: GuidanceInsight[] = [];
    const now = Date.now();

    // Get recent transcript (last 10 blocks or last 2 minutes)
    const recentTranscript = transcriptBlocks.slice(-10);
    if (recentTranscript.length < finalConfig.minBlocksForAnalysis) {
        return insights;
    }

    // 1. Topic-based questions
    const detectedTopics = detectTopics(recentTranscript, finalConfig.topics);
    for (const [topic, count] of Object.entries(detectedTopics)) {
        if (count >= 2) {
            insights.push(createTopicInsight(topic as keyof typeof finalConfig.topics, count, now, finalConfig.language));
        }
    }

    // 2. Negative sentiment detection
    const sentimentAnalysis = analyzeSentiment(recentTranscript);
    if (sentimentAnalysis.negativeRatio > finalConfig.negativeSentimentThreshold) {
        insights.push(createSentimentInsight(sentimentAnalysis, now, finalConfig.language));
    }

    // 3. Unconfirmed actions
    const unconfirmedActions = detectedActions.filter(a => !a.confirmed);
    if (unconfirmedActions.length > 0) {
        const lastAction = unconfirmedActions[unconfirmedActions.length - 1];
        insights.push(createActionInsight(lastAction, now, finalConfig.language));
    }

    // 4. Questions asked
    const questions = detectQuestions(recentTranscript, finalConfig.questionKeywords);
    if (questions.length > 0) {
        insights.push(createQuestionInsight(questions, now, finalConfig.language));
    }

    // 5. Risks detected
    if (risks.length > 0) {
        const recentRisks = risks.slice(-3);
        insights.push(createRiskInsight(recentRisks, now, finalConfig.language));
    }

    // 6. Clarifications needed
    if (clarifications.length > 0) {
        const recentClarifications = clarifications.slice(-2);
        insights.push(createClarificationInsight(recentClarifications, now, finalConfig.language));
    }

    return insights;
}

function detectTopics(blocks: TranscriptBlock[], topics: InsightDetectionConfig['topics']): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const block of blocks) {
        const text = block.text.toLowerCase();
        for (const [topic, keywords] of Object.entries(topics)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                counts[topic] = (counts[topic] || 0) + 1;
            }
        }
    }

    return counts;
}

function analyzeSentiment(blocks: TranscriptBlock[]): {
    positive: number;
    negative: number;
    neutral: number;
    negativeRatio: number;
    negativeExamples: string[];
} {
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    const negativeExamples: string[] = [];

    for (const block of blocks) {
        if (block.sentiment === 'positive') positive++;
        else if (block.sentiment === 'negative') {
            negative++;
            if (negativeExamples.length < 2) {
                negativeExamples.push(`${block.speaker}: "${block.text.substring(0, 60)}..."`);
            }
        } else neutral++;
    }

    return {
        positive,
        negative,
        neutral,
        negativeRatio: blocks.length > 0 ? negative / blocks.length : 0,
        negativeExamples,
    };
}

function detectQuestions(blocks: TranscriptBlock[], keywords: string[]): string[] {
    const questions: string[] = [];

    for (const block of blocks) {
        const text = block.text.toLowerCase();
        if (keywords.some(keyword => text.includes(keyword)) || text.includes('?')) {
            questions.push(block.text.substring(0, 80));
        }
    }

    return questions;
}

// Insight creators
function createTopicInsight(topic: string, count: number, timestamp: number, language: 'pt' | 'en'): GuidanceInsight {
    const messages = {
        pt: {
            budget: {
                title: 'PERGUNTAR SOBRE ORÇAMENTO',
                message: 'DIGA: "Qual é o orçamento disponível para este projeto? Há alguma restrição financeira que devemos considerar?"',
                context: `Tópico mencionado ${count} vezes recentemente`,
            },
            deadline: {
                title: 'CLARIFICAR PRAZO',
                message: 'DIGA: "Qual é o prazo esperado para esta entrega? Podemos confirmar as datas críticas?"',
                context: `Prazo mencionado ${count} vezes recentemente`,
            },
            risk: {
                title: 'ABORDAR RISCOS',
                message: 'DIGA: "Quais são os principais riscos que identificamos? Como podemos mitigá-los?"',
                context: `Riscos mencionados ${count} vezes recentemente`,
            },
            decision: {
                title: 'FACILITAR DECISÃO',
                message: 'DIGA: "Precisamos tomar uma decisão sobre isso. Quais são as opções e qual recomendamos?"',
                context: `Decisões mencionadas ${count} vezes recentemente`,
            },
            technical: {
                title: 'CLARIFICAR ASPECTOS TÉCNICOS',
                message: 'DIGA: "Podemos detalhar melhor os requisitos técnicos? Há alguma dependência técnica importante?"',
                context: `Aspectos técnicos mencionados ${count} vezes recentemente`,
            },
        },
        en: {
            budget: {
                title: 'ASK ABOUT BUDGET',
                message: 'SAY: "What is the available budget for this project? Are there any financial constraints we should consider?"',
                context: `Topic mentioned ${count} times recently`,
            },
            deadline: {
                title: 'CLARIFY DEADLINE',
                message: 'SAY: "What is the expected deadline for this delivery? Can we confirm the critical dates?"',
                context: `Deadline mentioned ${count} times recently`,
            },
            risk: {
                title: 'ADDRESS RISKS',
                message: 'SAY: "What are the main risks we have identified? How can we mitigate them?"',
                context: `Risks mentioned ${count} times recently`,
            },
            decision: {
                title: 'FACILITATE DECISION',
                message: 'SAY: "We need to make a decision about this. What are the options and which do we recommend?"',
                context: `Decisions mentioned ${count} times recently`,
            },
            technical: {
                title: 'CLARIFY TECHNICAL ASPECTS',
                message: 'SAY: "Can we detail the technical requirements better? Are there any important technical dependencies?"',
                context: `Technical aspects mentioned ${count} times recently`,
            },
        },
    };

    const content = messages[language][topic as keyof typeof messages.pt] || messages.pt.budget;

    return {
        id: `topic-${topic}-${timestamp}`,
        type: 'question',
        priority: 'medium',
        message: content.message,
        context: content.context,
        timestamp,
        title: content.title,
    };
}

function createSentimentInsight(
    analysis: ReturnType<typeof analyzeSentiment>,
    timestamp: number,
    language: 'pt' | 'en'
): GuidanceInsight {
    const messages = {
        pt: {
            title: 'ABORDAR TOM NEGATIVO',
            message: 'DIGA: "Vejo que há algumas preocupações. Podemos abordar estas questões diretamente? O que podemos fazer para resolver isso?"',
            context: `${analysis.negative} de ${analysis.negative + analysis.positive + analysis.neutral} mensagens recentes com sentimento negativo. Exemplos: ${analysis.negativeExamples.join(' | ')}`,
        },
        en: {
            title: 'ADDRESS NEGATIVE TONE',
            message: 'SAY: "I see there are some concerns. Can we address these issues directly? What can we do to resolve this?"',
            context: `${analysis.negative} out of ${analysis.negative + analysis.positive + analysis.neutral} recent messages with negative sentiment. Examples: ${analysis.negativeExamples.join(' | ')}`,
        },
    };

    const content = messages[language];

    return {
        id: `sentiment-${timestamp}`,
        type: 'warning',
        priority: 'high',
        message: content.message,
        context: content.context,
        timestamp,
        title: content.title,
    };
}

function createActionInsight(action: DetectedAction, timestamp: number, language: 'pt' | 'en'): GuidanceInsight {
    const messages = {
        pt: {
            title: 'CONFIRMAR AÇÃO DETECTADA',
            message: `DIGA: "Entendi que precisamos ${action.text.toLowerCase()}. Podemos confirmar quem será responsável e qual é o prazo?"`,
            context: 'Ação detectada automaticamente',
        },
        en: {
            title: 'CONFIRM DETECTED ACTION',
            message: `SAY: "I understand we need to ${action.text.toLowerCase()}. Can we confirm who will be responsible and what is the deadline?"`,
            context: 'Action detected automatically',
        },
    };

    const content = messages[language];

    return {
        id: `action-${action.id}-${timestamp}`,
        type: 'suggestion',
        priority: 'medium',
        message: content.message,
        context: content.context,
        timestamp,
        title: content.title,
    };
}

function createQuestionInsight(questions: string[], timestamp: number, language: 'pt' | 'en'): GuidanceInsight {
    const messages = {
        pt: {
            title: 'RESPONDER PERGUNTAS',
            message: 'DIGA: "Vou responder às perguntas levantadas. Deixe-me abordar cada ponto..."',
            context: `${questions.length} pergunta(s) detectada(s) recentemente`,
        },
        en: {
            title: 'ANSWER QUESTIONS',
            message: 'SAY: "I will answer the questions raised. Let me address each point..."',
            context: `${questions.length} question(s) detected recently`,
        },
    };

    const content = messages[language];

    return {
        id: `question-${timestamp}`,
        type: 'response',
        priority: 'medium',
        message: content.message,
        context: content.context,
        timestamp,
        title: content.title,
    };
}

function createRiskInsight(risks: any[], timestamp: number, language: 'pt' | 'en'): GuidanceInsight {
    const messages = {
        pt: {
            title: 'ABORDAR RISCOS IDENTIFICADOS',
            message: 'DIGA: "Identificámos alguns riscos. Vamos discutir planos de mitigação para cada um."',
            context: `${risks.length} risco(s) identificado(s)`,
        },
        en: {
            title: 'ADDRESS IDENTIFIED RISKS',
            message: 'SAY: "We have identified some risks. Let\'s discuss mitigation plans for each."',
            context: `${risks.length} risk(s) identified`,
        },
    };

    const content = messages[language];

    return {
        id: `risk-${timestamp}`,
        type: 'warning',
        priority: 'high',
        message: content.message,
        context: content.context,
        timestamp,
        title: content.title,
    };
}

function createClarificationInsight(clarifications: any[], timestamp: number, language: 'pt' | 'en'): GuidanceInsight {
    const messages = {
        pt: {
            title: 'SOLICITAR ESCLARECIMENTOS',
            message: 'DIGA: "Precisamos de alguns esclarecimentos para avançar. Podemos detalhar melhor estes pontos?"',
            context: `${clarifications.length} ponto(s) que precisa(m) de esclarecimento`,
        },
        en: {
            title: 'REQUEST CLARIFICATIONS',
            message: 'SAY: "We need some clarifications to move forward. Can we detail these points better?"',
            context: `${clarifications.length} point(s) that need(s) clarification`,
        },
    };

    const content = messages[language];

    return {
        id: `clarification-${timestamp}`,
        type: 'clarification',
        priority: 'medium',
        message: content.message,
        context: content.context,
        timestamp,
        title: content.title,
    };
}

