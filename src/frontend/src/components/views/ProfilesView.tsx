import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Save, Loader2 } from "lucide-react";
import { workspaceApi } from "@/api/client";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toast } from "@/components/ui/toast";

interface Profile {
    id: string;
    name: string;
    type: string;
    base_prompt?: string;
    company_id: string;
    created_at: string;
    updated_at: string;
}

export function ProfilesView() {
    const { selectedCompanyId, companies, fetchCompanies } = useWorkspaceStore();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [testingProfile, setTestingProfile] = useState<string | null>(null);
    const [testInput, setTestInput] = useState("");
    const [testOutput, setTestOutput] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const profileTypes = [
        { value: "business_analyst", label: "Business Analyst" },
        { value: "product_owner", label: "Product Owner" },
        { value: "interviewer", label: "Interviewer" },
        { value: "legal", label: "Legal Advisor" },
    ];

    // Load profiles when company is selected
    useEffect(() => {
        const loadProfiles = async () => {
            if (!selectedCompanyId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const profilesData = await workspaceApi.getProfiles(selectedCompanyId);
                setProfiles(profilesData);
            } catch (error) {
                console.error("Failed to load profiles:", error);
                toast.error("Failed to load profiles");
            } finally {
                setIsLoading(false);
            }
        };

        loadProfiles();
    }, [selectedCompanyId]);

    // Ensure companies are loaded
    useEffect(() => {
        if (companies.length === 0) {
            fetchCompanies();
        }
    }, [companies.length, fetchCompanies]);

    const handleTestProfile = (profileId: string) => {
        setTestingProfile(profileId);
        setTestInput("");
        setTestOutput("");
    };

    const generateTestResponse = (profile: Profile, input: string) => {
        // For now, return a simple response. In production, this would call the AI with the profile's prompt
        const basePrompt = profile.base_prompt || `You are a ${profile.type}`;
        return `[This would use the profile's base prompt: "${basePrompt.substring(0, 50)}..."]\n\nResponse to: "${input}"`;
    };

    const handleDeleteProfile = async (profileId: string) => {
        if (!confirm("Are you sure you want to delete this profile?")) {
            return;
        }

        try {
            await workspaceApi.deleteProfile(profileId);
            setProfiles(profiles.filter(p => p.id !== profileId));
            toast.success("Profile deleted successfully");
        } catch (error) {
            console.error("Failed to delete profile:", error);
            toast.error("Failed to delete profile");
        }
    };

    const handleProfileCreated = async () => {
        if (selectedCompanyId) {
            try {
                const profilesData = await workspaceApi.getProfiles(selectedCompanyId);
                setProfiles(profilesData);
            } catch (error) {
                console.error("Failed to refresh profiles:", error);
            }
        }
    };

    if (!selectedCompanyId) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-muted-foreground mb-4">Please select a company to view profiles</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full animate-in fade-in duration-500">
            <div className="flex justify-between items-end border-b border-border/50 pb-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Profiles</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Manage AI personas and communication styles for different contexts.
                    </p>
                    {selectedCompanyId && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Company: {companies.find(c => c.id === selectedCompanyId)?.name || "Unknown"}
                        </p>
                    )}
                </div>
                <Dialog open={isCreating} onOpenChange={setIsCreating}>
                    <DialogTrigger asChild>
                        <Button disabled={!selectedCompanyId}>
                            <Plus className="mr-2 h-4 w-4" /> New Profile
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create New Profile</DialogTitle>
                            <DialogDescription>
                                Define a new AI persona for your workspace
                            </DialogDescription>
                        </DialogHeader>
                        <ProfileForm
                            onClose={() => setIsCreating(false)}
                            profileTypes={profileTypes}
                            companyId={selectedCompanyId}
                            onProfileCreated={handleProfileCreated}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : profiles.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">No profiles found. Create your first profile to get started.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {profiles.map(profile => (
                        <Card key={profile.id} className="hover:border-primary/40 transition-colors">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{profile.name}</CardTitle>
                                        <CardDescription className="mt-1">
                                            {profileTypes.find(t => t.value === profile.type)?.label || profile.type}
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingProfile(profile)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProfile(profile.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {profile.type}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {profile.base_prompt || "No prompt defined"}
                                    </p>
                                    <Dialog open={testingProfile === profile.id} onOpenChange={(open) => setTestingProfile(open ? profile.id : null)}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                size="sm"
                                                onClick={() => handleTestProfile(profile.id)}
                                            >
                                                Test Profile
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-3xl">
                                            <DialogHeader>
                                                <DialogTitle>Test Profile: {profile.name}</DialogTitle>
                                                <DialogDescription>
                                                    See how this profile would respond to different inputs
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Test Input</Label>
                                                    <Textarea
                                                        placeholder="Type a message or question to test the profile..."
                                                        value={testInput}
                                                        onChange={(e) => setTestInput(e.target.value)}
                                                        rows={3}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            const response = generateTestResponse(profile, testInput);
                                                            setTestOutput(response);
                                                        }}
                                                        disabled={!testInput.trim()}
                                                    >
                                                        Generate Response
                                                    </Button>
                                                </div>
                                                {testOutput && (
                                                    <div className="space-y-2">
                                                        <Label>Profile Response</Label>
                                                        <div className="p-4 rounded-lg bg-muted/50 border border-border">
                                                            <p className="text-sm whitespace-pre-wrap">{testOutput}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Profile Editor Modal */}
            {editingProfile && (
                <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Edit Profile</DialogTitle>
                            <DialogDescription>Configure the AI persona and communication style</DialogDescription>
                        </DialogHeader>
                        <ProfileForm
                            onClose={() => setEditingProfile(null)}
                            profileTypes={profileTypes}
                            companyId={editingProfile.company_id}
                            editingProfile={editingProfile}
                            onProfileCreated={handleProfileCreated}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

function ProfileForm({
    onClose,
    profileTypes,
    companyId,
    editingProfile,
    onProfileCreated
}: {
    onClose: () => void;
    profileTypes: Array<{ value: string; label: string }>;
    companyId: string;
    editingProfile?: Profile | null;
    onProfileCreated?: () => void;
}) {
    const [name, setName] = useState(editingProfile?.name || "");
    const [type, setType] = useState(editingProfile?.type || "business_analyst");
    const [prompt, setPrompt] = useState(editingProfile?.base_prompt || "");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error("Profile name is required");
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingProfile) {
                await workspaceApi.updateProfile(editingProfile.id, {
                    name: name.trim(),
                    type,
                    base_prompt: prompt.trim() || undefined
                });
                toast.success("Profile updated successfully");
            } else {
                await workspaceApi.createProfile({
                    name: name.trim(),
                    type,
                    base_prompt: prompt.trim() || undefined,
                    company_id: companyId
                });
                toast.success("Profile created successfully");
            }
            onClose();
            if (onProfileCreated) {
                onProfileCreated();
            }
        } catch (error) {
            console.error("Failed to save profile:", error);
            toast.error(editingProfile ? "Failed to update profile" : "Failed to create profile");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Profile Name</Label>
                    <Input
                        placeholder="BA - MN8"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        {profileTypes.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="space-y-2">
                <Label>Base Prompt</Label>
                <Textarea
                    placeholder="You are a business analyst working on..."
                    rows={8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> {editingProfile ? "Update" : "Create"} Profile
                </Button>
            </div>
        </div>
    );
}
