import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type Project } from "@/api/client";
import { workspaceApi } from "@/api/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";

// Zod schema for project validation
const projectSchema = z.object({
    name: z.string().min(1, "Project name is required").max(100, "Project name must be less than 100 characters"),
    description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingProject?: Project | null;
    companyId: string;
    onProjectCreated?: () => void;
}

export function ProjectForm({ open, onOpenChange, editingProject, companyId, onProjectCreated }: ProjectFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        setError,
        clearErrors,
    } = useForm<ProjectFormData>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            name: "",
            description: "",
        },
    });

    // Reset form when opening or changing editingProject
    useEffect(() => {
        if (open) {
            if (editingProject) {
                reset({
                    name: editingProject.name || "",
                    description: editingProject.description || "",
                });
            } else {
                reset({
                    name: "",
                    description: "",
                });
            }
            clearErrors();
        }
    }, [editingProject, open, reset, clearErrors]);

    const onSubmit = async (data: ProjectFormData) => {
        try {
            const payload = {
                name: data.name.trim(),
                description: data.description?.trim() || undefined,
            };

            if (editingProject) {
                await workspaceApi.updateProject(editingProject.id, payload);
                toast.success("Project updated successfully");
            } else {
                await workspaceApi.createProject(companyId, payload.name, payload.description);
                toast.success("Project created successfully");
            }
            onOpenChange(false);
            if (onProjectCreated) {
                onProjectCreated();
            }
            // Reset form after successful submission
            reset();
        } catch (error: any) {
            // Handle specific backend validation errors
            const errorMessage = error?.response?.data?.detail || error?.message || "Unknown error";
            
            // Try to extract field-specific errors
            if (typeof errorMessage === "string") {
                if (errorMessage.toLowerCase().includes("name") && errorMessage.toLowerCase().includes("already exists")) {
                    setError("name", {
                        type: "server",
                        message: "A project with this name already exists",
                    });
                    toast.error("A project with this name already exists");
                    return;
                }
            }
            
            toast.error(
                editingProject 
                    ? `Failed to update project: ${errorMessage}` 
                    : `Failed to create project: ${errorMessage}`
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingProject ? "Edit Project" : "Create Project"}</DialogTitle>
                    <DialogDescription>
                        {editingProject ? "Update the project details below." : "Add a new project to organize your work."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Project Name *</Label>
                        <Input
                            id="name"
                            {...register("name")}
                            placeholder="My Project"
                            aria-invalid={errors.name ? "true" : "false"}
                            className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-500" role="alert">
                                {errors.name.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="desc">Description</Label>
                        <Textarea
                            id="desc"
                            {...register("description")}
                            placeholder="Brief description of the project..."
                            aria-invalid={errors.description ? "true" : "false"}
                            className={errors.description ? "border-red-500 focus-visible:ring-red-500" : ""}
                            rows={4}
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
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {editingProject ? "Updating..." : "Creating..."}
                                </>
                            ) : (
                                editingProject ? "Update" : "Create"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

