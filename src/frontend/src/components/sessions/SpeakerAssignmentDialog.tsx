
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact } from "@/api/client";

interface SpeakerAssignmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    traceId: string;
    currentSpeaker: string;
    onAssign: (contactName: string) => void;
}

export function SpeakerAssignmentDialog({
    open,
    onOpenChange,
    traceId,
    currentSpeaker,
    onAssign
}: SpeakerAssignmentDialogProps) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch contacts when dialog opens
    useEffect(() => {
        if (open) {
            loadContacts();
            setSearchQuery("");
            setSelectedContactId(null);
        }
    }, [open]);

    // Filter contacts based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredContacts(contacts);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredContacts(
                contacts.filter(contact =>
                    contact.name.toLowerCase().includes(query) ||
                    contact.email?.toLowerCase().includes(query)
                )
            );
        }
    }, [searchQuery, contacts]);

    const loadContacts = async () => {
        setIsLoading(true);
        try {
            // Updated to use the correct API pattern and types
            // workspaceApi was defined in client.ts
            const { workspaceApi } = await import('@/api/client');
            const data = await workspaceApi.getContacts();
            setContacts(data);
            setFilteredContacts(data);
        } catch (error) {
            console.error("Failed to load contacts:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedContactId || !traceId) return;

        setIsAssigning(true);
        try {
            // Call the new Voice Optimization Endpoint
            const response = await fetch('/api/voice/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trace_id: traceId,
                    contact_id: selectedContactId
                })
            });

            if (!response.ok) throw new Error('Failed to assign speaker');

            const data = await response.json();
            onAssign(data.contact_name);
            onOpenChange(false);
        } catch (error) {
            console.error("Assignment failed:", error);
            // Could show toast here
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Identify Speaker</DialogTitle>
                    <DialogDescription>
                        Identify the speaker currently labeled as "{currentSpeaker}".
                        This will help the AI recognize them in the future.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search contacts..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto border rounded-md">
                        {isLoading ? (
                            <div className="p-8 flex justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No contacts found.
                            </div>
                        ) : (
                            <div className="p-1 space-y-1">
                                {filteredContacts.map((contact) => (
                                    <div
                                        key={contact.id}
                                        onClick={() => setSelectedContactId(contact.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors text-sm",
                                            selectedContactId === contact.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                                        )}
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-medium truncate">{contact.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{contact.role || contact.email || "No details"}</p>
                                        </div>
                                        {selectedContactId === contact.id && (
                                            <Check className="h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleAssign} disabled={!selectedContactId || isAssigning}>
                        {isAssigning ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Learning...
                            </>
                        ) : (
                            "Confirm & Learn"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
