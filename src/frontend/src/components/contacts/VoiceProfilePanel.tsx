
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, UploadCloud, Trash2, Activity, ShieldCheck, ShieldAlert, FileAudio } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { VoiceEnrollmentDialog } from "./VoiceEnrollmentDialog";

interface VoiceProfilePanelProps {
    contactId: string;
    contactName: string;
}

export function VoiceProfilePanel({ contactId, contactName }: VoiceProfilePanelProps) {
    const [status, setStatus] = useState<any>(null);
    const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Check status
    const loadStatus = async () => {
        try {
            const res = await fetch(`/api/voice-profiles/${contactId}/status`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (e) {
            console.error("Failed to load status", e);
        }
    };

    useEffect(() => {
        loadStatus();
    }, [contactId]);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this voice profile?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/voice-profiles/${contactId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            toast.success("Voice profile deleted");
            loadStatus();
        } catch (e) {
            toast.error("Failed to delete profile");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Status Card */}
                <Card className="col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-indigo-500" />
                                    Voice Profile Status
                                </CardTitle>
                                <CardDescription>
                                    Current state of voice identification for {contactName}
                                </CardDescription>
                            </div>
                            {status?.has_profile ? (
                                <Badge variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-900/50 px-3 py-1">
                                    <ShieldCheck className="h-3 w-3 mr-2" />
                                    Active
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-zinc-800/50 text-zinc-500 border-zinc-700/50 px-3 py-1">
                                    <ShieldAlert className="h-3 w-3 mr-2" />
                                    Not Enrolled
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {status?.has_profile ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Audio</p>
                                        <p className="text-2xl font-mono text-zinc-200">
                                            {status.stats?.total_duration_ms
                                                ? `${(status.stats.total_duration_ms / 1000).toFixed(1)}s`
                                                : '0s'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Words Detected</p>
                                        <p className="text-2xl font-mono text-zinc-200">
                                            {status.stats?.total_words || 0}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reliability</p>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-2xl font-mono ${status.stats?.reliability_color || 'text-zinc-200'}`}>
                                                {status.stats?.reliability_score || 0}%
                                            </p>
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 ml-auto">
                                                {status.stats?.reliability_label || 'Low'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Embedding</p>
                                        <p className="text-2xl font-mono text-zinc-200">{status.embedding_dim || 192}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-indigo-950/20 rounded border border-indigo-900/30 text-sm text-indigo-200">
                                    <Activity className="h-4 w-4" />
                                    This profile is being used for real-time speaker identification in meetings.
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center space-y-4">
                                <div className="mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                    <Mic className="h-6 w-6 text-zinc-500" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-medium text-zinc-200">No Voice Profile Detected</h3>
                                    <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                                        Enroll a voice profile to enable speaker identification during meetings.
                                    </p>
                                </div>
                                <Button onClick={() => setIsEnrollmentOpen(true)}>
                                    Enroll Voice Profile
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Actions Card */}
                {status?.has_profile && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => setIsEnrollmentOpen(true)}
                            >
                                <UploadCloud className="h-4 w-4 mr-2" />
                                Improve Profile / Re-enroll
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/20"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isDeleting ? "Deleting..." : "Delete Profile"}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Voice Samples Library */}
                {status?.has_profile && status?.samples && status.samples.length > 0 && (
                    <Card className="col-span-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileAudio className="h-5 w-5 text-indigo-500" />
                                Voice Samples Library
                            </CardTitle>
                            <CardDescription>
                                Manage recorded voice samples stored in Google Drive
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 md:grid-cols-2">
                                {status.samples.map((sample: any) => (
                                    <div key={sample.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-8 w-8 min-w-[2rem] rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                <Mic className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-zinc-200 truncate">
                                                    Enrollment Sample
                                                </p>
                                                <p className="text-xs text-zinc-500 truncate">
                                                    {new Date(sample.created_at).toLocaleDateString()} • {sample.duration_ms ? `${(sample.duration_ms / 1000).toFixed(1)}s` : 'Audio'} • {sample.word_count || 0} words
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <audio
                                                controls
                                                src={`/api/voice-profiles/${contactId}/audio/${sample.id}`}
                                                className="h-8 w-32"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={async () => {
                                                    if (!confirm("Delete this sample?")) return;
                                                    try {
                                                        const res = await fetch(`/api/voice-profiles/${contactId}/audio/${sample.id}`, { method: 'DELETE' });
                                                        if (res.ok) {
                                                            toast.success("Sample deleted");
                                                            loadStatus();
                                                        } else {
                                                            throw new Error();
                                                        }
                                                    } catch (e) {
                                                        toast.error("Failed to delete sample");
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <VoiceEnrollmentDialog
                isOpen={isEnrollmentOpen}
                onClose={() => {
                    setIsEnrollmentOpen(false);
                    loadStatus();
                }}
                contact={{ id: contactId, name: contactName } as any}
            />
        </div>
    );
}
