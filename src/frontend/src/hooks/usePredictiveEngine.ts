import { useEffect, useState, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import { useAICoPilotEngine } from '@/hooks/useAICoPilotEngine';
import type { PrepDocument } from '@/store/slices/intelligenceSlice';

export function usePredictiveEngine() {
    const {
        prepDocuments,
        sessionId,
        generatePrepDocument,
        updatePrepDocument,
        isRecording,
        currentTopic
    } = useMeetingStore();

    const { sendUserMessage } = useAICoPilotEngine();

    // Get the latest prep document
    const currentPrep = prepDocuments[prepDocuments.length - 1] as PrepDocument | undefined;

    const [isGenerating, setIsGenerating] = useState(false);

    // SOTA: 'Neural Pulse' simulation loop
    // In a real app, this would listen to websocket events for 'topic_discussed' or 'risk_mitigated'.
    // Here we simulate "Awareness" by checking if the current topic matches any predicted topic.
    useEffect(() => {
        if (!currentPrep || !isRecording || !currentTopic) return;

        const interval = setInterval(() => {
            // 1. Check if any pending topic matches the current topic (fuzzy match simulation)
            const matchedTopicIndex = currentPrep.likelyTopics.findIndex(
                t => t.status === 'pending' && currentTopic.toLowerCase().includes(t.topic.toLowerCase())
            );

            if (matchedTopicIndex !== -1) {
                const topic = currentPrep.likelyTopics[matchedTopicIndex];
                // Update specific topic status
                const newTopics = [...currentPrep.likelyTopics];
                newTopics[matchedTopicIndex] = { ...topic, status: 'discussed' };

                updatePrepDocument({
                    likelyTopics: newTopics
                });
            }

            // 2. Randomly mitigate a risk if confidence is high (Simulation of "Battle Card won")
            // We'll do this very rarely to show the dynamic UI
            if (Math.random() > 0.98) {
                const activeRisks = currentPrep.risks.filter(r => r.status === 'active');
                if (activeRisks.length > 0) {
                    const riskToMitigate = activeRisks[0];
                    const newRisks = currentPrep.risks.map(r =>
                        r.risk === riskToMitigate.risk ? { ...r, status: 'mitigated' as const } : r
                    );
                    updatePrepDocument({ risks: newRisks });
                }
            }

        }, 3000); // Check every 3 seconds

        return () => clearInterval(interval);
    }, [currentPrep, isRecording, currentTopic, updatePrepDocument]);

    const generatePreparation = useCallback(async () => {
        if (!sessionId) return;
        setIsGenerating(true);

        // Simulate "Neural Processing" delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        generatePrepDocument(sessionId);
        setIsGenerating(false);
    }, [sessionId, generatePrepDocument]);

    const sendToCoPilot = useCallback((text: string) => {
        // "One-Tap Query" Bridge
        sendUserMessage(`Sobre a preparação estratégica: ${text}`);
    }, [sendUserMessage]);

    const exportDocument = useCallback((format: 'pdf' | 'markdown') => {
        if (!currentPrep) return;

        if (format === 'markdown') {
            // const date = new Date(currentPrep.generatedAt).toLocaleDateString();
            const mdContent = `
# Strategic Anticipation: ${new Date().toLocaleDateString()}
**Session ID:** ${sessionId}

## 🎯 Executive Summary
*Generated via Ultra Assistant Neural Engine*

## 👥 Stakeholder Map
${currentPrep.participantInsights.map((p: any) => `
### ${p.name}
* **Focus Areas:** ${p.historicalAttention.join(', ')}
* **Key Insight:** ${p.insights[0]}
* **Likely Questions:**
${p.likelyQuestions.map((q: string) => `  - ${q}`).join('\n')}
`).join('\n')}

## 🔮 Anticipated Topics
${currentPrep.likelyTopics.map((t: any) => `- [${t.status === 'discussed' ? 'x' : ' '}] **${t.topic}** (${t.confidence}% Confidence)`).join('\n')}

## 🛡️ Risk Mitigation (Battle Cards)
${currentPrep.risks.map((r: any) => `
### ⚠️ ${r.risk} (${r.probability}% Probability)
**Status:** ${r.status.toUpperCase()}
> **Counter-Strategy:** ${r.battleCard}
`).join('\n')}

---
*Exported from Ultra Assistant*
            `;

            const blob = new Blob([mdContent.trim()], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Strategic_Prep_${sessionId}_${Date.now()}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // PDF fallback to print for now (SOTA usually requires a heavy lib like pdfmake or react-pdf)
            window.print();
        }
    }, [currentPrep, sessionId]);

    return {
        currentPrep,
        isGenerating,
        generatePreparation,
        sendToCoPilot,
        exportDocument
    };
}
