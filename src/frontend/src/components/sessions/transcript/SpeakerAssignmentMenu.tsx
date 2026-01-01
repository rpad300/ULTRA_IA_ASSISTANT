import { useState } from "react";
import { UserPlus, Plus, Check, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getSpeakerColor } from "./transcriptUtils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query"; // We'll need to create this or assume it exists. I will create a simple inline version if needed.
import type { Contact } from "@/api/client";

interface SpeakerAssignmentMenuProps {
    speakerName: string;
    blockId: string;
    contacts: Contact[];
    onAssignSpeaker: (blockId: string, contactId: string) => Promise<void>;
    onCreateContact: (blockId: string) => void;
    isAssigning: boolean;
}

export function SpeakerAssignmentMenu({
    speakerName,
    blockId,
    contacts,
    onAssignSpeaker,
    onCreateContact,
    isAssigning
}: SpeakerAssignmentMenuProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [open, setOpen] = useState(false);

    const handleSelect = async (contactId: string) => {
        setOpen(false);
        await onAssignSpeaker(blockId, contactId);
    };

    const handleCreate = () => {
        setOpen(false);
        onCreateContact(blockId);
    };

    const Trigger = (
        <div
            className={cn(
                "flex items-center gap-1 cursor-pointer rounded px-1 -ml-1 transition-all outline-none group/badge",
                "hover:bg-muted/50 focus:bg-muted/50 focus:ring-1 focus:ring-primary/30",
                // Mobile optimization: Height 44px equivalent via padding if needed, or rely on parent.
                // For the badge itself:
                "active:scale-95 touch-manipulation"
            )}
            title="Tap to assign speaker"
            onClick={() => setOpen(true)}
            role="button"
            tabIndex={0}
            aria-label={`Assign speaker for ${speakerName}`}
        >
            <Badge
                variant="outline"
                className={cn(
                    "text-xs pointer-events-none select-none",
                    getSpeakerColor(speakerName)
                )}
            >
                {isAssigning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {speakerName}
            </Badge>
            {/* Icon visible on hover for desktop, or always hint on mobile if we wanted (but the badge is the hint) */}
            <UserPlus className={cn(
                "h-3 w-3 text-muted-foreground transition-opacity",
                "opacity-0 group-hover/badge:opacity-100 md:opacity-0 md:group-hover/badge:opacity-100", // Hidden by default on desktop until hover
                "opacity-100 md:opacity-0" // Always visible on mobile? Or maybe just rely on users tapping the name.
                // User request: "Novas Diretrizes... Mobile... Interação Mobile... Remover dependência de Hover"
                // So let's make it visible on mobile/tablet (opacity-100) and hover-only on desktop.
            )} />
        </div>
    );

    const Content = (
        <div className="p-1">
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assign "{speakerName}" to...
            </div>
            <div className="h-px bg-border my-1" />

            <div
                onClick={handleCreate}
                className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-accent text-primary transition-colors focus:bg-accent outline-none"
                role="menuitem"
                tabIndex={0}
            >
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium">Create new contact</span>
            </div>

            <div className="h-px bg-border my-1" />

            <div className="max-h-[300px] overflow-y-auto">
                {contacts.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center italic">No existing contacts found</div>
                ) : (
                    contacts.map((contact) => (
                        <div
                            key={contact.id}
                            onClick={() => handleSelect(contact.id)}
                            className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-accent transition-colors outline-none focus:bg-accent"
                            role="menuitem"
                            tabIndex={0}
                        >
                            <Avatar className="h-7 w-7 shrink-0">
                                <AvatarFallback className="text-xs bg-muted">
                                    {contact.name.substring(0, 1)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{contact.name}</p>
                                {contact.role && <p className="text-xs text-muted-foreground truncate">{contact.role}</p>}
                            </div>
                            {speakerName === contact.name && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    {Trigger}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[260px]">
                    {Content}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {Trigger}
            </DrawerTrigger>
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <DrawerTitle>Assign Speaker</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-8">
                    {Content}
                </div>
                <DrawerFooter className="pt-2">
                    <DrawerClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
