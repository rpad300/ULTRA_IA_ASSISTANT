
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SignalHealthProps {
    status: 'excellent' | 'good' | 'poor' | 'none';
    className?: string;
}

export function SignalHealthIndicator({ status, className }: SignalHealthProps) {

    const getConfig = () => {
        switch (status) {
            case 'excellent':
                return {
                    label: 'Excellent Signal',
                    color: 'text-emerald-500',
                    bg: 'bg-emerald-500/10',
                    border: 'border-emerald-500/20',
                    icon: Wifi
                };
            case 'good':
                return {
                    label: 'Stable Signal',
                    color: 'text-indigo-400',
                    bg: 'bg-indigo-500/10',
                    border: 'border-indigo-500/20',
                    icon: Wifi
                };
            case 'poor':
                return {
                    label: 'Poor Connection',
                    color: 'text-amber-500',
                    bg: 'bg-amber-500/10',
                    border: 'border-amber-500/20',
                    icon: Activity
                };
            default:
                return {
                    label: 'No Signal',
                    color: 'text-zinc-500',
                    bg: 'bg-zinc-500/5',
                    border: 'border-zinc-500/10',
                    icon: WifiOff
                };
        }
    };

    const config = getConfig();
    const Icon = config.icon;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors",
                        config.bg, config.border,
                        className
                    )}>
                        <Icon className={cn("w-3 h-3", config.color)} />
                        {status !== 'none' && (
                            <div className="flex gap-0.5 items-end h-3">
                                <div className={cn("w-0.5 rounded-full transition-all duration-500", config.color, status === 'excellent' ? "h-full" : "h-1/2 opacity-50", "bg-current")} />
                                <div className={cn("w-0.5 rounded-full transition-all duration-500", config.color, (status === 'good' || status === 'excellent') ? "h-3/4" : "h-1/3 opacity-50", "bg-current")} />
                                <div className={cn("w-0.5 rounded-full transition-all duration-500", config.color, status === 'excellent' ? "h-full" : "h-1/4 opacity-30", "bg-current")} />
                            </div>
                        )}
                        <span className={cn("text-[10px] font-medium uppercase tracking-wider", config.color)}>
                            {status === 'none' ? 'Offline' : status}
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>{config.label} - {status === 'none' ? 'Audio stream inactive' : 'Quality check active'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
