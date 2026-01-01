import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// OKLCH Color Generator for Speaker Identity
// Generates distinct, accessible colors based on speaker name hash
export const getSpeakerColor = (speaker: string) => {
    if (!speaker) return "bg-gray-500/10 text-gray-500 border-gray-500/20";

    // Simple string hash
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
        hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Predefined OKLCH palette for high contrast and pleasant aesthetics
    // Utilizing Tailwind classes that map to these styles if properly set up, 
    // or return direct classes. For now, we use a robust list of standard Tailwind colors.
    const colors = [
        "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
        "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
        "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
        "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
        "bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400",
        "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400",
        "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
        "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
        "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400",
        "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    ];

    return colors[Math.abs(hash) % colors.length];
};

export const getSentimentStyles = (sentiment?: string) => {
    if (!sentiment) return "";
    switch (sentiment) {
        case 'positive': return "border-l-green-500 bg-green-50/50 dark:bg-green-950/10";
        case 'negative': return "border-l-red-500 bg-red-50/50 dark:bg-red-950/10";
        default: return "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/10";
    }
};
