import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Contact, workspaceApi } from "@/api/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface ContactFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingContact?: Contact | null;
    onContactCreated?: () => void;
}

export function ContactForm({ open, onOpenChange, editingContact, onContactCreated }: ContactFormProps) {
    const { companies } = useWorkspaceStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [companyId, setCompanyId] = useState<string>("");
    const [phone, setPhone] = useState("");

    // Reset form when opening or changing editingContact
    useEffect(() => {
        if (editingContact) {
            setName(editingContact.name || "");
            setEmail(editingContact.email || "");
            setRole(editingContact.role || "");
            setCompanyId(editingContact.company_id || "");
            setPhone(editingContact.phone || "");
        } else {
            setName("");
            setEmail("");
            setRole("");
            setCompanyId("");
            setPhone("");
        }
    }, [editingContact, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("Contact name is required");
            return;
        }

        // Company ID is now optional (for auto-creation from voice profiles)
        const data: any = {
            name: name.trim(),
            email: email.trim() || undefined,
            role: role.trim() || undefined,
            phone: phone.trim() || undefined,
        };

        // Only include company_id if provided
        if (companyId) {
            data.company_id = companyId;
        }

        setIsSubmitting(true);
        try {
            if (editingContact) {
                await workspaceApi.updateContact(editingContact.id, data);
                toast.success("Contact updated successfully");
            } else {
                await workspaceApi.createContact(data);
                toast.success("Contact created successfully");
            }
            onOpenChange(false);
            if (onContactCreated) {
                onContactCreated();
            }
        } catch (error) {
            console.error("Contact operation failed:", error);
            toast.error(editingContact ? "Failed to update contact" : "Failed to create contact");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingContact ? "Edit Contact" : "Create Contact"}</DialogTitle>
                    <DialogDescription>
                        {editingContact ? "Update the contact details below." : "Add a new contact to your workspace."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input 
                            id="name" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            required 
                            placeholder="John Doe" 
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input 
                            id="email" 
                            type="email"
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required 
                            placeholder="john@example.com" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Input 
                                id="role" 
                                value={role} 
                                onChange={e => setRole(e.target.value)} 
                                placeholder="Product Manager" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input 
                                id="phone" 
                                value={phone} 
                                onChange={e => setPhone(e.target.value)} 
                                placeholder="+1 234 567 8900" 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Select 
                            value={companyId || undefined} 
                            onValueChange={(value) => {
                                if (value === "none") {
                                    setCompanyId("");
                                } else {
                                    setCompanyId(value);
                                }
                            }}
                        >
                            <SelectTrigger id="company">
                                <SelectValue placeholder="Select a company" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {companies.map((company) => (
                                    <SelectItem key={company.id} value={company.id}>
                                        {company.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingContact ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

