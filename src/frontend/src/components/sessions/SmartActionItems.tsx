import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function SmartActionItems() {
    const {
        detectedActions,
        participants,
        confirmActionAsTask
    } = useMeetingStore();
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [assignedTo, setAssignedTo] = useState<string>("");
    const [dueDate, setDueDate] = useState("");

    const handleConfirmAction = (actionId: string) => {
        const action = detectedActions.find(a => a.id === actionId);
        if (action) {
            setSelectedAction(actionId);
            setTaskTitle(action.text);
            setIsDialogOpen(true);
        }
    };

    const handleCreateTask = () => {
        if (selectedAction && taskTitle.trim()) {
            confirmActionAsTask(selectedAction);
            setIsDialogOpen(false);
            setSelectedAction(null);
            setTaskTitle("");
            setAssignedTo("");
            setDueDate("");
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const minutes = Math.floor(timestamp / 60);
        const seconds = timestamp % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };


    const unconfirmedActions = detectedActions.filter(a => !a.confirmed).slice(-5);

    if (unconfirmedActions.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Action Items Detectados
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Action items serão detectados automaticamente
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border shrink-0">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Action Items Detectados
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    <AnimatePresence mode="popLayout">
                        {unconfirmedActions.map((action, index) => (
                            <motion.div
                                key={action.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <div className="p-3 rounded-lg border border-border bg-card/50 text-xs space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium leading-relaxed">
                                                {action.text}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {formatTimestamp(action.timestamp)}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs h-7"
                                        onClick={() => handleConfirmAction(action.id)}
                                    >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Confirmar como Task
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Criar Task</DialogTitle>
                        <DialogDescription>
                            Confirme os detalhes da task detectada automaticamente
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Título</Label>
                            <Input
                                id="title"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                placeholder="Título da task"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="assigned">Atribuído a</Label>
                            <Select value={assignedTo} onValueChange={setAssignedTo}>
                                <SelectTrigger id="assigned">
                                    <SelectValue placeholder="Selecione um participante" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Não atribuído</SelectItem>
                                    {participants.map((p) => (
                                        <SelectItem key={p.id} value={p.speakerId || p.id}>
                                            {p.name || p.speakerId || p.id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="dueDate">Prazo (opcional)</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreateTask} disabled={!taskTitle.trim()}>
                            Criar Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

