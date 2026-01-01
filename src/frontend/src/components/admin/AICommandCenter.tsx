
import { useEffect, useState } from "react";
import { adminAiApi, type AIConfig } from "@/api/admin_ai";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, BrainCircuit, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function AICommandCenter() {
    const [configs, setConfigs] = useState<AIConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    // Local state for edits before save
    const [edits, setEdits] = useState<Record<string, Partial<AIConfig>>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await adminAiApi.fetchConfigs();
            setConfigs(data);
            setEdits({});
        } catch (error) {
            console.error(error);
            toast.error("Failed to load AI configs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleChange = (slug: string, field: keyof AIConfig, value: any) => {
        setEdits(prev => ({
            ...prev,
            [slug]: {
                ...prev[slug],
                [field]: value
            }
        }));
    };

    const handleSave = async (slug: string) => {
        const changes = edits[slug];
        if (!changes) return;

        setSaving(slug);
        try {
            const updated = await adminAiApi.updateConfig(slug, changes);

            // Update local state with server response
            setConfigs(prev => prev.map(c => c.slug === slug ? updated : c));

            // Clear edits for this slug
            setEdits(prev => {
                const newEdits = { ...prev };
                delete newEdits[slug];
                return newEdits;
            });

            toast.success(`Updated ${slug} configuration`);
        } catch (error) {
            toast.error("Failed to save changes");
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <BrainCircuit className="text-primary h-6 w-6" />
                        AI Command Center
                    </h2>
                    <p className="text-muted-foreground">Manage prompts, models, and personality settings for all Agents.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {configs.map(config => {
                    const pendingChanges = edits[config.slug] || {};
                    const current = { ...config, ...pendingChanges };
                    const hasChanges = Object.keys(pendingChanges).length > 0;

                    return (
                        <Card key={config.slug} className={`border-l-4 ${current.is_active ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-mono flex items-center gap-2">
                                            {config.slug}
                                            {hasChanges && <Badge variant="secondary" className="ml-2 text-xs">Modified</Badge>}
                                        </CardTitle>
                                        <CardDescription>Last updated: {new Date(config.updated_at || "").toLocaleDateString()}</CardDescription>
                                    </div>
                                    <Switch
                                        checked={current.is_active}
                                        onCheckedChange={(v) => handleChange(config.slug, 'is_active', v)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Model Selection */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Model</Label>
                                        <Select
                                            value={current.model_name}
                                            onValueChange={(v) => handleChange(config.slug, 'model_name', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                                                <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                                                <SelectItem value="gpt-4o">GPT-4o (External)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Max Tokens</Label>
                                        <Input
                                            type="number"
                                            value={current.max_tokens}
                                            onChange={(e) => handleChange(config.slug, 'max_tokens', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>

                                {/* Temperature Slider */}
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <Label>Creativity (Temperature): {current.temperature}</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {current.temperature < 0.3 ? "Strict" : current.temperature > 0.8 ? "Creative" : "Balanced"}
                                        </span>
                                    </div>
                                    <Slider
                                        value={[current.temperature]}
                                        min={0}
                                        max={1.0}
                                        step={0.1}
                                        onValueChange={(vals) => handleChange(config.slug, 'temperature', vals[0])}
                                    />
                                </div>

                                {/* System Prompt */}
                                <div className="space-y-2">
                                    <Label className="flex justify-between">
                                        System Prompt
                                        <Sparkles className="h-3 w-3 text-yellow-500" />
                                    </Label>
                                    <Textarea
                                        className="font-mono text-xs min-h-[150px] bg-muted/30"
                                        value={current.system_prompt}
                                        onChange={(e) => handleChange(config.slug, 'system_prompt', e.target.value)}
                                    />
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={() => handleSave(config.slug)}
                                        disabled={!hasChanges || saving === config.slug}
                                    >
                                        {saving === config.slug ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
