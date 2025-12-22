import { useCallback, memo, useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Mic, ExternalLink, ChevronDown, ChevronUp, Save, User, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore, type Participant } from "@/store/meetingStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceApi } from "@/api/client";
import { toast } from "@/components/ui/toast"; // Fixed import
import { motion, AnimatePresence } from "framer-motion";

// Memoized Participant Card with inline editing
const ParticipantCard = memo(({
    participant,
    onViewContact,
    index
}: {
    participant: Participant;
    onViewContact: (contactId: string) => void;
    index: number;
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "",
        companyId: "",
        phone: ""
    });

    const { contacts, companies, fetchContacts } = useWorkspaceStore();
    const { updateSpeakerName } = useMeetingStore();

    // Initialize form data when expanded
    useEffect(() => {
        if (isExpanded && participant.contactId) {
            const contact = contacts.find(c => c.id === participant.contactId);
            if (contact) {
                setFormData({
                    name: contact.name || participant.name || "",
                    email: contact.email || "",
                    role: contact.role || "",
                    companyId: contact.company_id || "",
                    phone: contact.phone || ""
                });
            } else {
                // Fallback if contact not found in store yet
                setFormData(prev => ({ ...prev, name: participant.name || "" }));
            }
        }
    }, [isExpanded, participant.contactId, contacts, participant.name]);

    const handleSave = async (e: React.FormEvent) => {
        e.stopPropagation();
        if (!participant.contactId) return;

        setIsSaving(true);
        try {
            // Prepare update data
            const updateData: any = {
                name: formData.name,
                email: formData.email || undefined,
                role: formData.role || undefined,
                phone: formData.phone || undefined,
                company_id: formData.companyId || null
            };

            await workspaceApi.updateContact(participant.contactId, updateData);

            // Update Stores
            await fetchContacts(); // Refresh global contact list
            updateSpeakerName(participant.contactId, formData.name); // Immediate UI update for transcript

            setIsExpanded(false);
            toast.success("Contact updated");
        } catch (error) {
            console.error("Failed to update contact:", error);
            toast.error("Failed to update contact");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleExpand = () => {
        // Prevent expanding if clicking on functional buttons inside (handled by stopPropagation usually)
        if (!isExpanded && participant.contactId) {
            setIsExpanded(true);
        } else if (isExpanded) {
            // Allow closing by clicking header? Maybe better to have explicit close.
            // For now, let's keep it explicit via button or clicking header closes it.
            setIsExpanded(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.1 }}
            layout
        >
            <Card
                className={cn(
                    "border-border transition-all overflow-hidden",
                    participant.isSpeaking && "border-primary/40 bg-primary/5 shadow-md",
                    isExpanded && "ring-1 ring-primary/20"
                )}
            >
                <CardContent className="p-0">
                    {/* Header / Summary View */}
                    <div
                        className={cn(
                            "p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors",
                            isExpanded && "bg-muted/30"
                        )}
                        onClick={toggleExpand}
                    >
                        <motion.div
                            className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
                                participant.isSpeaking
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                            )}
                            animate={participant.isSpeaking ? {
                                scale: [1, 1.1, 1],
                            } : {}}
                            transition={{
                                duration: 1.5,
                                repeat: participant.isSpeaking ? Infinity : 0,
                                ease: "easeInOut"
                            }}
                        >
                            {participant.isSpeaking ? (
                                <Mic className="h-5 w-5" />
                            ) : (
                                <User className="h-5 w-5" />
                            )}
                        </motion.div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm truncate">
                                        {participant.name || participant.speakerId}
                                    </p>
                                    {participant.isSpeaking && (
                                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-primary/10 text-primary border-primary/20">
                                            Speaking
                                        </Badge>
                                    )}
                                </div>
                                {participant.contactId && (
                                    <div className="flex items-center gap-1">
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                )}
                            </div>
                            {/* Subtitle / Role if available (optimistic) */}
                            {participant.contactId && !isExpanded && (
                                <p className="text-xs text-muted-foreground truncate">
                                    {contacts.find(c => c.id === participant.contactId)?.role || "Click to edit details"}
                                </p>
                            )}
                            {!participant.contactId && (
                                <p className="text-xs text-muted-foreground italic">Guest</p>
                            )}
                        </div>
                    </div>

                    {/* Expanded Edit Form */}
                    <AnimatePresence>
                        {isExpanded && participant.contactId && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-border/50 bg-card"
                            >
                                <div className="p-3 space-y-3" onClick={e => e.stopPropagation()}>
                                    <div className="grid gap-2">
                                        <div className="space-y-1">
                                            <Label htmlFor={`name-${index}`} className="text-xs">Name</Label>
                                            <Input
                                                id={`name-${index}`}
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label htmlFor={`role-${index}`} className="text-xs">Role</Label>
                                                <Input
                                                    id={`role-${index}`}
                                                    value={formData.role}
                                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                                    className="h-8 text-sm"
                                                    placeholder="e.g. Manager"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor={`phone-${index}`} className="text-xs">Phone</Label>
                                                <Input
                                                    id={`phone-${index}`}
                                                    value={formData.phone}
                                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                    className="h-8 text-sm"
                                                    placeholder="+1..."
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`email-${index}`} className="text-xs">Email</Label>
                                            <Input
                                                id={`email-${index}`}
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="h-8 text-sm"
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`company-${index}`} className="text-xs">Company</Label>
                                            <Select
                                                value={formData.companyId || "none"}
                                                onValueChange={(val) => setFormData({ ...formData, companyId: val === "none" ? "" : val })}
                                            >
                                                <SelectTrigger className="h-8 text-sm" id={`company-${index}`}>
                                                    <SelectValue placeholder="Select company" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {companies.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => onViewContact(participant.contactId!)}
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Full Profile
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => setIsExpanded(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-7 px-3 text-xs"
                                                onClick={handleSave}
                                                disabled={isSaving}
                                            >
                                                {isSaving ? <span className="animate-spin mr-1">⏳</span> : <Save className="h-3 w-3 mr-1" />}
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.div>
    );
});

ParticipantCard.displayName = "ParticipantCard";

export function ParticipantsPane() {
    const navigate = useNavigate();
    const { participants } = useMeetingStore();

    const handleViewContact = useCallback((contactId: string) => {
        navigate(`/contacts/${contactId}`);
    }, [navigate]);

    // Get unique speakers from transcript blocks
    const transcriptBlocks = useMeetingStore(state => state.transcriptBlocks);

    // Get contacts from workspace store
    const { contacts, fetchContacts } = useWorkspaceStore();
    // Load contacts on mount
    useEffect(() => {
        if (contacts.length === 0) {
            fetchContacts();
        }
    }, [contacts.length, fetchContacts]);

    // Get unique speakers from transcript blocks using IDs preferably
    const allSpeakers = useMemo(() => {
        const speakerMap = new Map<string, { id: string, name: string }>();

        transcriptBlocks.forEach(block => {
            // Priority: speakerId (Contact/Stable UUID) > traceId (Session UUID) > speaker (Name Fallback)
            const uniqueId = block.speakerId || block.traceId || block.speaker;
            const displayName = block.speaker;

            if (!speakerMap.has(uniqueId)) {
                speakerMap.set(uniqueId, { id: uniqueId, name: displayName });
            } else {
                const existing = speakerMap.get(uniqueId);
                // Update name if we find a "better" one (not generic) or just stick to latest
                // If the block has a contact ID, we want to use that name.
                // But the loop is sequential.
                if (existing && existing.name !== displayName && displayName !== 'Guest' && displayName !== 'Speaker') {
                    speakerMap.set(uniqueId, { id: uniqueId, name: displayName });
                }
            }
        });
        return Array.from(speakerMap.values());
    }, [transcriptBlocks]);

    // Merge with existing participants from store (state.participants)
    // The meetingStore participants list might be updated by our new edit action too.
    const allParticipants = useMemo(() => {
        const existingMap = new Map(participants.map(p => [p.speakerId || p.id, p]));

        return allSpeakers.map(({ id, name }) => {
            const existing = existingMap.get(id);

            if (existing) {
                return {
                    ...existing,
                    name: existing.name || name // Ensure name is present
                };
            }

            return {
                id: id,
                speakerId: id,
                name: name,
                isSpeaking: false
            } as Participant;
        });
    }, [participants, allSpeakers]);

    const [isAdding, setIsAdding] = useState(false);
    const { updateParticipant } = useMeetingStore();

    const handleCreate = useCallback(async (data: any) => {
        try {
            // Create in DB
            const newContact = await workspaceApi.createContact({
                name: data.name,
                email: data.email || undefined,
                role: data.role || undefined,
                phone: data.phone || undefined,
                company_id: data.companyId || undefined
            });

            // Refresh global contacts
            await fetchContacts();

            // Add to Meeting Store as a participant
            // We use contactId as speakerId for manually added participants
            updateParticipant(newContact.id, {
                id: newContact.id,
                speakerId: newContact.id,
                contactId: newContact.id,
                name: newContact.name,
                isSpeaking: false
            });

            setIsAdding(false);
            toast.success("Participant added");
        } catch (error) {
            console.error("Failed to add participant:", error);
            toast.error("Failed to add participant");
        }
    }, [fetchContacts, updateParticipant]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="font-semibold text-sm">Participants</h3>
                    <Badge variant="secondary" className="text-xs" aria-label={`${allParticipants.length} participants`}>
                        {allParticipants.length}
                    </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsAdding(!isAdding)} title="Add Participant">
                    <UserPlus className="h-4 w-4" />
                </Button>
            </div>

            <AnimatePresence mode="popLayout">
                <div className="space-y-2" role="list" aria-label="Meeting participants">
                    {isAdding && (
                        <NewParticipantForm
                            onCancel={() => setIsAdding(false)}
                            onSave={handleCreate}
                            companies={useWorkspaceStore.getState().companies}
                        />
                    )}

                    {allParticipants.length === 0 && !isAdding ? (
                        <p className="text-xs text-muted-foreground text-center py-4" role="status">
                            No participants detected yet
                        </p>
                    ) : (
                        allParticipants.map((participant, index) => (
                            <ParticipantCard
                                key={participant.speakerId}
                                participant={participant}
                                onViewContact={handleViewContact}
                                index={index}
                            />
                        ))
                    )}
                </div>
            </AnimatePresence>
        </div>
    );
}

// New Participant Form Component
function NewParticipantForm({ onCancel, onSave, companies }: { onCancel: () => void, onSave: (data: any) => Promise<void>, companies: any[] }) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "",
        companyId: "",
        phone: ""
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (!formData.name) return;
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border rounded-md bg-card p-3 space-y-3 shadow-sm border-dashed border-primary/40"
        >
            <div className="grid gap-2">
                <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Name"
                        autoFocus
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label className="text-xs">Role</Label>
                        <Input
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="h-8 text-sm"
                            placeholder="Role"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="h-8 text-sm"
                            placeholder="Phone"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Email"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Company</Label>
                    <Select
                        value={formData.companyId || "none"}
                        onValueChange={(val) => setFormData({ ...formData, companyId: val === "none" ? "" : val })}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {companies.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={isSaving || !formData.name}>
                    {isSaving ? "Saving..." : "Add Participant"}
                </Button>
            </div>
        </motion.div>
    );
}
