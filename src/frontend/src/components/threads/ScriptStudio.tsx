import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    FileText, 
    Plus, 
    Edit, 
    Trash2, 
    Sparkles,
    Clock,
    Zap,
    MessageSquare,
    Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useOverlayStore } from "@/store/overlayStore";

interface Script {
    id: string;
    title: string;
    type: 'intro' | 'pitch_tecnico' | 'closing' | 'qa' | 'custom';
    content: string;
    blocks: ScriptBlock[];
    keyPoints: string[];
    createdAt: number;
    updatedAt: number;
}

interface ScriptBlock {
    id: string;
    text: string;
    isKeyPoint: boolean;
    order: number;
}

const scriptTypes = [
    { value: 'intro', label: 'Intro' },
    { value: 'pitch_tecnico', label: 'Pitch Técnico' },
    { value: 'closing', label: 'Closing' },
    { value: 'qa', label: 'Q&A' },
    { value: 'custom', label: 'Custom' },
];

export function ScriptStudio() {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [selectedScript, setSelectedScript] = useState<Script | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const { openOverlay } = useOverlayStore();
    
    const [newScriptTitle, setNewScriptTitle] = useState('');
    const [newScriptType, setNewScriptType] = useState<string>('custom');
    const [editingContent, setEditingContent] = useState('');
    // Note: editingBlocks is set but not currently read - may be needed for future block editing features
    const [, setEditingBlocks] = useState<ScriptBlock[]>([]);
    
    const handleCreateScript = () => {
        setIsCreating(true);
        setSelectedScript(null);
        setNewScriptTitle('');
        setNewScriptType('custom');
        setEditingContent('');
        setEditingBlocks([]);
    };
    
    const handleSaveNewScript = () => {
        if (!newScriptTitle.trim()) return;
        
        const blocks = editingContent.split('\n\n').map((text, idx) => ({
            id: `block-${Date.now()}-${idx}`,
            text: text.trim(),
            isKeyPoint: false,
            order: idx
        })).filter(b => b.text);
        
        const newScript: Script = {
            id: `script-${Date.now()}`,
            title: newScriptTitle,
            type: newScriptType as Script['type'],
            content: editingContent,
            blocks,
            keyPoints: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        setScripts([...scripts, newScript]);
        setSelectedScript(newScript);
        setIsCreating(false);
        setIsEditing(true);
    };
    
    const handleSelectScript = (script: Script) => {
        setSelectedScript(script);
        setIsEditing(false);
        setEditingContent(script.content);
        setEditingBlocks(script.blocks);
    };
    
    const handleEditScript = () => {
        if (!selectedScript) return;
        setIsEditing(true);
    };
    
    const handleSaveScript = () => {
        if (!selectedScript) return;
        
        const blocks = editingContent.split('\n\n').map((text, idx) => ({
            id: `block-${Date.now()}-${idx}`,
            text: text.trim(),
            isKeyPoint: selectedScript.blocks.find(b => b.text === text)?.isKeyPoint || false,
            order: idx
        })).filter(b => b.text);
        
        const updatedScript: Script = {
            ...selectedScript,
            content: editingContent,
            blocks,
            updatedAt: Date.now()
        };
        
        setScripts(scripts.map(s => s.id === selectedScript.id ? updatedScript : s));
        setSelectedScript(updatedScript);
        setIsEditing(false);
    };
    
    const handleToggleKeyPoint = (blockId: string) => {
        if (!selectedScript) return;
        
        setEditingBlocks((blocks: ScriptBlock[]) => 
            blocks.map((b: ScriptBlock) => b.id === blockId ? { ...b, isKeyPoint: !b.isKeyPoint } : b)
        );
    };
    
    const handleDeleteScript = (scriptId: string) => {
        setScripts(scripts.filter(s => s.id !== scriptId));
        if (selectedScript?.id === scriptId) {
            setSelectedScript(null);
            setIsEditing(false);
        }
    };
    
    const handleAIAction = (action: 'generate' | 'shorten' | 'diplomatic') => {
        // TODO: Implement AI actions
        console.log('AI Action:', action);
    };
    
    return (
        <div className="flex gap-4 h-full">
            {/* Scripts List */}
            <div className="w-64 shrink-0 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Scripts</h3>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCreateScript}
                        className="h-7 text-xs"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        New
                    </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'thin' }}>
                    {scripts.map((script) => (
                        <motion.div
                            key={script.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02 }}
                            className={cn(
                                "p-3 rounded-lg border cursor-pointer transition-all",
                                selectedScript?.id === script.id 
                                    ? "border-primary bg-primary/5" 
                                    : "border-border hover:border-primary/40"
                            )}
                            onClick={() => handleSelectScript(script)}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{script.title}</p>
                                    <Badge variant="outline" className="text-xs mt-1">
                                        {scriptTypes.find(t => t.value === script.type)?.label || script.type}
                                    </Badge>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteScript(script.id);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(script.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
            
            {/* Script Editor */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
                {!selectedScript && !isCreating ? (
                    <Card className="flex-1 flex items-center justify-center">
                        <CardContent className="text-center">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">Select a script or create a new one</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="flex-1 flex flex-col min-h-0">
                        <CardHeader className="p-4 border-b border-border shrink-0">
                            <div className="flex items-center justify-between">
                                {isCreating ? (
                                    <div className="flex-1 flex items-center gap-3">
                                        <Input
                                            placeholder="Script title..."
                                            value={newScriptTitle}
                                            onChange={(e) => setNewScriptTitle(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Select value={newScriptType} onValueChange={setNewScriptType}>
                                            <SelectTrigger className="w-[150px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {scriptTypes.map(type => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : selectedScript ? (
                                    <div className="flex items-center gap-3 flex-1">
                                        <CardTitle className="text-base">{selectedScript.title}</CardTitle>
                                        <Badge variant="outline">
                                            {scriptTypes.find(t => t.value === selectedScript.type)?.label}
                                        </Badge>
                                    </div>
                                ) : null}
                                
                                <div className="flex items-center gap-2">
                                    {isCreating ? (
                                        <Button
                                            size="sm"
                                            onClick={handleSaveNewScript}
                                            disabled={!newScriptTitle.trim()}
                                        >
                                            <Save className="h-4 w-4 mr-1" />
                                            Create
                                        </Button>
                                    ) : selectedScript && !isEditing ? (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleEditScript}
                                            >
                                                <Edit className="h-4 w-4 mr-1" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    if (selectedScript) {
                                                        openOverlay('teleprompter', selectedScript.content, selectedScript.title);
                                                    }
                                                }}
                                            >
                                                <FileText className="h-4 w-4 mr-1" />
                                                Use in Overlay
                                            </Button>
                                        </>
                                    ) : selectedScript && isEditing ? (
                                        <Button
                                            size="sm"
                                            onClick={handleSaveScript}
                                        >
                                            <Save className="h-4 w-4 mr-1" />
                                            Save
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-hidden">
                            {isEditing || isCreating ? (
                                <div className="flex-1 flex flex-col gap-3 min-h-0">
                                    <Textarea
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        placeholder="Write your script here. Use double line breaks to create blocks..."
                                        className="flex-1 min-h-[200px] font-mono text-sm"
                                    />
                                    
                                    {/* AI Actions */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                                        <Label className="text-xs text-muted-foreground">AI Actions:</Label>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7"
                                            onClick={() => handleAIAction('generate')}
                                        >
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Generate from bullets
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7"
                                            onClick={() => handleAIAction('shorten')}
                                        >
                                            <Clock className="h-3 w-3 mr-1" />
                                            Shorten to 2 min
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7"
                                            onClick={() => handleAIAction('diplomatic')}
                                        >
                                            <MessageSquare className="h-3 w-3 mr-1" />
                                            Make diplomatic
                                        </Button>
                                    </div>
                                </div>
                            ) : selectedScript ? (
                                <div className="flex-1 overflow-y-auto space-y-3" style={{ scrollbarWidth: 'thin' }}>
                                    {selectedScript.blocks.map((block, idx) => (
                                        <motion.div
                                            key={block.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={cn(
                                                "p-3 rounded-lg border",
                                                block.isKeyPoint 
                                                    ? "border-primary bg-primary/5" 
                                                    : "border-border"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm leading-relaxed flex-1">{block.text}</p>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-6 w-6 p-0 shrink-0",
                                                        block.isKeyPoint && "text-primary"
                                                    )}
                                                    onClick={() => handleToggleKeyPoint(block.id)}
                                                >
                                                    <Zap className={cn(
                                                        "h-3 w-3",
                                                        block.isKeyPoint && "fill-primary"
                                                    )} />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

