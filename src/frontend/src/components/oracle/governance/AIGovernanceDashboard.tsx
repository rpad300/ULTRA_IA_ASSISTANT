
import React, { useEffect, useState } from 'react';
import { AdminService } from '../../../services/AdminService';
import type { AIConfig } from '../../../types/admin';
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Slider } from '../../ui/slider';
import { ScrollArea } from '../../ui/scroll-area';
import { Loader2, Save, RefreshCw, Cpu, BrainCircuit } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const AIGovernanceDashboard: React.FC = () => {
    const [configs, setConfigs] = useState<AIConfig[]>([]);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<AIConfig>>({});

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        setIsLoading(true);
        try {
            const data = await AdminService.getAllConfigs();
            setConfigs(data);
            if (data.length > 0 && !selectedSlug) {
                handleSelect(data[0]);
            }
        } catch (e) {
            console.error("Failed to load configs", e);
            // Assuming we have a toast provider
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (config: AIConfig) => {
        setSelectedSlug(config.slug);
        setFormData({ ...config });
    };

    const handleSave = async () => {
        if (!selectedSlug) return;
        setIsSaving(true);
        try {
            await AdminService.updateConfig(selectedSlug, {
                model: formData.model,
                temperature: formData.temperature,
                prompt_template: formData.prompt_template,
                max_tokens: formData.max_tokens
            });
            await loadConfigs(); // Refresh
            toast.success("Configuration saved successfully");
        } catch (e) {
            console.error("Save failed", e);
            toast.error("Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    };

    const selectedConfig = configs.find(c => c.slug === selectedSlug);

    return (
        <div className="flex h-[600px] w-[800px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Sidebar List */}
            <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
                <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <h3 className="font-semibold text-slate-200 text-sm">AI Configurations</h3>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col p-2 gap-1">
                        {configs.map(config => (
                            <button
                                key={config.slug}
                                onClick={() => handleSelect(config)}
                                className={cn(
                                    "text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                                    selectedSlug === config.slug
                                        ? "bg-purple-500/20 text-purple-200 border border-purple-500/30"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                )}
                            >
                                <BrainCircuit className="w-3 h-3" />
                                {config.slug}
                            </button>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-2 border-t border-slate-800">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-slate-500" onClick={loadConfigs}>
                        <RefreshCw className={cn("w-3 h-3 mr-2", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col bg-slate-950">
                {selectedSlug && formData ? (
                    <>
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-100">{selectedSlug.toUpperCase()}</h2>
                                    <p className="text-xs text-slate-500">{selectedConfig?.description || "Runtime Configuration"}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-600 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                        ID: {selectedSlug}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Model & Temp Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400">MODEL ID</label>
                                        <Input
                                            value={formData.model || ''}
                                            onChange={e => setFormData({ ...formData, model: e.target.value })}
                                            className="bg-slate-900 border-slate-800 text-slate-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400">
                                            TEMPERATURE: {formData.temperature}
                                        </label>
                                        <div className="pt-2 px-1">
                                            <Slider
                                                value={[formData.temperature || 0.7]}
                                                max={1}
                                                step={0.1}
                                                onValueChange={vals => setFormData({ ...formData, temperature: vals[0] })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Prompt Editor */}
                                <div className="space-y-2 flex-1 flex flex-col">
                                    <label className="text-xs font-semibold text-slate-400">SYSTEM PROMPT TEMPLATE</label>
                                    <Textarea
                                        value={formData.prompt_template || ''}
                                        onChange={e => setFormData({ ...formData, prompt_template: e.target.value })}
                                        className="bg-slate-900 border-slate-800 text-slate-300 font-mono text-xs min-h-[200px] flex-1 resize-y"
                                    />
                                    <p className="text-[10px] text-slate-600">
                                        Supports Jinja2 variables. Use {"{{ variable_name }}"}.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex justify-end gap-3">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                <Save className="w-4 h-4 mr-2" />
                                Save Configuration
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        Select a configuration to edit
                    </div>
                )}
            </div>
        </div>
    );
};
