import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { motion } from "framer-motion";

export function VoiceCommandsPanel() {
    const {
        isListening: storeListening,
        toggleVoiceCommands,
        markCriticalMoment,
        pauseSession,
        resumeSession,
        toggleSilentMode,
    } = useMeetingStore();
    const [lastCommand, setLastCommand] = useState<string>("");

    const commands = [
        {
            pattern: /mark.*(important|critical|moment)/i,
            action: () => {
                markCriticalMoment();
                setLastCommand("Marked critical moment");
            },
            description: "Mark this as important"
        },
        {
            pattern: /pause.*(transcription|recording|meeting)/i,
            action: () => {
                pauseSession();
                setLastCommand("Paused transcription");
            },
            description: "Pause transcription"
        },
        {
            pattern: /resume.*(transcription|recording|meeting)/i,
            action: () => {
                resumeSession();
                setLastCommand("Resumed transcription");
            },
            description: "Resume transcription"
        },
        {
            pattern: /(enable|turn on).*silent.*mode/i,
            action: () => {
                if (!useMeetingStore.getState().isSilentMode) {
                    toggleSilentMode();
                }
                setLastCommand("Enabled silent mode");
            },
            description: "Enable silent mode"
        },
        {
            pattern: /(disable|turn off).*silent.*mode/i,
            action: () => {
                if (useMeetingStore.getState().isSilentMode) {
                    toggleSilentMode();
                }
                setLastCommand("Disabled silent mode");
            },
            description: "Disable silent mode"
        },
    ];

    const { transcript } = useVoiceCommands(
        storeListening,
        commands,
        (error) => {
            console.error("Voice command error:", error);
        }
    );

    useEffect(() => {
        if (transcript) {
            console.log("Voice command detected:", transcript);
        }
    }, [transcript]);

    return (
        <Card className="border-border">
            <CardHeader className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-primary" />
                        Voice Commands
                    </CardTitle>
                    <Button
                        variant={storeListening ? "default" : "outline"}
                        size="sm"
                        onClick={toggleVoiceCommands}
                        className="h-7 px-3 text-xs"
                    >
                        {storeListening ? (
                            <>
                                <Mic className="h-3 w-3 mr-1" />
                                Listening
                            </>
                        ) : (
                            <>
                                <MicOff className="h-3 w-3 mr-1" />
                                Start
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {storeListening && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="h-2 w-2 rounded-full bg-primary"
                        />
                        <span className="text-xs text-primary font-medium">Listening for commands...</span>
                    </div>
                )}

                {lastCommand && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-2 rounded-lg bg-green-500/10 border border-green-500/20"
                    >
                        <p className="text-xs text-green-500">✓ {lastCommand}</p>
                    </motion.div>
                )}

                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Available Commands:</p>
                    <ul className="space-y-1.5">
                        {commands.map((cmd, index) => (
                            <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{cmd.description}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {transcript && (
                    <div className="p-2 rounded-lg bg-muted/50 border border-border">
                        <p className="text-[10px] text-muted-foreground mb-1">Last heard:</p>
                        <p className="text-xs font-mono">{transcript}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
