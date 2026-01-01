import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, User, Building2, Mail, Phone, Briefcase } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useMediaQuery } from "@/hooks/use-media-query"; // Need to create this hook file if it doesn't exist, will do after.

import { workspaceApi } from "@/api/client";
import type { Company } from "@/api/client";

// --- Zod Schema ---
const contactSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(5, "Phone number is too short").regex(/^\+?[\d\s-().]{5,}$/, "Invalid phone format"),
    role: z.string().min(2, "Role is required"),
    company_id: z.string().min(1, "Company is required"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface CreateContactDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companies: Company[];
    onSuccess: (newContactId: string) => void;
}

export function CreateContactDialog({
    open,
    onOpenChange,
    companies,
    onSuccess,
}: CreateContactDialogProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            role: "",
            company_id: "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset();
        }
    }, [open, form]);

    const onSubmit = async (data: ContactFormValues) => {
        setIsSubmitting(true);
        try {
            // Use toast.promise for SOTA UX
            const promise = workspaceApi.createContact({
                name: data.name,
                email: data.email,
                role: data.role,
                phone: data.phone,
                company_id: data.company_id,
                status: 'active'
            });

            toast.promise(promise, {
                loading: 'Creating contact...',
                success: (newContact) => {
                    onSuccess(newContact.id);
                    onOpenChange(false);
                    return `Contact "${newContact.name}" created successfully`;
                },
                error: (err) => {
                    console.error("Failed to create contact", err);
                    return "Failed to create contact. Please try again.";
                }
            });

            await promise;

        } catch (error) {
            // Handled by toast.promise
        } finally {
            setIsSubmitting(false);
        }
    };

    const FormContent = (
        <form id="create-contact-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 md:px-0 py-2">
            <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="name"
                        placeholder="John Doe"
                        className="pl-9"
                        {...form.register("name")}
                    />
                </div>
                {form.formState.errors.name && (
                    <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            className="pl-9"
                            {...form.register("email")}
                        />
                    </div>
                    {form.formState.errors.email && (
                        <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                        <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="phone"
                            placeholder="+1 234 567 890"
                            className="pl-9"
                            {...form.register("phone")}
                        />
                    </div>
                    {form.formState.errors.phone && (
                        <p className="text-xs text-red-500">{form.formState.errors.phone.message}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <div className="relative">
                        <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="role"
                            placeholder="Product Manager"
                            className="pl-9"
                            {...form.register("role")}
                        />
                    </div>
                    {form.formState.errors.role && (
                        <p className="text-xs text-red-500">{form.formState.errors.role.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Select
                        onValueChange={(value) => form.setValue("company_id", value)}
                        defaultValue={form.getValues("company_id")}
                    >
                        <SelectTrigger className="pl-9 relative">
                            <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                            {companies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                    {company.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {form.formState.errors.company_id && (
                        <p className="text-xs text-red-500">{form.formState.errors.company_id.message}</p>
                    )}
                </div>
            </div>
        </form>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create New Contact</DialogTitle>
                        <DialogDescription>
                            Add a new contact to your workspace to assign speakers.
                        </DialogDescription>
                    </DialogHeader>
                    {FormContent}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" form="create-contact-form" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Contact
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <DrawerTitle>Create New Contact</DrawerTitle>
                    <DrawerDescription>
                        Add a new contact to your workspace.
                    </DrawerDescription>
                </DrawerHeader>
                {FormContent}
                <DrawerFooter className="pt-4">
                    <Button type="submit" form="create-contact-form" disabled={isSubmitting} className="w-full">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Contact
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                        Cancel
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
