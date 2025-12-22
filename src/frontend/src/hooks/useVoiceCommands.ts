import { useEffect, useState, useRef } from "react";

interface VoiceCommand {
    pattern: RegExp;
    action: () => void;
    description: string;
}

export function useVoiceCommands(
    isEnabled: boolean,
    commands: VoiceCommand[],
    onError?: (error: string) => void
) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const recognitionRef = useRef<any | null>(null);

    useEffect(() => {
        if (!isEnabled) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                setIsListening(false);
            }
            return;
        }

        // Check if browser supports Speech Recognition
        const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognitionCtor) {
            onError?.("Speech recognition not supported in this browser");
            return;
        }

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            const lastResult = event.results[event.results.length - 1];
            const text = lastResult[0].transcript.toLowerCase().trim();

            setTranscript(text);

            // Check commands
            for (const command of commands) {
                if (command.pattern.test(text)) {
                    command.action();
                    break;
                }
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === 'no-speech') {
                // Restart recognition
                setTimeout(() => {
                    if (isEnabled) {
                        recognition.start();
                    }
                }, 1000);
            } else {
                onError?.(event.error);
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            // Restart if still enabled
            if (isEnabled) {
                setTimeout(() => {
                    recognition.start();
                }, 500);
            }
        };

        recognitionRef.current = recognition;

        if (isEnabled) {
            recognition.start();
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isEnabled, commands, onError]);

    return { isListening, transcript };
}

