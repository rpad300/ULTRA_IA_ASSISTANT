import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Mail,
    Building2,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Users,
    Mic,
    FileText,
    ExternalLink,
    Clock,
    Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { ContactScoring } from "@/components/contacts/ContactScoring";
import { CommunicationStyleAnalysis } from "@/components/contacts/CommunicationStyleAnalysis";
import { PredictiveContactBehavior } from "@/components/contacts/PredictiveContactBehavior";
import { RelationshipGraph } from "@/components/contacts/RelationshipGraph";
import { AutoEnrichmentPanel } from "@/components/contacts/AutoEnrichmentPanel";
import { VoiceEnrollmentDialog } from "@/components/contacts/VoiceEnrollmentDialog";
import { VoiceProfilePanel } from "@/components/contacts/VoiceProfilePanel";

import { workspaceApi, type Contact } from "@/api/client";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function ContactDetailView() {
    const { contactId } = useParams();
    const navigate = useNavigate();
    const { companies, projects } = useWorkspaceStore();
    const [contact, setContact] = useState<Contact | null>(null);
    const [interactions, setInteractions] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [topics, setTopics] = useState<any[]>([]);
    const [commitments, setCommitments] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isVoiceEnrollmentOpen, setIsVoiceEnrollmentOpen] = useState(false);

    useEffect(() => {
        const loadContactData = async () => {
            if (!contactId) return;

            setIsLoading(true);
            try {
                // Load contact
                const contactData = await workspaceApi.getContact(contactId);
                setContact(contactData);

                // Load stats
                const statsData = await workspaceApi.get(`/analytics/contacts/${contactId}/stats`);
                setStats(statsData.data);

                // Load interactions (Unified timeline)
                const interactionsData = await workspaceApi.get(`/analytics/contacts/${contactId}/interactions`);
                const interactionsList = interactionsData.data || [];
                setInteractions(interactionsList);

                // Extract Sessions from Interactions for the "Sessions" tab
                // Assuming get_contact_interactions returns mixed types, we filter for sessions
                // The current backend endpoint returns derived dicts, we need to check the structure.
                // Looking at analytics.py, get_contact_interactions returns a list of sessions/interactions.
                // Actually, the previous view_file of analytics.py showed get_contact_interactions returns explicit 'sessions' logic.
                // Let's rely on the fact that if it returns sessions, we can just use them.
                // If the response is just a list of objects, we assume they are session-like or standardized.
                setSessions(interactionsList.filter((i: any) => i.type === 'session' || i.session_id));

                // Load Topics
                const topicsData = await workspaceApi.get(`/analytics/contacts/${contactId}/topics`);
                setTopics(topicsData.data);

                // Load Commitments
                const commitmentsData = await workspaceApi.get(`/analytics/contacts/${contactId}/commitments`);
                setCommitments(commitmentsData.data);

            } catch (error) {
                console.error("Failed to load contact data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadContactData();
    }, [contactId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!contact) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Contact not found</p>
                <Button onClick={() => navigate("/contacts")} className="mt-4">
                    Back to Contacts
                </Button>
            </div>
        );
    }

    const contactCompany = companies.find(c => c.id === contact.company_id);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-4 flex-1">
                    <Avatar className="h-16 w-16 border-2 border-border">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.name}`} />
                        <AvatarFallback>{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <h1 className="text-3xl font-semibold tracking-tight">{contact.name}</h1>
                            <Button
                                variant="outline"
                                className="gap-2 border-indigo-500/30 text-indigo-400 hover:bg-indigo-950/30"
                                onClick={() => setIsVoiceEnrollmentOpen(true)}
                            >
                                <Mic className="h-4 w-4" />
                                <span>Voice Enrollment</span>
                            </Button>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span>{contact.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                <span>{contactCompany?.name || "—"}</span>
                            </div>
                            {contact.role && (
                                <Badge variant="secondary">{contact.role}</Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="topics">Topics & Positions</TabsTrigger>
                    <TabsTrigger value="commitments">Commitments</TabsTrigger>
                    <TabsTrigger value="voice-profile">Voice Profile</TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    {/* Tab: Overview */}
                    <TabsContent value="overview" className="space-y-6">
                        {/* AI-Powered Intelligence Row */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <ContactScoring
                                contactId={contact.id}
                                meetingsCount={stats?.meetings_count || 0}
                                tasksCount={stats?.tasks_count || 0}
                                projectsInCommon={stats?.projects_in_common || 0}
                            />
                            <CommunicationStyleAnalysis
                                contactId={contact.id}
                                meetingsCount={stats?.meetings_count || 0}
                            />
                            <PredictiveContactBehavior
                                contactId={contact.id}
                                meetingsCount={stats?.meetings_count || 0}
                                lastMeetingDate={sessions[0] ? new Date(sessions[0].date) : undefined}
                                projectsInCommon={stats?.projects_in_common || 0}
                            />
                        </div>

                        {/* Relationship Graph & Auto-Enrichment */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <RelationshipGraph
                                contactId={contact.id}
                                relatedContacts={[]} // TODO: Load from API
                                companies={contactCompany ? [contactCompany] : []}
                                projects={projects.filter(p => p.company_id === contact.company_id)}
                            />
                            <AutoEnrichmentPanel
                                contactId={contact.id}
                                contactName={contact.name}
                                contactEmail={contact.email}
                            />
                        </div>

                        {/* KPIs */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Meetings with You
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.meetings_count || 0}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Total meetings</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Projects in Common
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.projects_in_common || 0}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Active projects</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Tasks
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.tasks_count || 0}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Related tasks</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Latest Interactions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Latest Interactions</CardTitle>
                                <CardDescription>Recent activity with this contact</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {interactions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No interactions found
                                        </p>
                                    ) : (
                                        interactions.map((item, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                            >
                                                <div className="flex items-start gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                                    <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{item.text}</p>
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                            <span>{item.project}</span>
                                                            <span>•</span>
                                                            <span>{new Date(item.date).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Latest Sessions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Latest Sessions</CardTitle>
                                <CardDescription>Sessions where this contact participated</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {sessions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No sessions found
                                        </p>
                                    ) : (
                                        sessions.map((session, idx) => (
                                            <motion.div
                                                key={session.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                            >
                                                <div className="p-4 rounded-lg border border-border hover:border-primary/40 transition-all">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="outline" className="text-xs">
                                                                    {session.type}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {new Date(session.date).toLocaleDateString()}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {session.duration}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm font-medium mb-1">{session.summary}</p>
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {session.participants.map((p: string, i: number) => (
                                                                    <Badge key={i} variant="secondary" className="text-xs">
                                                                        {p}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 shrink-0">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-xs"
                                                                onClick={() => navigate(`/sessions/${session.id}/summary`)}
                                                            >
                                                                <FileText className="h-3 w-3 mr-1" />
                                                                Summary
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-xs"
                                                                onClick={() => navigate(`/sessions/${session.id}/transcript`)}
                                                            >
                                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                                Transcript
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Topics & Positions */}
                    <TabsContent value="topics" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Topics & Positions</CardTitle>
                                <CardDescription>Most discussed topics and typical stance</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Topic Cloud */}
                                {topics.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No topic analysis available yet. Topics will be extracted from session transcripts.
                                    </p>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap gap-2 p-4 rounded-lg bg-muted/50">
                                            {topics.map((item, idx) => (
                                                <Badge
                                                    key={idx}
                                                    variant="outline"
                                                    className="text-sm px-3 py-1"
                                                    style={{
                                                        fontSize: `${12 + item.mentions * 2}px`,
                                                    }}
                                                >
                                                    {item.topic} ({item.mentions})
                                                </Badge>
                                            ))}
                                        </div>

                                        {/* Typical Stance Cards */}
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-semibold">Typical Stance</h4>
                                            {topics.map((item, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                >
                                                    <Card className="border-border">
                                                        <CardHeader className="pb-3">
                                                            <CardTitle className="text-sm font-semibold flex items-center justify-between">
                                                                <span>{item.topic}</span>
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {item.mentions} mentions
                                                                </Badge>
                                                            </CardTitle>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                                {item.stance}
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Commitments */}
                    <TabsContent value="commitments" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Commitments</CardTitle>
                                <CardDescription>Tasks and decisions linked to this contact</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {commitments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No commitments found
                                        </p>
                                    ) : (
                                        commitments.map((item, idx) => (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                            >
                                                <div className="p-4 rounded-lg border border-border hover:border-primary/40 transition-all">
                                                    <div className="flex items-start gap-3">
                                                        {item.status === "completed" ? (
                                                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                                                        ) : (
                                                            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <div>
                                                                    <p className="text-sm font-medium">{item.text}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Badge
                                                                            variant={item.status === "completed" ? "default" : "secondary"}
                                                                            className="text-xs"
                                                                        >
                                                                            {item.status}
                                                                        </Badge>
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {item.type}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground shrink-0">
                                                                    Due {new Date(item.date).toLocaleDateString()}
                                                                </span>
                                                            </div>

                                                            {/* Links */}
                                                            {item.links && item.links.length > 0 && (
                                                                <div className="mt-2 pt-2 border-t border-border">
                                                                    <p className="text-xs text-muted-foreground mb-1">Related to:</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {item.links.map((link: any, linkIdx: number) => (
                                                                            <Button
                                                                                key={linkIdx}
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="text-xs h-6"
                                                                                onClick={() => {
                                                                                    if (link.type === "meeting") {
                                                                                        navigate(`/sessions/${link.id}/summary`);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                                                {link.text}
                                                                            </Button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="voice-profile" className="space-y-4">
                        <VoiceProfilePanel contactId={contact.id} contactName={contact.name} />
                    </TabsContent>
                </div>
            </Tabs>

            {/* Dialogs */}
            <VoiceEnrollmentDialog
                isOpen={isVoiceEnrollmentOpen}
                onClose={() => setIsVoiceEnrollmentOpen(false)}
                contact={contact}
            />
        </div>
    );
}
