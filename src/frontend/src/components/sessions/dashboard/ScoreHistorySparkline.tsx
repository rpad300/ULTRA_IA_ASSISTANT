
import { useMeetingStore } from "@/store/meetingStore";
import { SCORE_COLORS } from "@/utils/meeting-quality-utils";
import { useMemo } from "react";

export function ScoreHistorySparkline({ className }: { className?: string }) {
    const history = useMeetingStore(state => state.qualityScoreHistory);

    const pathData = useMemo(() => {
        if (!history || history.length < 2) return "";

        const width = 100;
        const height = 30;
        const minScore = 0; // Fixed scale for stability
        const maxScore = 100;

        const points = history.map((point, index) => {
            const x = (index / (history.length - 1)) * width;
            // Invert Y because SVG 0 is top
            const y = height - ((point.overall - minScore) / (maxScore - minScore)) * height;
            return `${x},${y}`;
        });

        return `M ${points.join(" L ")}`;
    }, [history]);

    if (!history || history.length < 2) return null;

    // determine gradient color based on latest trend
    const latestScore = history[history.length - 1].overall;
    const isHigh = latestScore >= 70;

    return (
        <div className={className}>
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <path
                    d={pathData}
                    fill="none"
                    stroke={isHigh ? SCORE_COLORS.excellent : SCORE_COLORS.warning}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
                {/* Fill area logic could come here if needed, but line is cleaner for 'Sparkline' */}
            </svg>
        </div>
    );
}
