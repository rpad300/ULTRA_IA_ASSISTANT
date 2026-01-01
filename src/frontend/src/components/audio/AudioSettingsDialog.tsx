import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from '@/components/ui/badge';
import { Settings2, Sparkles, Wand2 } from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';


export function AudioSettingsDialog() {
    const {
        audioGain, setAudioGain,
        customVocabulary, setCustomVocabulary,
        autoStopEnabled, setAutoStopEnabled,
        silenceTimeoutMs, isRecording
    } = useMeetingStore();

    const [localVocab, setLocalVocab] = useState(customVocabulary.join(", "));
    const [isOpen, setIsOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

    // Sync vocab from store when opening
    useEffect(() => {
        if (isOpen) {
            setLocalVocab(customVocabulary.join(", "));
        }
    }, [isOpen, customVocabulary]);

    const handleSaveVocab = () => {
        const terms = localVocab.split(',').map(s => s.trim()).filter(Boolean);
        setCustomVocabulary(terms);
    };

    const { transcriptBlocks, participants } = useMeetingStore();

    // Real AI Suggestion Logic
    // Extracts potential proper nouns and participant names from recent context
    const generateSuggestions = () => {
        setIsGeneratingSuggestions(true);

        // Simulate a brief "analysis" delay for UX, even if local calc is fast
        setTimeout(() => {
            const currentVocabLower = localVocab.toLowerCase().split(',').map(s => s.trim());
            const candidates = new Set<string>();

            // 1. Participant Names
            participants.forEach(p => {
                if (p.name && !currentVocabLower.includes(p.name.toLowerCase())) {
                    candidates.add(p.name);
                }
            });

            // 2. Formatting / Proper Nouns from recent Transcript (last 50 blocks)
            // Simple heuristic: Look for capitalized words that aren't at start of sentence (rough) 
            // OR just frequent capitalized words. 
            // For now, let's grab words > 4 chars that start with Capital inside text.
            const recentText = transcriptBlocks.slice(-50).map(b => b.text).join(" ");
            const matches = recentText.matchAll(/\b[A-Z][a-zA-Z0-9]{3,}\b/g);

            for (const match of matches) {
                const word = match[0];
                if (!currentVocabLower.includes(word.toLowerCase())) {
                    candidates.add(word);
                }
            }

            // Limit to top 8 suggestions to avoid clutter
            const suggestionsArray = Array.from(candidates).slice(0, 8);

            if (suggestionsArray.length === 0) {
                // Fallback if no data yet
                if (participants.length === 0 && transcriptBlocks.length === 0) {
                    setSuggestions(["Project Alpha", "Q3 Report", "Roadmap"]); // Cold start hints
                } else {
                    setSuggestions([]);
                }
            } else {
                setSuggestions(suggestionsArray);
            }

            setIsGeneratingSuggestions(false);
        }, 800);
    };

    const addSuggestion = (term: string) => {
        const newVal = localVocab ? `${localVocab}, ${term}` : term;
        setLocalVocab(newVal);
        setSuggestions(prev => prev.filter(p => p !== term));
        // Auto save?
        // setCustomVocabulary ... let's wait for blur or close to save to store to avoid partial updates
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) handleSaveVocab(); // Save on close
            setIsOpen(open);
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-zinc-800 text-zinc-400">
                    <Settings2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            {/* SOTA Design: Zinc-950 background with glass effect border */}
            <DialogContent className="sm:max-w-[425px] bg-zinc-950/95 backdrop-blur-2xl border-zinc-800 text-zinc-100 shadow-2xl shadow-indigo-500/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-light">
                        <Settings2 className="w-5 h-5 text-indigo-500" /> Audio Intelligence
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Configure gain, threshold, and context awareness.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">

                    {/* Volume / Gain Layout */}
                    <div className="space-y-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="gain" className="text-zinc-300">Digital Gain Boost</Label>
                            <Badge variant="outline" className="font-mono text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                                {audioGain.toFixed(1)}x
                            </Badge>
                        </div>

                        <div className="relative pt-2">
                            <input
                                id="gain"
                                type="range"
                                min="1" max="5" step="0.1"
                                value={audioGain}
                                onChange={(e) => setAudioGain(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                            />
                            {/* Scale markers */}
                            <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-mono">
                                <span>1x</span>
                                <span>2.5x</span>
                                <span>5x</span>
                            </div>
                        </div>

                        {audioGain > 3 && (
                            <div className="flex items-center gap-2 text-[10px] text-orange-400 bg-orange-500/10 p-2 rounded border border-orange-500/20">
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                High gain may cause audio clipping/distortion.
                            </div>
                        )}
                    </div>

                    {/* Vocabulary Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="vocab" className="text-zinc-300">Context Vocabulary</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={generateSuggestions}
                                disabled={isGeneratingSuggestions}
                                className="h-6 text-[10px] px-2 text-indigo-300 gap-1 hover:text-indigo-200 hover:bg-indigo-500/20"
                            >
                                {isGeneratingSuggestions ? (
                                    <Sparkles className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Wand2 className="w-3 h-3" />
                                )}
                                AI Suggest
                            </Button>
                        </div>

                        <Textarea
                            id="vocab"
                            placeholder="E.g. Product names, Acronyms..."
                            value={localVocab}
                            onChange={(e) => setLocalVocab(e.target.value)}
                            className="h-24 resize-none bg-zinc-900/50 border-zinc-800 focus:border-indigo-500/50 text-xs leading-relaxed"
                            disabled={isRecording}
                        />

                        {/* Suggested Chips */}
                        {suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((s, i) => (
                                    <Badge
                                        key={i}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors border-zinc-700"
                                        onClick={() => addSuggestion(s)}
                                    >
                                        + {s}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        <p className="text-[10px] text-zinc-500">
                            These terms will be boosted in the transcription model.
                        </p>
                    </div>

                    {/* Auto Stop */}
                    <div className="flex items-center justify-between space-x-2 rounded-xl bg-zinc-900/30 border border-zinc-800/50 p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-stop" className="text-zinc-300 text-sm">Smart Auto-Stop</Label>
                            <p className="text-[10px] text-zinc-500">
                                End session after {(silenceTimeoutMs / 1000).toFixed(0)}s of silence.
                            </p>
                        </div>
                        <Switch
                            id="auto-stop"
                            checked={autoStopEnabled}
                            onCheckedChange={setAutoStopEnabled}
                            className="data-[state=checked]:bg-indigo-600"
                        />
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
