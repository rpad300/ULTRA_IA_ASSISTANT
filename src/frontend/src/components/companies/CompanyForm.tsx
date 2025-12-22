import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type Company } from "@/api/client";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";

// Zod schema for company validation
const companySchema = z.object({
    name: z.string().min(1, "Company name is required").max(100, "Company name must be less than 100 characters"),
    website: z.string().optional().refine(
        (val) => {
            if (!val || val.trim() === "") return true;
            try {
                const url = val.startsWith("http://") || val.startsWith("https://") 
                    ? val 
                    : `https://${val}`;
                new URL(url);
                return true;
            } catch {
                return false;
            }
        },
        { message: "Please enter a valid URL (e.g., example.com or https://example.com)" }
    ),
    industry: z.string().max(50, "Industry must be less than 50 characters").optional(),
    drive_root_folder_id: z.string().max(100, "Folder ID must be less than 100 characters").optional(),
    description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface CompanyFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingCompany?: Company | null;
}

export function CompanyForm({ open, onOpenChange, editingCompany }: CompanyFormProps) {
    const { createCompany, updateCompany, isLoading } = useWorkspaceStore();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        setError,
        clearErrors,
    } = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            name: "",
            website: "",
            industry: "",
            drive_root_folder_id: "",
            description: "",
        },
    });

    // Reset form when opening or changing editingCompany
    useEffect(() => {
        if (open) {
            if (editingCompany) {
                reset({
                    name: editingCompany.name || "",
                    website: editingCompany.website || "",
                    industry: editingCompany.industry || "",
                    drive_root_folder_id: editingCompany.drive_root_folder_id || "",
                    description: editingCompany.description || "",
                });
            } else {
                reset({
                    name: "",
                    website: "",
                    industry: "",
                    drive_root_folder_id: "",
                    description: "",
                });
            }
            clearErrors();
        }
    }, [editingCompany, open, reset, clearErrors]);

    const onSubmit = async (data: CompanyFormData) => {
        try {
            const payload = {
                name: data.name.trim(),
                website: data.website?.trim() || undefined,
                industry: data.industry?.trim() || undefined,
                drive_root_folder_id: data.drive_root_folder_id?.trim() || undefined,
                description: data.description?.trim() || undefined,
            };

            if (editingCompany) {
                await updateCompany(editingCompany.id, payload);
                toast.success("Company updated successfully");
            } else {
                await createCompany(payload);
                toast.success("Company created successfully");
            }
            onOpenChange(false);
        } catch (error: any) {
            // Handle specific backend validation errors
            const errorMessage = error?.response?.data?.detail || error?.message || "Unknown error";
            
            // Try to extract field-specific errors
            if (typeof errorMessage === "string") {
                if (errorMessage.toLowerCase().includes("name") && errorMessage.toLowerCase().includes("already exists")) {
                    setError("name", {
                        type: "server",
                        message: "A company with this name already exists",
                    });
                    toast.error("A company with this name already exists");
                    return;
                }
                if (errorMessage.toLowerCase().includes("website") || errorMessage.toLowerCase().includes("url")) {
                    setError("website", {
                        type: "server",
                        message: "Invalid website URL",
                    });
                }
            }
            
            toast.error(
                editingCompany 
                    ? `Failed to update company: ${errorMessage}` 
                    : `Failed to create company: ${errorMessage}`
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingCompany ? "Edit Company" : "Create Company"}</DialogTitle>
                    <DialogDescription>
                        {editingCompany ? "Update the company details below." : "Add a new company to your workspace."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Company Name *</Label>
                        <Input
                            id="name"
                            {...register("name")}
                            placeholder="Acme Corp"
                            aria-invalid={errors.name ? "true" : "false"}
                            className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-500" role="alert">
                                {errors.name.message}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input
                                id="website"
                                {...register("website")}
                                placeholder="https://acme.com or acme.com"
                                aria-invalid={errors.website ? "true" : "false"}
                                className={errors.website ? "border-red-500 focus-visible:ring-red-500" : ""}
                            />
                            {errors.website && (
                                <p className="text-sm text-red-500" role="alert">
                                    {errors.website.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <Input
                                id="industry"
                                {...register("industry")}
                                placeholder="Tech, Retail..."
                                aria-invalid={errors.industry ? "true" : "false"}
                                className={errors.industry ? "border-red-500 focus-visible:ring-red-500" : ""}
                            />
                            {errors.industry && (
                                <p className="text-sm text-red-500" role="alert">
                                    {errors.industry.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="drive">Drive Root Folder ID</Label>
                        <Input
                            id="drive"
                            {...register("drive_root_folder_id")}
                            placeholder="1A2B3C..."
                            aria-invalid={errors.drive_root_folder_id ? "true" : "false"}
                            className={errors.drive_root_folder_id ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.drive_root_folder_id && (
                            <p className="text-sm text-red-500" role="alert">
                                {errors.drive_root_folder_id.message}
                            </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">The Google Drive folder ID where projects will be stored.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="desc">Description</Label>
                        <Textarea
                            id="desc"
                            {...register("description")}
                            placeholder="Brief description..."
                            aria-invalid={errors.description ? "true" : "false"}
                            className={errors.description ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500" role="alert">
                                {errors.description.message}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || isLoading}>
                            {isSubmitting || isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {editingCompany ? "Updating..." : "Creating..."}
                                </>
                            ) : (
                                editingCompany ? "Update" : "Create"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
