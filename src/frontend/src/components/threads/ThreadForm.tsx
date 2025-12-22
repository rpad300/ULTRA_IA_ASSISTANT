import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { workspaceApi } from "@/api/client";

interface ThreadFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    companyId: string;
    onSuccess: (threadId?: string) => void;
}

interface Profile {
    id: string;
    name: string;
    type: string;
}

export function ThreadForm({ open, onOpenChange, projectId, companyId, onSuccess }: ThreadFormProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [profileId, setProfileId] = useState<string | undefined>(undefined);
    const [calendarEventId, setCalendarEventId] = useState("");
    const [status, setStatus] = useState<"planned" | "active" | "completed">("planned");
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

    useEffect(() => {
        if (open) {
            // Reset form
            setTitle("");
            setDescription("");
            setProfileId(undefined);
            setCalendarEventId("");
            setStatus("planned");

            // Fetch profiles for this company
            setIsLoadingProfiles(true);
            const fetchProfiles = async () => {
                try {
                    const profilesData = await workspaceApi.getProfiles(companyId);
                    setProfiles(profilesData);
                } catch (error) {
                    console.error("Failed to fetch profiles:", error);
                    // Fallback to empty array
                    setProfiles([]);
                } finally {
                    setIsLoadingProfiles(false);
                }
            };
            fetchProfiles();
        }
    }, [open, companyId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Thread title is required");
            return;
        }

        setIsLoading(true);

        // Optimistic update - create temporary thread


        try {
            const newThread = await workspaceApi.createThread(projectId, {
                title: title.trim(),
                description: description.trim() || undefined,
                profile_id: profileId || undefined,
                calendar_event_id: calendarEventId.trim() || undefined,
                status: status,
            });

            if (!newThread || !newThread.id) {
                throw new Error("Thread creation failed: no ID returned");
            }

            toast.success("Thread created successfully");

            // Close form first
            onOpenChange(false);

            // Small delay to ensure backend has processed the creation
            await new Promise(resolve => setTimeout(resolve, 100));

            // Then call onSuccess with the thread ID
            onSuccess(newThread.id);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || error?.message || "Failed to create thread";
            toast.error(errorMessage);
            console.error("Thread creation error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Create New Thread</DialogTitle>
                    <DialogDescription>
                        Set up a new thread for meeting preparation and collaboration.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="title">Thread Title *</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            placeholder="Q1 Planning Meeting"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="profile">Profile</Label>
                            <Select
                                value={profileId || "none"}
                                onValueChange={(value) => setProfileId(value === "none" ? undefined : value)}
                                disabled={isLoadingProfiles}
                            >
                                <SelectTrigger id="profile">
                                    <SelectValue placeholder="Select profile (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {profiles.map(profile => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            {profile.name} ({profile.type})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as "planned" | "active" | "completed")}>
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="planned">Planned</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Brief description of the thread's purpose..."
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="calendar">Linked Calendar Event ID (Optional)</Label>
                        <Input
                            id="calendar"
                            value={calendarEventId}
                            onChange={e => setCalendarEventId(e.target.value)}
                            placeholder="google-calendar-event-id"
                        />
                        <p className="text-xs text-muted-foreground">
                            Link this thread to a Google Calendar event for automatic scheduling.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Thread
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

