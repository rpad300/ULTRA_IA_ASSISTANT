export function formatRelativeTime(date: Date | string): string {
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks}w ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        return `${diffInMonths}mo ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
}

export function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatMessageTime(date: Date | string): string {
    const then = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInHours = (now.getTime() - then.getTime()) / (1000 * 60 * 60);

    // If less than 24 hours, show relative time
    if (diffInHours < 24) {
        return formatRelativeTime(then);
    }

    // If same year, show date without year
    if (then.getFullYear() === now.getFullYear()) {
        return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Otherwise show full date
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

