import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Sparkles,
    FileText,
    Users,
    Calendar,
    CheckCircle2,
    Loader2
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { motion } from "framer-motion";

interface Template {
    id: string;
    name: string;
    description: string;
    type: 'sales' | 'project' | 'review' | 'planning' | 'custom';
    suggestedTopics: string[];
    suggestedQuestions: string[];
    context: string;
}

export function SmartMeetingTemplate() {
    const { selectedProjectId, selectedCompanyId, projects, companies } = useWorkspaceStore();
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [customDescription, setCustomDescription] = useState('');

    const templates: Template[] = [
        {
            id: 'sales',
            name: 'Sales Meeting',
            description: 'Reunião de vendas com cliente potencial',
            type: 'sales',
            suggestedTopics: ['Necessidades do cliente', 'Solução proposta', 'Preço e condições', 'Próximos passos'],
            suggestedQuestions: [
                'Quais são os principais desafios que você enfrenta?',
                'Como nossa solução pode ajudar?',
                'Qual é o processo de decisão?',
                'Qual é o prazo ideal?'
            ],
            context: 'Foco em entender necessidades e apresentar solução'
        },
        {
            id: 'project',
            name: 'Project Review',
            description: 'Revisão de progresso do projeto',
            type: 'project',
            suggestedTopics: ['Status atual', 'Bloqueios', 'Próximas entregas', 'Riscos'],
            suggestedQuestions: [
                'O que foi concluído desde a última reunião?',
                'Há algum bloqueio que precisa ser resolvido?',
                'O cronograma ainda está viável?',
                'Há riscos que precisam ser mitigados?'
            ],
            context: 'Foco em acompanhamento e resolução de problemas'
        },
        {
            id: 'planning',
            name: 'Planning Session',
            description: 'Sessão de planejamento',
            type: 'planning',
            suggestedTopics: ['Objetivos', 'Recursos necessários', 'Cronograma', 'Responsabilidades'],
            suggestedQuestions: [
                'Quais são os objetivos principais?',
                'Quais recursos são necessários?',
                'Qual é o prazo ideal?',
                'Quem será responsável por cada parte?'
            ],
            context: 'Foco em definir objetivos e planos de ação'
        }
    ];

    const handleGenerateTemplate = async (template: Template) => {
        setIsGenerating(true);
        setSelectedTemplate(template);

        // Simulate AI customization based on context
        setTimeout(() => {
            // Customize template based on project/company context
            const project = projects.find(p => p.id === selectedProjectId);
            const company = companies.find(c => c.id === selectedCompanyId);

            if (project || company) {
                // Add context-specific topics
                const customizedTemplate = {
                    ...template,
                    context: `${template.context}. Contexto: ${project?.name || company?.name || 'Projeto atual'}`,
                    suggestedTopics: [
                        ...template.suggestedTopics,
                        ...(project ? [`Status do projeto: ${project.name}`] : []),
                        ...(company ? [`Relacionamento com: ${company.name}`] : [])
                    ]
                };
                setSelectedTemplate(customizedTemplate);
            }

            setIsGenerating(false);
        }, 1500);
    };

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Smart Meeting Template
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {!selectedTemplate ? (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Escolha um template inteligente que se adapta ao contexto da sua reunião
                        </p>

                        <div className="grid grid-cols-1 gap-2">
                            {templates.map((template) => (
                                <motion.div
                                    key={template.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileHover={{ scale: 1.02 }}
                                    className="p-3 rounded-lg border border-border hover:border-primary/40 transition-all cursor-pointer"
                                    onClick={() => handleGenerateTemplate(template)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="h-4 w-4 text-primary" />
                                                <p className="font-semibold text-sm">{template.name}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-2">
                                                {template.description}
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {template.suggestedTopics.slice(0, 2).map((topic, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                        {topic}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleGenerateTemplate(template);
                                            }}
                                        >
                                            {isGenerating ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Sparkles className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    {selectedTemplate.name}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {selectedTemplate.context}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedTemplate(null)}
                                className="text-xs h-7"
                            >
                                Trocar Template
                            </Button>
                        </div>

                        {/* Custom Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs">Título da Reunião</Label>
                            <Input
                                id="title"
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                                placeholder="Ex: Reunião de acompanhamento - Projeto X"
                                className="text-sm"
                            />
                        </div>

                        {/* Custom Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-xs">Descrição (Opcional)</Label>
                            <Textarea
                                id="description"
                                value={customDescription}
                                onChange={(e) => setCustomDescription(e.target.value)}
                                placeholder="Adicione detalhes sobre a reunião..."
                                className="text-sm min-h-[60px]"
                            />
                        </div>

                        {/* Suggested Topics */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Tópicos Sugeridos
                            </Label>
                            <div className="space-y-1">
                                {selectedTemplate.suggestedTopics.map((topic, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
                                        <CheckCircle2 className="h-3 w-3 text-primary" />
                                        <span>{topic}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Suggested Questions */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold flex items-center gap-2">
                                <Users className="h-3 w-3" />
                                Perguntas Sugeridas
                            </Label>
                            <div className="space-y-1">
                                {selectedTemplate.suggestedQuestions.map((question, idx) => (
                                    <div key={idx} className="p-2 rounded bg-primary/5 text-xs border border-primary/10">
                                        {question}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                                // TODO: Create thread with template
                                console.log('Create thread with template', {
                                    template: selectedTemplate,
                                    title: customTitle,
                                    description: customDescription
                                });
                            }}
                        >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Criar Reunião com Template
                        </Button>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}

