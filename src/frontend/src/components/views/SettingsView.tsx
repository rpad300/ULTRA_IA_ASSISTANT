import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Key, Database, Cloud, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { useTheme } from "@/contexts/ThemeContext";
import { audioServiceApi } from "@/api/client";
import { useMeetingStore } from "@/store/meetingStore";
import { AICommandCenter } from "@/components/admin/AICommandCenter";

export function SettingsView() {
    const { theme, setTheme } = useTheme();
    const [isSaving, setIsSaving] = useState(false);
    const { sessionId } = useMeetingStore();
    const [useAssemblyAI, setUseAssemblyAI] = useState(true);

    const handleTranscriptionToggle = async (checked: boolean) => {
        setUseAssemblyAI(checked);
        const service = checked ? 'assemblyai' : 'whisper';

        // Save to local storage for persistence across reloads (optional but good UX)
        localStorage.setItem('transcription_preference', service);

        try {
            // ALWAYS update global preference
            await audioServiceApi.setTranscriptionPreference('global', service);
            console.log(`Global transcription preference set to: ${service}`);

            // If active session, update it too
            if (sessionId) {
                await audioServiceApi.setTranscriptionPreference(sessionId, service);
                console.log(`Session ${sessionId} transcription preference set to: ${service}`);
            }
        } catch (error) {
            console.error("Failed to set transcription preference:", error);
        }
    };

    // Load initial state
    useEffect(() => {
        const pref = localStorage.getItem('transcription_preference');
        if (pref === 'whisper') {
            setUseAssemblyAI(false);
        }
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000);
    };

    return (
        <div className="space-y-8 w-full pb-10">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage your preferences, API keys, and device configurations.
                </p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-7 lg:w-[700px] overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="brain">Brain (SOTA)</TabsTrigger>
                    <TabsTrigger value="ai">Keys</TabsTrigger>
                    <TabsTrigger value="audio">Audio</TabsTrigger>
                    <TabsTrigger value="stealth">Stealth</TabsTrigger>
                    <TabsTrigger value="integrations">Integrations</TabsTrigger>
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="hotkeys">Hotkeys</TabsTrigger>
                </TabsList>

                <div className="mt-6 space-y-6">
                    {/* General Tab */}
                    <TabsContent value="general" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Appearance</CardTitle>
                                <CardDescription>Customize how Ultra Assistant looks on your device.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Theme</Label>
                                        <p className="text-sm text-muted-foreground">
                                            {theme === "dark" ? "Dark mode (Recommended)" : "Light mode"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={theme === "light" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setTheme("light")}
                                        >
                                            Light
                                        </Button>
                                        <Button
                                            variant={theme === "dark" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setTheme("dark")}
                                        >
                                            Dark
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Compact Mode</Label>
                                        <p className="text-sm text-muted-foreground">Reduce spacing in chat lists.</p>
                                    </div>
                                    <Switch />
                                </div>
                                <div className="space-y-2">
                                    <Label>Language</Label>
                                    <Select defaultValue="en">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en">English</SelectItem>
                                            <SelectItem value="pt">Português</SelectItem>
                                            <SelectItem value="es">Español</SelectItem>
                                            <SelectItem value="fr">Français</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Intensity Level</Label>
                                    <Select defaultValue="balanced">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="minimal">Minimal - Essential features only</SelectItem>
                                            <SelectItem value="balanced">Balanced - Recommended</SelectItem>
                                            <SelectItem value="detailed">Detailed - All insights and suggestions</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Controls how many AI insights and suggestions you see
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Stealth Tab */}
                    <TabsContent value="stealth" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stealth Mode</CardTitle>
                                <CardDescription>Control overlay behavior during screen sharing and recordings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Auto-Hide Overlay</Label>
                                        <p className="text-sm text-muted-foreground">Automatically hide overlay when screen sharing is detected.</p>
                                    </div>
                                    <Switch checked={true} />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Hide in Recordings</Label>
                                        <p className="text-sm text-muted-foreground">Hide overlay when recording software is active.</p>
                                    </div>
                                    <Switch checked={true} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Detection Methods</Label>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Switch checked={true} />
                                            <span className="text-sm">Detect screen sharing (macOS/Windows)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch checked={true} />
                                            <span className="text-sm">Detect recording apps (OBS, Zoom, etc.)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch checked={false} />
                                            <span className="text-sm">Manual toggle only</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Brain Tab (Agent 6) */}
                    <TabsContent value="brain" className="space-y-6">
                        <AICommandCenter />
                    </TabsContent>

                    {/* AI Models Tab (Existing) - Renaming trigger to 'keys' conceptually or just keeping it */}
                    <TabsContent value="ai" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>LLM Keys & Access</CardTitle>
                                <CardDescription>Manage keys for Gemini, OpenAI, or Anthropic.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Gemini API Key (Primary)</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input className="pl-9 font-mono" type="password" placeholder="AIzaSy..." defaultValue="AIzaSy...****************" />
                                        </div>
                                        <Button variant="outline">Update</Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Used for reasoning and chat.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Audio Tab */}
                    <TabsContent value="audio" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Voice & Transcription</CardTitle>
                                <CardDescription>Configure input devices and STT providers.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Microphone Input</Label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                        <option>Default - MacBook Pro Microphone</option>
                                        <option>External - Blue Yeti</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">AssemblyAI Realtime</Label>
                                        <p className="text-sm text-muted-foreground">Use AssemblyAI for live transcription. Turn off for Local Whisper.</p>
                                    </div>
                                    <Switch
                                        checked={useAssemblyAI}
                                        onCheckedChange={handleTranscriptionToggle}
                                    />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Local Recording Backup</Label>
                                        <p className="text-sm text-muted-foreground">Always record locally as fallback.</p>
                                    </div>
                                    <Switch checked={true} />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Integrations Tab */}
                    <TabsContent value="integrations" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>AI Services</CardTitle>
                                <CardDescription>Status of AI providers and services.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="flex items-center gap-3">
                                        <Database className="h-5 w-5 text-primary" />
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Supabase</Label>
                                            <p className="text-sm text-muted-foreground">Database connection</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Connected
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="flex items-center gap-3">
                                        <Cloud className="h-5 w-5 text-primary" />
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Qdrant</Label>
                                            <p className="text-sm text-muted-foreground">Vector database for context search</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Connected
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Google Workspace</CardTitle>
                                <CardDescription>Connect Drive, Gmail, and Calendar.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Google Drive</Label>
                                        <p className="text-sm text-muted-foreground">Sync transcripts and summaries.</p>
                                    </div>
                                    <Button variant="outline" size="sm">Connect</Button>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Google Calendar</Label>
                                        <p className="text-sm text-muted-foreground">Auto-create meeting threads.</p>
                                    </div>
                                    <Button variant="outline" size="sm">Connect</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Company Settings Tab */}
                    <TabsContent value="company" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Company Settings</CardTitle>
                                <CardDescription>Configure settings per company.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Select Company</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a company..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="acme">Acme Corp</SelectItem>
                                            <SelectItem value="techstart">TechStart</SelectItem>
                                            <SelectItem value="global">Global Inc</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Default Profile</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select default profile..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ba">Business Analyst</SelectItem>
                                            <SelectItem value="po">Product Owner</SelectItem>
                                            <SelectItem value="pm">Project Manager</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Auto-create Threads</Label>
                                        <p className="text-sm text-muted-foreground">Automatically create threads from calendar events.</p>
                                    </div>
                                    <Switch />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Hotkeys Tab */}
                    <TabsContent value="hotkeys" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Keyboard Shortcuts</CardTitle>
                                <CardDescription>Customize hotkeys for quick actions.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    {[
                                        { action: "Command Palette", key: "⌘K" },
                                        { action: "Start Meeting", key: "⌘M" },
                                        { action: "Toggle Overlay", key: "⌘O" },
                                        { action: "Teleprompter", key: "⌘T" },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                            <span className="text-sm">{item.action}</span>
                                            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{item.key}</kbd>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </div>
            </Tabs>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} className="min-w-[100px]">
                    {isSaving ? <Check className="mr-2 h-4 w-4" /> : "Save Changes"}
                </Button>
            </div>
        </div>
    );
}

