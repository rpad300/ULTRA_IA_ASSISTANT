import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, Target, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";

interface GaugeProps {
    value: number;
    label: string;
    icon: React.ReactNode;
}

function Gauge({ value, label, icon }: GaugeProps) {
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (value / 100) * circumference;

    const getColorClass = (val: number) => {
        if (val >= 80) return "text-green-500";
        if (val >= 60) return "text-yellow-500";
        return "text-red-500";
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative">
                <svg className="transform -rotate-90 w-24 h-24">
                    <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-muted"
                    />
                    <motion.circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className={getColorClass(value)}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("text-lg font-bold", getColorClass(value))}>
                        {value}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {icon}
                <span>{label}</span>
            </div>
        </div>
    );
}

export function MeetingHealthScore() {
    const { meetingHealth } = useMeetingStore();

    useEffect(() => {
        const store = useMeetingStore.getState();
        store.updateMeetingHealth(); // Initial update

        // Optimized: Only update every 20 seconds instead of 10
        const interval = setInterval(() => {
            useMeetingStore.getState().updateMeetingHealth();
        }, 20000); // Optimized: Update every 20 seconds (was 10)

        return () => clearInterval(interval);
    }, []); // Only run once on mount

    if (!meetingHealth) {
        return (
            <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Meeting Health
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground text-center py-4">
                        Health score will appear once the meeting starts
                    </p>
                </CardContent>
            </Card>
        );
    }

    const getOverallColor = (score: number) => {
        if (score >= 80) return "bg-green-500/10 text-green-500 border-green-500/20";
        if (score >= 60) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
        return "bg-red-500/10 text-red-500 border-red-500/20";
    };

    const getTrend = (score: number) => {
        if (score >= 80) return <TrendingUp className="h-3 w-3" />;
        if (score >= 60) return <Minus className="h-3 w-3" />;
        return <TrendingDown className="h-3 w-3" />;
    };

    return (
        <Card className="border-border">
            <CardHeader className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Meeting Health
                    </CardTitle>
                    <Badge variant="outline" className={cn("text-xs", getOverallColor(meetingHealth.overall))}>
                        {getTrend(meetingHealth.overall)}
                        <span className="ml-1">{meetingHealth.overall}/100</span>
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                    <Gauge
                        value={meetingHealth.engagement}
                        label="Engagement"
                        icon={<MessageSquare className="h-3 w-3" />}
                    />
                    <Gauge
                        value={meetingHealth.clarity}
                        label="Clarity"
                        icon={<Target className="h-3 w-3" />}
                    />
                    <Gauge
                        value={meetingHealth.progress}
                        label="Progress"
                        icon={<TrendingUp className="h-3 w-3" />}
                    />
                    <Gauge
                        value={meetingHealth.participation}
                        label="Participation"
                        icon={<Users className="h-3 w-3" />}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

