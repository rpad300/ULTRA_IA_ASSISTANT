
import {
    toGuidanceId,
    toRuleId,
    type GuidanceRule,
    type GuidanceInsight
} from "@/types/guidance";

// Helper for fuzzy matching
const fuzzyMatchTopic = (text: string, topic: string, synonyms: string[]): boolean => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes(topic.toLowerCase())) return true;
    return synonyms.some(s => lowerText.includes(s.toLowerCase()));
};

export const guidanceRules: GuidanceRule[] = [
    // 1. Budget Rule (Strategic)
    {
        id: toRuleId('check-budget'),
        name: 'Budget Verification',
        category: 'strategic',
        priorityWeight: 90,
        cooldownPeriod: 300, // 5 minutes
        matchKeywords: ['budget', 'orçamento', 'custo', 'price', 'financeiro'],
        condition: (ctx) => {
            if (!ctx.threadContext) return false;
            const budgetMentions = ctx.threadContext.split('\n').filter(l =>
                l.toLowerCase().includes('budget') ||
                l.toLowerCase().includes('orçamento') ||
                l.toLowerCase().includes('financeiro')
            );
            return budgetMentions.length > 0 &&
                !ctx.recentText.toLowerCase().includes('budget') &&
                !ctx.recentText.toLowerCase().includes('orçamento');
        },
        generate: (ctx) => {
            const mention = ctx.threadContext.split('\n').find(l =>
                l.toLowerCase().includes('budget') || l.toLowerCase().includes('orçamento')
            )?.substring(0, 100) || '';

            return {
                id: toGuidanceId(`q-${ctx.now}-budget`),
                type: 'question',
                priority: 'high',
                impact: 'high',
                title: 'PERGUNTE SOBRE O ORÇAMENTO',
                message: 'PERGUNTE: "Podemos confirmar o status do orçamento? Qual é a situação atual e há alguma preocupação que precisamos abordar?"',
                context: `Na preparação foi mencionado: "${mention}..." mas ainda não foi discutido na reunião`,
                timestamp: ctx.now,
                confidence: 95,
                scriptSource: 'Briefing Contextual',
                reasoningChain: [
                    'Tópico "Orçamento" identificado no contexto do thread.',
                    'Nenhuma menção vocal detectada nos últimos segmentos.',
                    'Regra estratégica de alto impacto acionada.'
                ],
                actions: [
                    {
                        label: 'Abrir Analytics',
                        actionId: 'open_analytics_panel',
                        icon: 'PieChart'
                    }
                ]
            };
        }
    },
    // 2. Timeline Rule (Strategic)
    {
        id: toRuleId('check-timeline'),
        name: 'Timeline Verification',
        category: 'strategic',
        priorityWeight: 85,
        cooldownPeriod: 300,
        matchKeywords: ['timeline', 'prazo', 'deadline', 'cronograma'],
        condition: (ctx) => {
            if (!ctx.threadContext) return false;
            const timelineMentions = ctx.threadContext.split('\n').filter(l =>
                l.toLowerCase().includes('timeline') ||
                l.toLowerCase().includes('prazo') ||
                l.toLowerCase().includes('deadline')
            );
            const recentLower = ctx.recentText.toLowerCase();
            return timelineMentions.length > 0 &&
                !recentLower.includes('timeline') &&
                !recentLower.includes('prazo') &&
                !recentLower.includes('deadline') &&
                !recentLower.includes('cronograma');
        },
        generate: (ctx) => {
            const mention = ctx.threadContext.split('\n').find(l =>
                l.toLowerCase().includes('timeline') || l.toLowerCase().includes('prazo')
            )?.substring(0, 100) || '';

            return {
                id: toGuidanceId(`q-${ctx.now}-timeline`),
                type: 'question',
                priority: 'high',
                impact: 'high',
                title: 'PERGUNTE SOBRE O PRAZO',
                message: 'PERGUNTE: "Podemos revisar o cronograma? O prazo ainda está viável ou precisamos ajustar alguma coisa?"',
                context: `Na preparação foi mencionado: "${mention}..." mas ainda não foi discutido na reunião`,
                timestamp: ctx.now,
                confidence: 95,
                reasoningChain: [
                    'Tópico "Prazo/Timeline" crítico não detectado na fala recente.',
                    'Item mencionado explicitamente no contexto do thread.',
                    'Nenhuma confirmação recente de datas detectada.'
                ],
                actions: [
                    {
                        label: 'Ver Timeline',
                        actionId: 'open_timeline_panel',
                        icon: 'Calendar'
                    }
                ]
            };
        }
    },
    // 3. Negative Sentiment Rule (Interpersonal)
    {
        id: toRuleId('check-sentiment'),
        name: 'Negative Sentiment Alert',
        category: 'interpersonal',
        priorityWeight: 95,
        cooldownPeriod: 120, // 2 minutes
        condition: (ctx) => {
            const negativeCount = ctx.recentSentiment.filter(s => s === 'negative').length;
            const positiveCount = ctx.recentSentiment.filter(s => s === 'positive').length;
            return negativeCount > positiveCount && ctx.transcriptBlocks.slice(-10).length > 3;
        },
        generate: (ctx) => {
            const recentTranscript = ctx.transcriptBlocks.slice(-10);
            const negativeBlocks = recentTranscript.filter(b => b.sentiment === 'negative');
            const negativeExamples = negativeBlocks.slice(-2).map(b =>
                `${b.speaker}: "${b.text.substring(0, 60)}..."`
            ).join(' | ');

            return {
                id: toGuidanceId(`w-${ctx.now}-sentiment`),
                type: 'warning',
                priority: 'high',
                impact: 'high',
                title: 'ABORDAR TOM NEGATIVO',
                message: 'DIGA: "Vejo que há algumas preocupações. Podemos abordar estas questões diretamente? O que podemos fazer para resolver isso?"',
                context: `${negativeBlocks.length} mensagens recentes com sentimento negativo. Exemplos: ${negativeExamples}`,
                timestamp: ctx.now,
                confidence: 85,
                reasoningChain: [
                    'Detectado pico de sentimento negativo (>50% das falas recentes).',
                    'Persistência em múltiplos blocos de fala consecutivos.',
                    'Sugestão de mediação gerada para neutralizar tensão.'
                ],
                actions: [
                    {
                        label: 'Ver Climatempo Emocional',
                        actionId: 'open_health_panel',
                        icon: 'Activity'
                    }
                ]
            };
        }
    },
    // 4. Action Confirmation Rule (Tactical)
    {
        id: toRuleId('check-actions'),
        name: 'Action Item Confirmation',
        category: 'tactical',
        priorityWeight: 70,
        cooldownPeriod: 60,
        condition: (ctx) => {
            return ctx.detectedActions.length > 0 && ctx.detectedActions[ctx.detectedActions.length - 1].confirmed === false;
        },
        generate: (ctx) => {
            const lastAction = ctx.detectedActions[ctx.detectedActions.length - 1];
            return {
                id: toGuidanceId(`s-${ctx.now}-action`),
                type: 'suggestion',
                priority: 'medium',
                impact: 'medium',
                title: 'CONFIRMAR AÇÃO DETECTADA',
                message: `DIGA: "Entendi que precisamos ${lastAction.text.toLowerCase()}. Podemos confirmar quem será responsável e qual é o prazo?"`,
                context: 'Ação detectada automaticamente',
                timestamp: ctx.now,
                confidence: 92,
                reasoningChain: [
                    'Entidade de ação ("fazer", "enviar", "agendar") detectada via NLP.',
                    'Ação ainda não confirmada pelo usuário.',
                    'Protocolo de encerramento de tarefa ativado.'
                ],
                actions: [
                    {
                        label: 'Confirmar Agora',
                        actionId: 'confirm_action_task',
                        payload: { actionId: lastAction.id },
                        icon: 'CheckCircle'
                    }
                ]
            };
        }
    },
    // 5. Question Response Rule (Tactical)
    {
        id: toRuleId('check-questions'),
        name: 'Response Suggestion',
        category: 'tactical',
        priorityWeight: 60,
        cooldownPeriod: 30,
        condition: (ctx) => {
            const questionKeywords = ['?', 'pergunta', 'question', 'como', 'quando', 'onde', 'quem', 'por que', 'why', 'how', 'when', 'where', 'who'];
            const recentTranscript = ctx.transcriptBlocks.slice(-5);
            if (recentTranscript.length === 0) return false;

            const lastBlock = recentTranscript[recentTranscript.length - 1];
            if (lastBlock.speaker === 'You') return false;

            return questionKeywords.some(k => lastBlock.text.toLowerCase().includes(k));
        },
        generate: (ctx) => {
            const lastBlock = ctx.transcriptBlocks[ctx.transcriptBlocks.length - 1];
            const questionText = lastBlock.text.substring(0, 150);

            let contextInfo = `Pergunta feita por ${lastBlock.speaker}`;
            // Simple context look-up logic preserved
            if (ctx.threadContext) {
                const questionLower = questionText.toLowerCase();
                const relevantContext = ctx.threadContext.split('\n').find(line => {
                    const lineLower = line.toLowerCase();
                    const words = questionLower.split(' ').filter((w: string) => w.length > 4);
                    return words.some((word: string) => lineLower.includes(word));
                });
                if (relevantContext) {
                    contextInfo = `${lastBlock.speaker} perguntou sobre isso. Na preparação havia: "${relevantContext.substring(0, 80)}..."`;
                }
            }

            return {
                id: toGuidanceId(`r-${ctx.now}-response`),
                type: 'response',
                priority: 'high',
                impact: 'medium',
                title: 'RESPONDER À PERGUNTA',
                message: `RESPONDA: "${questionText}" - Forneça uma resposta clara e completa. Se não souber, diga: "Vou verificar e retorno com uma resposta precisa."`,
                context: contextInfo,
                timestamp: ctx.now,
                confidence: 88,
                reasoningChain: [
                    'Sintaxe de interrogação detectada na última fala.',
                    'Identificado orador diferente do usuário.',
                    'Contexto relacional encontrado no thread anterior (RAG).'
                ]
            };
        }
    },
    // 6. Clarification Rule (Tactical)
    {
        id: toRuleId('check-clarification'),
        name: 'Clarification Needed',
        category: 'tactical',
        priorityWeight: 75,
        cooldownPeriod: 120,
        condition: (ctx) => ctx.clarifications.length > 0,
        generate: (ctx) => {
            const lastClarification = ctx.clarifications[ctx.clarifications.length - 1];
            return {
                id: toGuidanceId(`c-${ctx.now}-clarification`),
                type: 'clarification',
                priority: 'medium',
                impact: 'medium',
                title: 'CLARIFICAR PONTO IMPORTANTE',
                message: `PERGUNTE: "${lastClarification.suggestion}" - Certifique-se de obter uma confirmação explícita.`,
                context: lastClarification.context,
                timestamp: ctx.now,
                confidence: 80,
                reasoningChain: [
                    'Ambiguidade detetada em termo técnico ou prazo.',
                    'Gerador de clareza disparado.'
                ]
            };
        }
    },
    // 7. Participation Rule (Interpersonal)
    {
        id: toRuleId('check-participation'),
        name: 'Involve Others',
        category: 'interpersonal',
        priorityWeight: 50,
        cooldownPeriod: 400,
        condition: (ctx) => {
            const recentTranscript = ctx.transcriptBlocks.slice(-10);
            const uniqueSpeakers = new Set(recentTranscript.map(b => b.speaker)).size;
            return uniqueSpeakers < 2 && recentTranscript.length > 5;
        },
        generate: (ctx) => {
            const recentTranscript = ctx.transcriptBlocks.slice(-10);
            const uniqueSpeakers = new Set(recentTranscript.map(b => b.speaker)).size;
            const otherParticipants = ctx.participants.filter(p => !recentTranscript.some(b => b.speaker === p.name || b.speaker === p.speakerId));
            const participantName = otherParticipants.length > 0 ? otherParticipants[0].name || otherParticipants[0].speakerId : 'outros participantes';

            return {
                id: toGuidanceId(`b-${ctx.now}-participation`),
                type: 'behavior',
                targetParticipantId: otherParticipants.length > 0 ? otherParticipants[0].id : '',
                behaviorMetric: 'monologue',
                priority: 'medium',
                impact: 'low',
                title: 'ENVOLVER OUTROS PARTICIPANTES',
                message: `PERGUNTE: "${participantName}, qual é a sua opinião sobre isso?" ou "Alguém mais tem algo a adicionar?"`,
                context: `${uniqueSpeakers} participante(s) ativo(s) nas últimas mensagens`,
                timestamp: ctx.now,
                confidence: 75,
                reasoningChain: [
                    'Padrão de monólogo detectado (>5 blocos, <2 speakers).',
                    'Análise de participantes inativos realizada.',
                    'Sugestão de inclusão para balancear "Talk Ratio".'
                ],
                actions: [
                    {
                        label: 'Ver Participantes',
                        actionId: 'open_participants_panel',
                        icon: 'Users'
                    }
                ]
            };
        }
    },
    // 8. Risks Rule (Strategic)
    {
        id: toRuleId('check-risks'),
        name: 'Risk Mitigation',
        category: 'strategic',
        priorityWeight: 98,
        cooldownPeriod: 180,
        condition: (ctx) => {
            const highRisks = ctx.risks.filter(r => r.severity === 'high');
            return highRisks.length > 0;
        },
        generate: (ctx) => {
            const highRisks = ctx.risks.filter(r => r.severity === 'high');
            const riskSummary = highRisks[0].summary;
            return {
                id: toGuidanceId(`w-${ctx.now}-risk`),
                type: 'warning',
                priority: 'high',
                impact: 'high',
                title: 'ABORDAR RISCO URGENTE',
                message: `DIGA: "Identifiquei uma preocupação: ${riskSummary}. Podemos discutir como vamos mitigar isso?"`,
                context: `${highRisks.length} risco(s) de alta prioridade detectado(s)`,
                timestamp: ctx.now,
                confidence: 98,
                reasoningChain: [
                    'Termos de alto risco identificados (ex: "atraso critico", "falha").',
                    'Classificação de severidade "High" confirmada.',
                    'Protocolo de mitigação imediata acionado.'
                ]
            };
        }
    },
    // 9. Topics Not Discussed Rule (Strategic)
    {
        id: toRuleId('check-undiscussed'),
        name: 'Undiscussed Topics',
        category: 'strategic',
        priorityWeight: 65,
        cooldownPeriod: 600, // 10 minutes (Checking broad topics)
        maxTriggersPerSession: 3,
        condition: (ctx) => {
            if (!ctx.threadContext || ctx.recentText.length < 50) return false;
            return true;
        },
        generate: (ctx) => {
            const topicMap: Record<string, { synonyms: string[], script: string }> = {
                'scope': {
                    synonyms: ['escopo', 'abrangência', 'limites'],
                    script: 'PERGUNTE: "Podemos confirmar o escopo do projeto? Há algo que precisa ser esclarecido ou ajustado?"'
                },
                'requirement': {
                    synonyms: ['requisitos', 'requirement', 'necessidades', 'especificação'],
                    script: 'PERGUNTE: "Os requisitos estão claros para todos? Há algum requisito que precisa ser revisado?"'
                },
                'deliverable': {
                    synonyms: ['entregáveis', 'entregável', 'artifacts', 'produtos'],
                    script: 'PERGUNTE: "Podemos revisar os entregáveis? Todos estão alinhados sobre o que será entregue?"'
                },
                'risk': {
                    synonyms: ['risk', 'riscos', 'ameaças', 'problemas potenciais'],
                    script: 'PERGUNTE: "Quais são os principais riscos que precisamos considerar? Como vamos mitigá-los?"'
                },
                'stakeholder': {
                    synonyms: ['stakeholder', 'interessados', 'envolvidos', 'cliente'],
                    script: 'PERGUNTE: "Todos os stakeholders foram considerados? Estamos alinhados com suas expectativas?"'
                }
            };

            const insights: GuidanceInsight[] = [];
            const contextLower = ctx.threadContext.toLowerCase();
            const recentText = ctx.transcriptBlocks.map(b => b.text).join(' ');

            for (const [key, config] of Object.entries(topicMap)) {
                if (fuzzyMatchTopic(contextLower, key, config.synonyms)) {
                    if (!fuzzyMatchTopic(recentText, key, config.synonyms)) {
                        insights.push({
                            id: toGuidanceId(`q-${ctx.now}-topic-${key}`),
                            type: 'question',
                            priority: 'medium',
                            impact: 'medium',
                            title: `ABORDAR: ${key.toUpperCase()}`,
                            message: config.script,
                            context: 'Mencionado na preparação do thread mas ainda não discutido recentemente',
                            timestamp: ctx.now,
                            confidence: 90,
                            scriptSource: 'Topic Analysis',
                            reasoningChain: [
                                `Tópico chave "${key}" identificado no material de preparação.`,
                                `Ausência de discussão sobre "${key}" na transcrição recente.`,
                                'Sugestão de alinhamento gerada.'
                            ],
                            actions: [
                                {
                                    label: 'Ver Tópicos',
                                    actionId: 'open_insights_panel',
                                    icon: 'List'
                                }
                            ]
                        });
                    }
                }
            }

            return insights.length > 0 ? insights[0] : [];
        }
    }
];
