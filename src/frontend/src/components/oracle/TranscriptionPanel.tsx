
import React, { useEffect, useRef } from 'react';
import { useOracleStore } from '../../store/useOracleStore';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { MessageSquare, User } from 'lucide-react';
import { SpeakerRefinementModal } from './identity/SpeakerRefinementModal';
import { useState } from 'react';

export const TranscriptionPanel: React.FC = () => {
    const transcripts = useOracleStore(state => state.transcripts);
    const speakers = useOracleStore(state => state.speakers);
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Modal State
    const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSpeakerClick = (speakerId: string) => {
        setSelectedSpeaker(speakerId);
        setIsModalOpen(true);
    };

    // Auto-scroll logic
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcripts.length, transcripts[transcripts.length - 1]?.text]);

    const getSpeakerName = (id: string) => {
        // Check manual map first, else raw ID
        return speakers[id] || id;
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden relative">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur z-10 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    LIVE TRANSCRIPT
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                    {transcripts.length} EVENTS
                </span>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="flex flex-col gap-4 pb-24">
                    {/* pb-24 for TelemetryBar space */}
                    {transcripts.map((msg, idx) => (
                        <div key={msg.trace_id || idx} className="group flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Avatar className="w-8 h-8 mt-1 border border-slate-700">
                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${msg.speaker}`} />
                                <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                            </Avatar>

                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-xs font-bold text-emerald-400 cursor-pointer hover:underline"
                                        onClick={() => handleSpeakerClick(msg.speaker)}
                                    >
                                        {getSpeakerName(msg.speaker)}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-mono">
                                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString()}
                                    </span>
                                    {msg.confidence < 1 && (
                                        <span className={cn(
                                            "text-[9px] font-mono px-1 rounded",
                                            msg.confidence > 0.8 ? "text-slate-500 bg-slate-800" :
                                                msg.confidence > 0.6 ? "text-amber-500 bg-amber-500/10" :
                                                    "text-red-500 bg-red-500/10"
                                        )}>
                                            {Math.round(msg.confidence * 100)}%
                                        </span>
                                    )}
                                    {!msg.is_final && (
                                        <span className="text-[10px] text-amber-500 animate-pulse">
                                            LISTENING...
                                        </span>
                                    )}
                                </div>
                                <div
                                    className={cn("text-sm leading-relaxed text-slate-300 p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl bg-slate-800/50 border border-slate-800",
                                        !msg.is_final && "border-amber-500/30 bg-amber-500/5"
                                    )}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </ScrollArea>

            {selectedSpeaker && (
                <SpeakerRefinementModal
                    guestId={selectedSpeaker}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};
