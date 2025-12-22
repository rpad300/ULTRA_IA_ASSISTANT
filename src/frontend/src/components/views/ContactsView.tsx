import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VoiceEnrollmentDialog } from "@/components/contacts/VoiceEnrollmentDialog";
import { Mic, Plus, Search, Mail, Building, Calendar, CheckSquare, Trash2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactHealthBadge } from "@/components/contacts/ContactHealthBadge";
import { workspaceApi, type Contact } from "@/api/client";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function ContactsView() {

    const { companies, fetchCompanies } = useWorkspaceStore();
    const navigate = useNavigate();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCompany, setSelectedCompany] = useState<string>("all");
    const [selectedRole, setSelectedRole] = useState<string>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isContactFormOpen, setIsContactFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [enrollmentContact, setEnrollmentContact] = useState<Contact | null>(null);

    // Fetch contacts and companies on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await fetchCompanies();
                const contactsData = await workspaceApi.getContacts();
                setContacts(contactsData);
            } catch (error) {
                console.error("Failed to load contacts:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [fetchCompanies]);

    // Get unique roles from contacts
    const availableRoles = useMemo(() => {
        const roles = new Set<string>();
        contacts.forEach(contact => {
            if (contact.role) {
                roles.add(contact.role);
            }
        });
        return Array.from(roles).sort();
    }, [contacts]);

    const debouncedSearch = useDebounce(searchQuery, 300);

    const filteredContacts = useMemo(() => {
        let filtered = [...contacts];

        // Search filter (name, email)
        if (debouncedSearch) {
            const query = debouncedSearch.toLowerCase();
            filtered = filtered.filter(
                contact =>
                    contact.name.toLowerCase().includes(query) ||
                    (contact.email && contact.email.toLowerCase().includes(query))
            );
        }

        // Company filter
        if (selectedCompany !== "all") {
            filtered = filtered.filter(
                contact => contact.company_id === selectedCompany
            );
        }

        // Role filter
        if (selectedRole !== "all") {
            filtered = filtered.filter(contact => contact.role === selectedRole);
        }

        return filtered;
    }, [contacts, debouncedSearch, selectedCompany, selectedRole]);

    const handleContactCreated = async () => {
        // Refresh contacts after creation/update
        try {
            const contactsData = await workspaceApi.getContacts();
            setContacts(contactsData);
            setIsContactFormOpen(false);
            setEditingContact(null);
        } catch (error) {
            console.error("Failed to refresh contacts:", error);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/50 pb-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contacts</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        People and stakeholders associated with your projects.
                    </p>
                </div>
                <Button
                    className="shadow-sm"
                    onClick={() => setIsContactFormOpen(true)}
                >
                    <Plus className="mr-2 h-4 w-4" /> New Contact
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-card"
                    />
                </div>

                {/* Company Filter */}
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Companies</SelectItem>
                        {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                                {company.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Role Filter */}
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                                {role}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Contacts Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-muted-foreground">No contacts found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead className="text-center">Meetings</TableHead>
                                    <TableHead className="text-center">Tasks</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredContacts.map((contact, index) => (
                                    <motion.tr
                                        key={contact.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={(e) => {
                                            // Don't navigate if clicking on action buttons
                                            if ((e.target as HTMLElement).closest('button')) {
                                                return;
                                            }
                                            navigate(`/contacts/${contact.id}`);
                                        }}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 border border-border">
                                                    <AvatarImage
                                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.name}`}
                                                    />
                                                    <AvatarFallback>
                                                        {contact.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-sm">{contact.name}</p>
                                                    {contact.role && (
                                                        <p className="text-xs text-muted-foreground">{contact.role}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="truncate max-w-[200px]">{contact.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>
                                                    {companies.find(c => c.id === contact.company_id)?.name || "—"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-sm">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{contact.meetings_count || 0}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-sm">
                                                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{contact.tasks_count || 0}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <ContactHealthBadge
                                                meetingsCount={contact.meetings_count || 0}
                                                tasksCount={contact.tasks_count || 0}
                                                projectsInCommon={0}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEnrollmentContact(contact);
                                                }}
                                                title="Enroll Voice Profile"
                                            >
                                                <Mic className={`h-4 w-4 ${contact.voice_profile ? 'text-indigo-400 fill-indigo-400/20' : 'text-muted-foreground'}`} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm("Are you sure you want to delete this contact?")) {
                                                        try {
                                                            await workspaceApi.deleteContact(contact.id);
                                                            // Refresh
                                                            const contactsData = await workspaceApi.getContacts();
                                                            setContacts(contactsData);
                                                        } catch (err) {
                                                            console.error("Failed to delete contact", err);
                                                        }
                                                    }
                                                }}
                                                title="Delete Contact"
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </motion.tr>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Contact Form Dialog */}
            <ContactForm
                open={isContactFormOpen}
                onOpenChange={(open) => {
                    setIsContactFormOpen(open);
                    if (!open) {
                        setEditingContact(null);
                    }
                }}
                editingContact={editingContact}
                onContactCreated={handleContactCreated}
            />

            {/* Voice Enrollment Dialog */}
            {enrollmentContact && (
                <VoiceEnrollmentDialog
                    isOpen={!!enrollmentContact}
                    onClose={() => setEnrollmentContact(null)}
                    contact={enrollmentContact}
                />
            )}
        </div>
    );
}
