import { useState, useEffect } from "react";
import {
    Plus,
    Trash2,
    Save,
    Brain,
    Sparkles,
    AlertTriangle,
    Loader2,
    X,
    Book,
    Check,
    Folder,
    File as FileIcon,
    Globe,
    Cloud,
    Edit,
    Play,
    RefreshCw,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { workspaceApi, type Profile, type Project } from "@/api/client";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Sub-component for Chips
const ChipInput = ({ label, items, onAdd, onRemove, icon: Icon }: any) => {
    const [val, setVal] = useState("");
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex gap-2">
                <Input
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    placeholder="Add item..."
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onAdd(val);
                            setVal("");
                        }
                    }}
                />
                <Button onClick={() => { onAdd(val); setVal(""); }} size="icon" variant="secondary"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
                {items && items.map((item: string, i: number) => (
                    <Badge key={i} variant="outline" className="pl-2 pr-1 py-1 gap-1">
                        {Icon && <Icon className="h-3 w-3 opacity-70" />}
                        {item}
                        <div className="cursor-pointer hover:bg-destructive/10 rounded-full p-0.5" onClick={() => onRemove(i)}>
                            <X className="h-3 w-3" />
                        </div>
                    </Badge>
                ))}
            </div>
        </div>
    );
};

export function ProfilesView() {
    // SOTA: Strict Selectors to prevent unnecessary re-renders
    // SOTA: Strict Selectors to prevent unnecessary re-renders
    const selectedCompanyId = useWorkspaceStore(state => state.selectedCompanyId);

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

    // Testing Lab State
    const [testingProfile, setTestingProfile] = useState<string | null>(null);
    const [testInput, setTestInput] = useState("");
    const [testOutput, setTestOutput] = useState("");
    const [isTestLoading, setIsTestLoading] = useState(false);

    const profileTypes = [
        { value: "business_analyst", label: "Business Analyst" },
        { value: "legal_counsel", label: "Legal Counsel" },
        { value: "marketing_strategist", label: "Marketing Strategist" },
        { value: "project_manager", label: "Project Manager" },
        { value: "sales_representative", label: "Sales Representative" },
        { value: "researcher", label: "Researcher" },
        { value: "product_owner", label: "Product Owner" },
        { value: "interviewer", label: "Interviewer" },
        { value: "technical", label: "Technical Architect" }
    ];

    // SOTA: Data Fetching with AbortController for Race Condition Protection
    useEffect(() => {
        if (!selectedCompanyId) {
            setProfiles([]);
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const loadProfiles = async () => {
            setIsLoading(true);
            try {
                // SOTA: Correct API method call
                const data = await workspaceApi.getProfiles(selectedCompanyId);

                if (!signal.aborted) {
                    setProfiles(data);
                }
            } catch (error: any) {
                if (!signal.aborted) {
                    console.error("Failed to load profiles:", error);
                    toast.error(error?.message || "Failed to load agents. Please try again later.");
                }
            } finally {
                if (!signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadProfiles();

        return () => {
            controller.abort();
        };
    }, [selectedCompanyId]);

    const handleProfileCreated = async () => {
        if (selectedCompanyId) {
            try {
                const data = await workspaceApi.getProfiles(selectedCompanyId);
                setProfiles(data);
            } catch (error) {
                console.error("Failed to refresh profiles", error);
            }
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        if (!confirm("Are you sure you want to delete this profile?")) return;
        try {
            await workspaceApi.deleteProfile(profileId);
            setProfiles(prev => prev.filter(p => p.id !== profileId));
            toast.success("The specialist has been removed from your workforce.");
        } catch (error) {
            console.error("Failed to delete profile:", error);
            toast.error("Could not remove the agent. Please try again.");
        }
    };

    const handleTestProfile = (profileId: string) => {
        setTestingProfile(profileId);
        setTestInput("");
        setTestOutput("");
    };

    const generateTestResponse = async (profile: Profile, input: string) => {
        setIsTestLoading(true);
        try {
            // SOTA: Real-time backend preview
            const result = await workspaceApi.previewProfile(profile.id, input, profile.project_id);
            setTestOutput(result.response);

            if (result.system_instruction) {
                console.log("DEBUG: System Prompt Used:", result.system_instruction);
            }
        } catch (error) {
            console.error("Test failed:", error);
            setTestOutput("Error: Failed to connect to Agent Brain. Please ensure the agent is successfully deployed.");
        } finally {
            setIsTestLoading(false);
        }
    };

    if (!selectedCompanyId) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-muted-foreground mb-4">Please select a company to view profiles</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full animate-in fade-in duration-500 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-end border-b border-border/50 pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Brain className="h-8 w-8 text-primary" /> Agent Workforce
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                        Deploy and manage specialized AI agents. Configure their brain, tools, project scope, and knowledge base.
                    </p>
                </div>
                <Dialog open={isCreating} onOpenChange={setIsCreating}>
                    <DialogTrigger asChild>
                        <Button size="lg" className="shadow-lg">
                            <Plus className="mr-2 h-4 w-4" /> Deploy New Specialist
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
                        <div className="px-6 py-4 border-b">
                            <DialogHeader>
                                <DialogTitle>Deploy New Specialist Agent</DialogTitle>
                                <DialogDescription>
                                    Configure the neural architecture for this new profile.
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {selectedCompanyId && (
                                <ProfileForm
                                    onClose={() => setIsCreating(false)}
                                    profileTypes={profileTypes}
                                    companyId={selectedCompanyId}
                                    onProfileCreated={handleProfileCreated}
                                />
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex flex-col space-y-3">
                            <Skeleton className="h-[200px] w-full rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : profiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-muted/10 border-dashed">
                    <div className="p-4 bg-muted rounded-full mb-4"><Brain className="h-8 w-8 text-muted-foreground" /></div>
                    <h3 className="text-lg font-medium">No Agents Deployed</h3>
                    <p className="text-sm text-muted-foreground mb-4">Start by deploying your first specialist agent.</p>
                    <Button variant="outline" onClick={() => setIsCreating(true)}>Deploy Agent</Button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {profiles.map(profile => (
                        <Card key={profile.id} className="group relative flex flex-col gap-4 rounded-lg border p-6 hover:shadow-md transition-all bg-card text-card-foreground">
                            <CardHeader className="p-0 pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary`}>
                                            <Sparkles className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-semibold leading-none tracking-tight">{profile.name}</CardTitle>
                                            <CardDescription className="text-sm text-muted-foreground mt-1 capitalize">{profile.type.replace(/_/g, " ")}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingProfile(profile)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProfile(profile.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-0 flex-1 flex flex-col gap-4">
                                <div className="flex flex-wrap gap-2">
                                    {profile.capabilities?.slice(0, 3).map((cap, i) => (
                                        <Badge key={i} variant="secondary" className="text-[10px]">{cap.replace(/_/g, " ")}</Badge>
                                    ))}
                                    {(profile.capabilities?.length || 0) > 3 && <Badge variant="secondary" className="text-[10px]">+{(profile?.capabilities?.length || 0) - 3}</Badge>}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {profile.knowledge_sources && profile.knowledge_sources.length > 0 && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-blue-500/10 text-blue-500 border-blue-500/20">
                                            <Book className="w-2 h-2 mr-1" /> {profile.knowledge_sources.length} RAG Sources
                                        </Badge>
                                    )}
                                </div>

                                {/* Project Chip */}
                                {profile.project_id && (
                                    <div className="mt-auto pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
                                        <Globe className="h-3 w-3" />
                                        <span>Project Scoped</span>
                                    </div>
                                )}

                                <Button
                                    className="w-full mt-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20"
                                    size="sm"
                                    onClick={() => handleTestProfile(profile.id)}
                                >
                                    <Play className="h-3 w-3 mr-2" /> Enter Testing Lab
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!editingProfile} onOpenChange={(open) => {
                if (!open) {
                    setEditingProfile(null);
                }
            }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col p-0 gap-0">
                    <div className="px-6 py-4 border-b">
                        <DialogHeader>
                            <DialogTitle>Configure Agent</DialogTitle>
                            <DialogDescription>
                                Edit the parameters for {editingProfile?.name}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {selectedCompanyId && (
                            <ProfileForm
                                onClose={() => setEditingProfile(null)}
                                profileTypes={profileTypes}
                                companyId={selectedCompanyId}
                                editingProfile={editingProfile}
                                onProfileCreated={handleProfileCreated}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Testing Lab Modal */}
            <Dialog open={!!testingProfile} onOpenChange={(open) => !open && setTestingProfile(null)}>
                <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="text-primary h-5 w-5" /> Agent Testing Lab
                        </DialogTitle>
                        <DialogDescription>
                            Simulate interactions to verify tone, mission adherence, and tool usage.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 flex flex-col gap-4 min-h-0">
                        <div className="flex-1 bg-muted/30 rounded-lg p-4 border overflow-y-auto font-mono text-sm">
                            {testOutput ? (
                                <div className="whitespace-pre-wrap animate-in fade-in slide-in-from-bottom-2">
                                    {testOutput}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground/50">
                                    Enter a test prompt to activate the simulator...
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Textarea
                                placeholder="E.g. 'Analyze this text for compliance risks...'"
                                value={testInput}
                                onChange={(e) => setTestInput(e.target.value)}
                                className="min-h-[60px]"
                            />
                            <Button
                                className="h-auto px-6"
                                onClick={() => testingProfile && generateTestResponse(profiles.find(p => p.id === testingProfile)!, testInput)}
                                disabled={!testInput || isTestLoading}
                            >
                                {isTestLoading ? <Loader2 className="animate-spin" /> : <Play />}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ProfileForm({
    onClose,
    profileTypes,
    companyId,
    editingProfile,
    onProfileCreated
}: {
    onClose: () => void;
    profileTypes: Array<{ value: string; label: string }>;
    companyId: string;
    editingProfile?: Profile | null;
    onProfileCreated?: () => void;
}) {
    // Identity State
    const [name, setName] = useState(editingProfile?.name || "");
    const [type, setType] = useState(editingProfile?.type || "business_analyst");
    const [projectId, setProjectId] = useState(editingProfile?.project_id || "");

    // Brain State (Instructions)
    const [instructions, setInstructions] = useState<any>(editingProfile?.instructions || {
        role: "",
        mission: "",
        tone: "",
        focus_areas: [],
        forbidden_topics: []
    });

    const [capabilities, setCapabilities] = useState<string[]>(editingProfile?.capabilities || []);
    const [knowledgeSources, setKnowledgeSources] = useState<any[]>(() => {
        const raw = editingProfile?.knowledge_sources || [];
        if (raw.length > 0 && typeof raw[0] === 'string') {
            return raw.map(id => ({ id, name: id, type: 'folder' }));
        }
        return raw;
    });

    const [basePrompt, setBasePrompt] = useState(editingProfile?.base_prompt || "");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Project Fetching
    const [projects, setProjects] = useState<Project[]>([]);
    useEffect(() => {
        if (companyId) {
            workspaceApi.getProjects(companyId).then(setProjects).catch(console.error);
        }
    }, [companyId]);

    const handleInstructionChange = (field: string, value: any) => {
        setInstructions((prev: any) => ({ ...prev, [field]: value }));
    };

    const addListItem = (field: 'focus_areas' | 'forbidden_topics', value: string) => {
        if (!value.trim()) return;
        const list = instructions[field] || [];
        setInstructions((prev: any) => ({ ...prev, [field]: [...list, value] }));
    };

    const removeListItem = (field: 'focus_areas' | 'forbidden_topics', index: number) => {
        const list = instructions[field] || [];
        setInstructions((prev: any) => ({ ...prev, [field]: list.filter((_: any, i: number) => i !== index) }));
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error("Profile name is required");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: any = {
                name: name.trim(),
                type,
                base_prompt: basePrompt.trim() || undefined,
                instructions,
                capabilities,
                knowledge_sources: knowledgeSources,
                project_id: projectId || null
            };

            if (editingProfile) {
                await workspaceApi.updateProfile(editingProfile.id, payload);
                toast.success("Agent configuration updated");
            } else {
                payload.company_id = companyId;
                await workspaceApi.createProfile(payload);
                toast.success("Agent deployed successfully");
            }
            onClose();
            if (onProfileCreated) onProfileCreated();
        } catch (error) {
            console.error("Failed to save profile:", error);
            toast.error("Deployment failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="identity" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                    <TabsTrigger value="identity">Identity</TabsTrigger>
                    <TabsTrigger value="brain">The Brain</TabsTrigger>
                    <TabsTrigger value="tools">Tools & RAG</TabsTrigger>
                    <TabsTrigger value="legacy">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="identity" className="space-y-4 py-4 animate-in slide-in-from-left-2">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Agent Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Legal Guard" />
                        </div>
                        <div className="space-y-2">
                            <Label>Archetype</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                            >
                                {profileTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Project Scope (Context Boundary)</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                        >
                            <option value="">Global / No Scope</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">Limits the agent's knowledge search to this specific project context.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Detailed Role Definition</Label>
                        <Input
                            value={instructions.role || ""}
                            onChange={e => handleInstructionChange("role", e.target.value)}
                            placeholder="You are a Senior Corporate Lawyer specializing in IP..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Mission Statement</Label>
                        <Textarea
                            rows={3}
                            value={instructions.mission || ""}
                            onChange={e => handleInstructionChange("mission", e.target.value)}
                            placeholder="Your primary goal is to identify risks and suggest mitigation strategies..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Tone of Voice</Label>
                        <Input
                            value={instructions.tone || ""}
                            onChange={e => handleInstructionChange("tone", e.target.value)}
                            placeholder="e.g. Formal, Concise, Direct, Empathetic"
                        />
                    </div>
                </TabsContent>

                <TabsContent value="brain" className="space-y-4 py-4 animate-in slide-in-from-right-2">
                    <ChipInput
                        label="Focus Areas"
                        items={instructions.focus_areas}
                        onAdd={(v: string) => addListItem('focus_areas', v)}
                        onRemove={(i: number) => removeListItem('focus_areas', i)}
                        icon={Brain}
                    />
                    <ChipInput
                        label="Forbidden Topics"
                        items={instructions.forbidden_topics}
                        onAdd={(v: string) => addListItem('forbidden_topics', v)}
                        onRemove={(i: number) => removeListItem('forbidden_topics', i)}
                        icon={AlertTriangle}
                    />
                </TabsContent>

                <TabsContent value="tools" className="space-y-4 py-4 animate-in slide-in-from-bottom-2">
                    <div className="bg-muted/30 p-4 rounded-lg border">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Capabilities (Tool Use)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {["extract_action_items", "search_web", "check_compliance", "generate_email_drafts"].map(tool => (
                                <div key={tool} className="flex items-center space-x-2 border p-2 rounded bg-background hover:bg-accent/50 cursor-pointer" onClick={() => {
                                    const exists = capabilities.includes(tool);
                                    if (exists) setCapabilities(prev => prev.filter(c => c !== tool));
                                    else setCapabilities(prev => [...prev, tool]);
                                }}>
                                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${capabilities.includes(tool) ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                                        {capabilities.includes(tool) && <div className="h-2 w-2 bg-primary-foreground rounded-full" />}
                                    </div>
                                    <span className="text-sm font-medium">{tool.replace(/_/g, " ")}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-lg border">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Book className="h-4 w-4" /> Knowledge Linking (RAG)</h4>

                        {projectId ? (
                            <FolderTreeSelector
                                projectId={projectId}
                                selected={knowledgeSources}
                                onSelectionChange={setKnowledgeSources}
                            />
                        ) : (
                            <div className="text-center py-6 border-2 border-dashed rounded-lg bg-background/50">
                                <Globe className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">Select a <strong>Project Scope</strong> in the Identity tab to browse files.</p>
                                <p className="text-xs text-muted-foreground mt-1">Or add a manual Drive ID below.</p>
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t">
                            <Label className="text-xs mb-2 block">Manual Link (Advanced)</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="new-rag"
                                    placeholder="Enter Drive Folder ID manually..."
                                    className="font-mono text-xs"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = (e.currentTarget as HTMLInputElement).value;
                                            if (val) {
                                                setKnowledgeSources(prev => [...prev, { id: val, name: val, type: 'manual' }]);
                                                (e.currentTarget as HTMLInputElement).value = "";
                                            }
                                        }
                                    }}
                                />
                                <Button variant="secondary" size="sm" onClick={() => {
                                    const el = document.getElementById("new-rag") as HTMLInputElement;
                                    if (el?.value) {
                                        setKnowledgeSources(prev => [...prev, { id: el.value, name: el.value, type: 'manual' }]);
                                        el.value = "";
                                    }
                                }}>Add ID</Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="legacy" className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Legacy Base Prompt (Override)</Label>
                        <Textarea
                            placeholder="Raw system prompt override..."
                            rows={8}
                            value={basePrompt}
                            onChange={(e) => setBasePrompt(e.target.value)}
                            className="font-mono text-xs"
                        />
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-between gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[150px]">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> {editingProfile ? "Update Agent" : "Deploy Agent"}
                </Button>
            </div>
        </div>
    );
}

function FolderTreeSelector({ projectId, selected, onSelectionChange }: { projectId: string, selected: any[], onSelectionChange: (val: any[]) => void }) {
    const [nodes, setNodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchTree = (refresh = false) => {
        setLoading(true);
        workspaceApi.getProjectFilesTree(projectId, refresh)
            .then(data => {
                setNodes(data);
            })
            .catch(err => {
                console.error("Failed to load tree", err);
                toast.error("Failed to load project folders");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTree(false);
    }, [projectId]);

    const handleRefresh = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        fetchTree(true);
    };

    const toggleSelection = (node: any) => {
        const isSelected = selected.some(s => s.id === node.id);
        if (isSelected) {
            onSelectionChange(selected.filter(s => s.id !== node.id));
        } else {
            onSelectionChange([...selected, { id: node.id, name: node.name, type: node.type }]);
        }
    };

    // Filter Logic
    const filteredNodes = nodes.filter(n => {
        if (n.type !== 'folder') return false;
        if (!search) return true;
        return n.name.toLowerCase().includes(search.toLowerCase());
    });

    if (loading && !nodes.length) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>;

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                    <Input
                        placeholder="Filter folders..."
                        className="h-8 pl-7 text-xs"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh} title="Fresh Sync from Drive">
                    <RefreshCw className={cn("h-3 w-3", loading ? "animate-spin" : "")} />
                </Button>
            </div>

            <div className="border rounded-md max-h-[250px] min-h-[100px] overflow-y-auto bg-background">
                {filteredNodes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        {search ? "No matching folders." : "No folders found in this project."}
                    </div>
                ) : (
                    filteredNodes.map(node => {
                        const isSelected = selected.some(s => s.id === node.id);
                        return (
                            <div key={node.id} className="flex items-center gap-2 p-2 hover:bg-accent/50 text-sm group transition-colors">
                                <div
                                    className={cn("h-4 w-4 border rounded flex items-center justify-center cursor-pointer transition-colors", isSelected ? "bg-primary border-primary" : "border-muted-foreground")}
                                    onClick={() => toggleSelection(node)}
                                >
                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <Folder className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                                <span className="flex-1 truncate cursor-pointer select-none" onClick={() => toggleSelection(node)}>
                                    {node.name}
                                </span>
                                {isSelected && <Cloud className="h-3 w-3 text-primary animate-pulse" />}
                            </div>
                        );
                    })
                )}

                {/* Files view (only if not searching, to avoid clutter) */}
                {!search && nodes.filter(n => n.type !== 'folder').length > 0 && (
                    <>
                        <div className="p-2 text-xs text-muted-foreground border-t bg-muted/20 sticky bottom-0">Files (Read-only view)</div>
                        {nodes.filter(n => n.type !== 'folder').map(node => (
                            <div key={node.id} className="flex items-center gap-2 p-2 pl-4 text-xs opacity-75">
                                <FileIcon className="h-3 w-3" />
                                <span className="truncate">{node.name}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
