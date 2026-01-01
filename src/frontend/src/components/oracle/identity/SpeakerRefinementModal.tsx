
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { ScrollArea } from '../../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { ContactService } from '../../../services/ContactService';
import type { Contact } from '../../../services/ContactService';
import { Loader2, UserCheck, UserPlus, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SpeakerRefinementModalProps {
    guestId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const SpeakerRefinementModal: React.FC<SpeakerRefinementModalProps> = ({ guestId, isOpen, onClose }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);

    // Store access to get Session ID
    // We assume the FIRST transcript in store has the session_id, or we need it from store global state.
    // Let's add session_id to store connection state or we pass it down. 
    // For now, let's assume we can get it from the store if we add it, or simpler: 
    // The "Oracle HUD" usually connects to a single session. 
    // We'll update the store to track `sessionId`.
    // We assume the FIRST transcript in store has the session_id, or we need it from store global state.
    // The "Oracle HUD" usually connects to a single session. 
    // We'll update the store to track `sessionId`.

    useEffect(() => {
        if (isOpen) {
            loadContacts();
        }
    }, [isOpen]);

    const loadContacts = async () => {
        setIsLoading(true);
        try {
            const data = await ContactService.getAllContacts();
            setContacts(data);
        } catch (e) {
            toast.error("Failed to load contacts");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssign = async (contact: Contact) => {
        // We need session ID. 
        // Hack: parse from URL or store. 
        // If we connected via WS using "ORACLE_DEMO_SESSION", we should track that.
        // Let's grab it from URL param ?session_id=... or default.
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const sessionId = urlParams.get('session_id') || "ORACLE_DEMO_SESSION";

        setIsAssigning(true);
        try {
            await ContactService.assignGuest(contact.id, {
                guest_id: guestId,
                session_id: sessionId
            });

            toast.success(`Assigned ${guestId} to ${contact.name}`);
            onClose(); // Close modal
        } catch (e) {
            console.error(e);
            toast.error("Assignment failed");
        } finally {
            setIsAssigning(false);
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-emerald-500" />
                        Identify Speaker
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Who is <span className="font-bold text-slate-200">{guestId}</span>? Assign to a contact to improve Voice ID.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search contacts..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-slate-900 border-slate-800 pl-8 focus-visible:ring-emerald-500"
                        />
                    </div>

                    {/* Contact List */}
                    <ScrollArea className="h-[300px] border border-slate-800 rounded-md bg-slate-900/50 p-2">
                        {isLoading ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {filteredContacts.map(contact => (
                                    <button
                                        key={contact.id}
                                        onClick={() => handleAssign(contact)}
                                        disabled={isAssigning}
                                        className="flex items-center gap-3 p-2 rounded hover:bg-slate-800 transition-colors text-left group"
                                    >
                                        <Avatar className="w-8 h-8 border border-slate-700">
                                            {/* SOTA: Use DiceBear or stored image */}
                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name}`} />
                                            <AvatarFallback>{contact.name[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-200 group-hover:text-white">
                                                {contact.name}
                                            </p>
                                            <p className="text-[10px] text-slate-500 truncate">
                                                {contact.email || "No email"}
                                            </p>
                                        </div>
                                        {contact.voice_profile && (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">
                                                ENROLLED
                                            </span>
                                        )}
                                    </button>
                                ))}
                                {filteredContacts.length === 0 && (
                                    <div className="text-center py-8 text-slate-500 text-xs">
                                        No contacts found.
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* Footer / Quick Actions */}
                <div className="flex justify-between items-center bg-slate-900/50 rounded p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-500">
                        Don't see them?
                    </span>
                    <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 hover:bg-slate-800" disabled>
                        <UserPlus className="w-3 h-3 mr-1" />
                        Create New Contact
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
