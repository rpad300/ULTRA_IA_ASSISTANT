import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RefreshCw,
    Linkedin,
    Mail,
    Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";

interface EnrichmentSource {
    id: string;
    type: 'meeting' | 'linkedin' | 'email' | 'company';
    name: string;
    data: Record<string, any>;
    confidence: number;
    status: 'pending' | 'available' | 'applied';
}

interface AutoEnrichmentPanelProps {
    contactId: string;
    contactName?: string;
    contactEmail?: string;
}

export function AutoEnrichmentPanel({
    contactId
}: AutoEnrichmentPanelProps) {
    const [autoEnrichmentEnabled, setAutoEnrichmentEnabled] = useState(false);
    const [isEnriching, setIsEnriching] = useState(false);
    const [enrichmentSources, setEnrichmentSources] = useState<EnrichmentSource[]>([]);

    const handleEnrich = async () => {
        if (!contactId) return;

        setIsEnriching(true);
        try {
            // TODO: Call real enrichment API endpoint
            // const res = await workspaceApi.get(`/contacts/${contactId}/enrich`);
            // setEnrichmentSources(res.data.sources || []);

            // For now, show empty state until API is implemented
            setEnrichmentSources([]);
            console.log("Enrichment API not yet implemented");
        } catch (error) {
            console.error("Failed to enrich contact:", error);
            toast.error("Failed to enrich contact");
        } finally {
            setIsEnriching(false);
        }
    };

    const handleApplyEnrichment = (sourceId: string) => {
        setEnrichmentSources(prev =>
            prev.map(s => s.id === sourceId ? { ...s, status: 'applied' } : s)
        );
        // TODO: Actually apply enrichment data
    };

    const getSourceIcon = (type: string) => {
        switch (type) {
            case 'meeting':
                return <Calendar className="h-4 w-4" />;
            case 'linkedin':
                return <Linkedin className="h-4 w-4" />;
            case 'email':
                return <Mail className="h-4 w-4" />;
            case 'company':
                return <AlertCircle className="h-4 w-4" />;
            default:
                return <Sparkles className="h-4 w-4" />;
        }
    };

    const getSourceColor = (type: string) => {
        switch (type) {
            case 'meeting':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'linkedin':
                return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            case 'email':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'company':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const availableSources = enrichmentSources.filter(s => s.status === 'available');
    const appliedSources = enrichmentSources.filter(s => s.status === 'applied');

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Auto-Enrichment
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Switch
                            id="auto-enrichment"
                            checked={autoEnrichmentEnabled}
                            onCheckedChange={setAutoEnrichmentEnabled}
                        />
                        <Label htmlFor="auto-enrichment" className="text-xs cursor-pointer">
                            Auto
                        </Label>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {enrichmentSources.length === 0 ? (
                    <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground mb-3">
                            Enriquecer dados do contacto automaticamente
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleEnrich}
                            disabled={isEnriching}
                            className="text-xs"
                        >
                            {isEnriching ? (
                                <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Enriquecendo...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Enriquecer Agora
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    <>
                        {availableSources.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold">Available Enrichments</p>
                                {availableSources.map((source) => (
                                    <motion.div
                                        key={source.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn(
                                            "p-3 rounded-lg border text-xs space-y-2",
                                            getSourceColor(source.type)
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1">
                                                {getSourceIcon(source.type)}
                                                <div>
                                                    <p className="font-medium">{source.name}</p>
                                                    <p className="text-xs opacity-80 mt-0.5">
                                                        {Object.keys(source.data).length} fields found
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {source.confidence}%
                                            </Badge>
                                        </div>

                                        <div className="pt-2 border-t border-current/20">
                                            <div className="space-y-1 mb-2">
                                                {Object.entries(source.data).slice(0, 2).map(([key, value]) => (
                                                    <div key={key} className="flex items-center justify-between text-xs">
                                                        <span className="opacity-80 capitalize">{key}:</span>
                                                        <span className="font-medium">{String(value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full text-xs h-7"
                                                onClick={() => handleApplyEnrichment(source.id)}
                                            >
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Apply Enrichment
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {appliedSources.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border">
                                <p className="text-xs font-semibold">Applied Enrichments</p>
                                {appliedSources.map((source) => (
                                    <div
                                        key={source.id}
                                        className="p-2 rounded bg-green-500/10 border border-green-500/20 text-xs flex items-center gap-2"
                                    >
                                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                                        <span className="opacity-80">{source.name} applied</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

