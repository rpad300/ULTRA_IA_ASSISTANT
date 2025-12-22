import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ContactHealthBadgeProps {
    meetingsCount: number;
    tasksCount: number;
    projectsInCommon: number;
}

export function ContactHealthBadge({ 
    meetingsCount, 
    tasksCount, 
    projectsInCommon 
}: ContactHealthBadgeProps) {
    const healthScore = Math.min(100, 
        (meetingsCount * 5) + (projectsInCommon * 15) + (tasksCount * 3)
    );
    
    const getHealthStatus = () => {
        if (healthScore >= 80) return { label: 'Excellent', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
        if (healthScore >= 60) return { label: 'Good', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
        if (healthScore >= 40) return { label: 'Fair', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
        return { label: 'Needs Attention', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    };
    
    const status = getHealthStatus();
    const trend = meetingsCount > 5 ? 'up' : meetingsCount < 2 ? 'down' : 'stable';
    
    return (
        <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", status.color)}>
                {status.label}
            </Badge>
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-400" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
            {trend === 'stable' && <Minus className="h-3 w-3 text-gray-400" />}
        </div>
    );
}

