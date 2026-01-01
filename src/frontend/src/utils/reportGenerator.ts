import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface ReportData {
    session: {
        title: string;
        date: number;
        duration: number;
        participants: string[];
    };
    summary: {
        context: string;
        keyPoints: readonly string[];
        conclusion: string;
    };
    decisions: Array<{ text: string; status: string; timestamp: number }>;
    actions: Array<{ text: string; assignee?: string; dueDate?: string }>;
    metrics: {
        qualityScore: number;
        talkTime: Array<{ name: string; percentage: number }>;
    };
}

export const generateMarkdownReport = generateSessionReport;

export function generateSessionReport(data: ReportData): string {
    const { session, summary, decisions, actions, metrics } = data;
    const dateStr = format(session.date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt });
    const durationStr = `${Math.floor(session.duration / 60)}m`;

    return `
# Relatório Executivo de Sessão
**${session.title}**

---

## 📅 Metadados da Sessão
- **Data:** ${dateStr}
- **Duração:** ${durationStr}
- **Participantes:** ${session.participants.join(", ")}
- **Quality Score:** ${metrics.qualityScore}/100

---

## 📝 Resumo Executivo

### Contexto
${summary.context}

### Pontos Chave
${summary.keyPoints.map(p => `- ${p}`).join("\n")}

### Conclusão
${summary.conclusion}

---

## ✅ Decisões Verificadas
${decisions.length === 0 ? "_Nenhuma decisão registrada._" : decisions.map(d => `
### ${d.text}
- **Status:** ${d.status}
- **Hora:** ${format(d.timestamp, "HH:mm")}
`).join("\n")}

---

## 🎯 Smart Action Items
${actions.length === 0 ? "_Nenhuma ação detectada._" : actions.map(a => `
- [ ] **${a.text}**
  - *Responsável:* ${a.assignee || "Não atribuído"}
  - *Prazo:* ${a.dueDate || "A definir"}
`).join("\n")}

---

## 📊 Analytics de Governança

### Distribuição de Voz
${metrics.talkTime.map(t => `- **${t.name}:** ${t.percentage}%`).join("\n")}

---
*Gerado por Ultra Assistant AI - ${format(Date.now(), "dd/MM/yyyy HH:mm")}*
`.trim();
}

export function downloadReport(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
