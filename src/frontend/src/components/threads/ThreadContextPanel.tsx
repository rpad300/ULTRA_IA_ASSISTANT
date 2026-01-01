
import { useState, useCallback, memo, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Calendar, Clock, Users, Paperclip, File, Mail, Upload, ExternalLink, Edit2, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

import { useNavigate } from "react-router-dom";
import { workspaceApi } from "@/api/client";

type TabType = "sessions" | "attachments" | "notes";

interface ThreadContextPanelProps {
    threadId: string;
}

// Memoized Session Card with Rich Timeline Layout
const SessionCard = memo(({
    session,
    getSessionTypeLabel,
    onOpenSummary,
    onOpenTranscript,
    onDelete
}: {
    session: any;
    getSessionTypeLabel: (type: string) => string;
    onOpenSummary: (sessionId: string) => void;
    onOpenTranscript: (sessionId: string) => void;
    onDelete: (sessionId: string) => void;
}) => {
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (isConfirming) {
            const timer = setTimeout(() => setIsConfirming(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isConfirming]);

    return (
        <div className="relative pl-8 pb-6">
            {/* Timeline Line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline Dot */}
            <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />

            {/* Card */}
            <Card className="border-border hover:border-primary/40 transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
                <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                                {session.date.toLocaleDateString('pt-PT', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                })} {session.date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                            {getSessionTypeLabel(session.type)}
                        </Badge>
                    </div>

                    {/* Summary Line */}
                    {session.summary && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {session.summary}
                        </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.duration}
                        </span>
                        <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {session.participants.length} participantes
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                        {session.participants.slice(0, 3).map((p: string, idx: number) => (
                            <span key={idx} className="text-xs px-2 py-0.5 rounded bg-muted">
                                {p.split(' ')[0]}
                            </span>
                        ))}
                        {session.participants.length > 3 && (
                            <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                +{session.participants.length - 3}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2 items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs hover:bg-primary/10 hover:border-primary/40 transition-colors"
                            onClick={() => onOpenSummary(session.id)}
                        >
                            <FileText className="h-3 w-3 mr-1" />
                            Resumo
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs hover:bg-primary/10 hover:border-primary/40 transition-colors"
                            onClick={() => onOpenTranscript(session.id)}
                        >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Transcrição
                        </Button>
                        {isConfirming ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 animate-in fade-in zoom-in duration-200"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(session.id);
                                    setIsConfirming(false);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Confirmar
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsConfirming(true);
                                }}
                                title="Apagar Sessão"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
});

SessionCard.displayName = "SessionCard";

// Memoized Attachment Card
const AttachmentCard = memo(({ attachment, getAttachmentIcon }: { attachment: any; getAttachmentIcon: (type: string) => ReactNode }) => (
    <Card key={attachment.id} className="border-border hover:border-primary/40 transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
        <CardContent className="p-3">
            <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {getAttachmentIcon(attachment.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                            {attachment.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {attachment.source === "Drive" ? (
                                <Paperclip className="h-3 w-3" />
                            ) : (
                                <Upload className="h-3 w-3" />
                            )}
                            {attachment.source}
                        </span>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
));

AttachmentCard.displayName = "AttachmentCard";

// Memoized Note Card
const NoteCard = memo(({ note, onDelete }: { note: any; onDelete: (id: string) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(note.content);


    const handleSave = useCallback(() => {
        // TODO: Save via API
        toast.success("Note updated");
        setIsEditing(false);
    }, []);

    return (
        <Card key={note.id} className="border-border hover:border-primary/40 transition-all hover:shadow-md group animate-in fade-in slide-in-from-bottom-2">
            <CardContent className="p-3">
                {isEditing ? (
                    <div className="space-y-2">
                        <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={2}
                            className="text-sm"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                                setIsEditing(false);
                                setEditContent(note.content);
                            }}>Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-sm">{note.content}</p>
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">
                                {note.createdAt.toLocaleDateString()} {note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setIsEditing(true)}
                                    title="Edit note"
                                >
                                    <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => {
                                        if (confirm("Delete this note?")) {
                                            onDelete(note.id);
                                        }
                                    }}
                                    title="Delete note"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
});

NoteCard.displayName = "NoteCard";

export function ThreadContextPanel({ threadId }: ThreadContextPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>("sessions");
    const [newNote, setNewNote] = useState("");
    const [notes, setNotes] = useState([
        { id: "1", content: "Focus on budget constraints", createdAt: new Date("2024-01-15T09:00:00") },
        { id: "2", content: "Alice prefers morning meetings", createdAt: new Date("2024-01-15T10:30:00") },
    ]);

    const navigate = useNavigate();
    const [sessions, setSessions] = useState<any[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);

    // Load real sessions for this thread
    useEffect(() => {
        const loadSessions = async () => {
            if (!threadId) {
                setIsLoadingSessions(false);
                return;
            }

            setIsLoadingSessions(true);
            try {
                const res = await workspaceApi.get(`/threads/${threadId}/sessions`);
                const sessionsData = res.data || [];
                // Format sessions for display
                const formatted = sessionsData.map((s: any) => ({
                    id: s.id,
                    type: s.type || "meeting",
                    date: s.started_at ? new Date(s.started_at) : new Date(s.created_at),
                    duration: s.duration || (s.started_at && s.ended_at
                        ? `${Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)}m`
                        : "—"),
                    participants: [], // TODO: Load from session_speakers
                    summary: s.summary || null
                }));
                setSessions(formatted);
            } catch (error) {
                console.error("Failed to load sessions:", error);
                setSessions([]);
            } finally {
                setIsLoadingSessions(false);
            }
        };

        loadSessions();
    }, [threadId]);

    const handleOpenSummary = useCallback((sessionId: string) => {
        navigate(`/sessions/${sessionId}/summary`);
    }, [navigate]);

    const handleOpenTranscript = useCallback((sessionId: string) => {
        navigate(`/sessions/${sessionId}/transcript`);
    }, [navigate]);

    const [attachments] = useState<any[]>([]);
    // TODO: Implement attachments loading from API when endpoint is available

    const getSessionTypeLabel = useCallback((type: string) => {
        const labels: Record<string, string> = {
            prep_meeting: "Prep Meeting",
            main_meeting: "Main Meeting",
            follow_up: "Follow-up",
            focus_block: "Focus Block",
        };
        return labels[type] || type;
    }, []);

    const getAttachmentIcon = useCallback((type: string) => {
        switch (type) {
            case "doc":
                return <File className="h-4 w-4" />;
            case "email":
                return <Mail className="h-4 w-4" />;
            default:
                return <FileText className="h-4 w-4" />;
        }
    }, []);

    const handleAddNote = useCallback(() => {
        if (!newNote.trim()) return;
        const newNoteObj = {
            id: Date.now().toString(),
            content: newNote,
            createdAt: new Date(),
        };
        setNotes(prev => [newNoteObj, ...prev]);
        toast.success("Note added");
        setNewNote("");
    }, [newNote]);

    const handleDeleteNote = useCallback((id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        toast.success("Note deleted");
    }, []);

    const handleDeleteSession = useCallback(async (sessionId: string) => {
        // Confirmation is now handled in the UI component

        try {
            await workspaceApi.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            toast.success("Sessão apagada com sucesso");
        } catch (error) {
            console.error("Failed to delete session:", error);
            toast.error("Erro ao apagar sessão");
        }
    }, []);

    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Tabs with smooth transition */}
            <div className="border-b border-border bg-card/50 backdrop-blur-sm">
                <div className="flex relative">
                    <div
                        className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ease-out"
                        style={{
                            width: `${100 / 3}%`,
                            transform: `translateX(${activeTab === "sessions" ? 0 : activeTab === "attachments" ? 100 : 200}%)`
                        }}
                    />
                    <button
                        onClick={() => setActiveTab("sessions")}
                        className={cn(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors relative z-10",
                            activeTab === "sessions"
                                ? "text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Sessions
                    </button>
                    <button
                        onClick={() => setActiveTab("attachments")}
                        className={cn(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors relative z-10",
                            activeTab === "attachments"
                                ? "text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Attachments
                    </button>
                    <button
                        onClick={() => setActiveTab("notes")}
                        className={cn(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors relative z-10",
                            activeTab === "notes"
                                ? "text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Notes
                    </button>
                </div>
            </div>

            {/* Tab Content with fade transition */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className={cn(
                    "transition-opacity duration-300",
                    activeTab === "sessions" ? "opacity-100" : "opacity-0 absolute"
                )}>
                    {activeTab === "sessions" && (
                        <div className="space-y-3">
                            {isLoadingSessions ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : sessions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm animate-in fade-in">
                                    No sessions yet
                                </div>
                            ) : (
                                sessions.map((session) => (
                                    <SessionCard
                                        key={session.id}
                                        session={session}
                                        getSessionTypeLabel={getSessionTypeLabel}
                                        onOpenSummary={handleOpenSummary}
                                        onOpenTranscript={handleOpenTranscript}
                                        onDelete={handleDeleteSession}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className={cn(
                    "transition-opacity duration-300",
                    activeTab === "attachments" ? "opacity-100" : "opacity-0 absolute"
                )}>
                    {activeTab === "attachments" && (
                        <div className="space-y-3">
                            <div className="flex justify-end mb-2 animate-in fade-in slide-in-from-top-2">
                                <Button variant="outline" size="sm" className="text-xs hover:bg-primary/10 hover:border-primary/40 transition-colors">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Attachment
                                </Button>
                            </div>
                            {attachments.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm animate-in fade-in">
                                    No attachments yet
                                </div>
                            ) : (
                                attachments.map((attachment, index) => (
                                    <div key={attachment.id} style={{ animationDelay: `${index * 50}ms` }}>
                                        <AttachmentCard attachment={attachment} getAttachmentIcon={getAttachmentIcon} />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className={cn(
                    "transition-opacity duration-300",
                    activeTab === "notes" ? "opacity-100" : "opacity-0 absolute"
                )}>
                    {activeTab === "notes" && (
                        <div className="space-y-4">
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Textarea
                                    placeholder="Add a quick note..."
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                            e.preventDefault();
                                            handleAddNote();
                                        }
                                    }}
                                    rows={2}
                                    className="text-sm"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleAddNote}
                                    disabled={!newNote.trim()}
                                    className="hover:scale-105 transition-transform"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Note
                                    <kbd className="ml-2 hidden md:inline-flex h-4 px-1 items-center gap-1 rounded border bg-muted px-1 font-mono text-[8px] font-medium opacity-100">
                                        <span className="text-xs">⌘</span>↵
                                    </kbd>
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {notes.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm animate-in fade-in">
                                        No notes yet
                                    </div>
                                ) : (
                                    notes.map((note, index) => (
                                        <div key={note.id} style={{ animationDelay: `${index * 50}ms` }}>
                                            <NoteCard note={note} onDelete={handleDeleteNote} />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
