import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Building2,
    FolderKanban,
    Mic,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/toast";

interface OnboardingWizardProps {
    open: boolean;
    onComplete: () => void;
}

type Step = 'welcome' | 'company' | 'project' | 'audio' | 'complete';

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
    const [currentStep, setCurrentStep] = useState<Step>('welcome');
    const [companyName, setCompanyName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [selectedMic, setSelectedMic] = useState<string>('default');
    const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
    const navigate = useNavigate();
    const { createCompany, fetchCompanies, createProject, companies } = useWorkspaceStore();

    const steps: Step[] = ['welcome', 'company', 'project', 'audio', 'complete'];
    const currentStepIndex = steps.indexOf(currentStep);
    const progress = ((currentStepIndex + 1) / steps.length) * 100;

    // Get available microphones
    const loadMicrophones = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            setMics(audioInputs);
            if (audioInputs.length > 0 && !selectedMic) {
                setSelectedMic(audioInputs[0].deviceId);
            }
        } catch (error) {
            console.error('Error loading microphones:', error);
        }
    };

    const handleNext = async () => {
        if (currentStep === 'welcome') {
            setCurrentStep('company');
        } else if (currentStep === 'company') {
            if (!companyName.trim()) {
                toast.error('Please enter a company name');
                return;
            }
            try {
                await createCompany({ name: companyName });
                await fetchCompanies();
                setCurrentStep('project');
            } catch (error) {
                toast.error('Failed to create company');
                console.error(error);
            }
        } else if (currentStep === 'project') {
            if (!projectName.trim()) {
                toast.error('Please enter a project name');
                return;
            }
            try {
                const latestCompany = companies[companies.length - 1];
                if (latestCompany) {
                    await createProject(latestCompany.id, {
                        name: projectName,
                        description: projectDescription || undefined
                    });
                }
                setCurrentStep('audio');
                loadMicrophones();
            } catch (error) {
                toast.error('Failed to create project');
                console.error(error);
            }
        } else if (currentStep === 'audio') {
            // Save audio settings
            localStorage.setItem('selectedMicrophone', selectedMic);
            setCurrentStep('complete');
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1]);
        }
    };

    const handleComplete = () => {
        onComplete();
        // Navigate to dashboard
        navigate('/');
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            // Allow closing only if user explicitly wants to skip
            if (!isOpen && currentStep !== 'complete') {
                const shouldSkip = window.confirm('Are you sure you want to skip onboarding? You can complete it later in Settings.');
                if (shouldSkip) {
                    onComplete();
                }
            } else if (!isOpen && currentStep === 'complete') {
                onComplete();
            }
        }}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
                <DialogTitle className="sr-only">Onboarding Wizard</DialogTitle>
                <DialogDescription className="sr-only">
                    Setup wizard to configure your workspace
                </DialogDescription>
                {/* Progress Bar */}
                <div className="px-6 pt-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                            Step {currentStepIndex + 1} of {steps.length}
                        </span>
                        <span className="text-sm font-medium">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                {/* Content */}
                <div className="px-6 py-6">
                    <AnimatePresence mode="wait">
                        {currentStep === 'welcome' && (
                            <motion.div
                                key="welcome"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-center space-y-6"
                            >
                                <div className="flex justify-center">
                                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Sparkles className="h-8 w-8 text-primary" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">Welcome to Ultra Assistant</h2>
                                    <p className="text-muted-foreground">
                                        Let's set up your workspace in just a few steps
                                    </p>
                                </div>
                                <Card className="bg-muted/50">
                                    <CardContent className="pt-6">
                                        <ul className="space-y-3 text-left">
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                <span>Create your first company</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                <span>Set up your first project</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                <span>Configure audio settings</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {currentStep === 'company' && (
                            <motion.div
                                key="company"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Create Your First Company</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Companies help organize your projects and meetings
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company-name">Company Name</Label>
                                    <Input
                                        id="company-name"
                                        placeholder="e.g., Acme Corp"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleNext();
                                            }
                                        }}
                                        autoFocus
                                    />
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'project' && (
                            <motion.div
                                key="project"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <FolderKanban className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Create Your First Project</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Projects group related meetings and threads
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="project-name">Project Name</Label>
                                    <Input
                                        id="project-name"
                                        placeholder="e.g., EVA Platform"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="project-description">Description (Optional)</Label>
                                    <Textarea
                                        id="project-description"
                                        placeholder="Brief description of the project..."
                                        value={projectDescription}
                                        onChange={(e) => setProjectDescription(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'audio' && (
                            <motion.div
                                key="audio"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Mic className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Configure Audio</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Select your microphone for meeting transcription
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Microphone Input</Label>
                                    <Select value={selectedMic} onValueChange={setSelectedMic}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {mics.length > 0 ? (
                                                mics.map(mic => (
                                                    <SelectItem key={mic.deviceId} value={mic.deviceId}>
                                                        {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <SelectItem value="default">Default Microphone</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        You can change this later in Settings
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'complete' && (
                            <motion.div
                                key="complete"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="text-center space-y-6"
                            >
                                <div className="flex justify-center">
                                    <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
                                    <p className="text-muted-foreground">
                                        Your workspace is ready. Start creating meetings and threads.
                                    </p>
                                </div>
                                <Card className="bg-muted/50">
                                    <CardContent className="pt-6">
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Quick tips to get started:
                                        </p>
                                        <ul className="space-y-2 text-left text-sm">
                                            <li className="flex items-center gap-2">
                                                <ArrowRight className="h-4 w-4 text-primary" />
                                                <span>Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-xs">⌘K</kbd> to open command palette</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <ArrowRight className="h-4 w-4 text-primary" />
                                                <span>Create threads to prepare for meetings</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <ArrowRight className="h-4 w-4 text-primary" />
                                                <span>Start a meeting to see live transcription</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={currentStepIndex === 0}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>

                    {currentStep === 'complete' ? (
                        <Button onClick={handleComplete}>
                            Get Started
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleNext}>
                            Next
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

