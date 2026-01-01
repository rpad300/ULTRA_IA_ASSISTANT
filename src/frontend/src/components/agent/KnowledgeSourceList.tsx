

import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
import { cn } from "@/lib/utils";
import {
    FileText,
    Folder,
    Link as LinkIcon,
    Loader2,
    Check,
    Eye
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"; // Assuming we have shadcn tooltips, if not I'll simplify.

export const KnowledgeSourceList = () => {
    const { knowledgeSources } = useMeetingStore();

    if (knowledgeSources.length === 0) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'folder': return <Folder className="w-4 h-4 text-amber-400" />;
            case 'url': return <LinkIcon className="w-4 h-4 text-blue-400" />;
            default: return <FileText className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <div className="flex flex-col gap-2 mt-2">
            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider px-1">
                Knowledge Context ({knowledgeSources.length})
            </h4>

            <div className="grid grid-cols-1 gap-2">
                <AnimatePresence initial={false}>
                    {/* Reverse to show newest first? Or oldest? Accumulative usually implies newest at bottom but for sources maybe list is fine. */}
                    {knowledgeSources.map((source) => (
                        <motion.div
                            key={source.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={cn(
                                "flex items-center gap-3 p-2 rounded-md border text-sm bg-card/50 backdrop-blur-sm transition-colors",
                                source.status === 'reading' ? "border-indigo-500/50 bg-indigo-500/5" : "border-white/5 hover:bg-white/5"
                            )}
                        >
                            {/* Icon */}
                            <div className="shrink-0 p-1.5 rounded-md bg-white/5">
                                {getIcon(source.type)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className="font-medium text-slate-200 truncate leading-tight">
                                    {source.name}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn(
                                        "text-[10px] font-mono uppercase tracking-wide",
                                        source.status === 'reading' ? "text-indigo-400" :
                                            source.status === 'matched' ? "text-emerald-400" :
                                                "text-slate-500"
                                    )}>
                                        {source.status}
                                    </span>
                                    {/* Confidence Bar if available */}
                                    {source.confidence && (
                                        <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500"
                                                style={{ width: `${source.confidence * 100}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status/Extract Indicator */}
                            <div className="shrink-0">
                                {source.status === 'reading' ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                ) : source.snippet ? (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <div className="p-1 hover:bg-white/10 rounded cursor-help">
                                                    <Eye className="w-4 h-4 text-slate-400" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="left" className="max-w-[300px] bg-slate-900 border-slate-800 text-xs">
                                                <p className="font-mono text-slate-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                                    "{source.snippet}"
                                                </p>
                                                <div className="border-t border-white/10 mt-2 pt-1 text-[10px] text-slate-500">
                                                    Relevant Extract
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : (
                                    <Check className="w-4 h-4 text-slate-600" />
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
