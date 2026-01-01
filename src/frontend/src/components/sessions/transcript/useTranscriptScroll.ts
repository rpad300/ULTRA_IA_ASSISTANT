import { useState, useCallback, useEffect } from "react";
import type { RefObject } from "react";

interface UseTranscriptScrollProps {
    parentRef: RefObject<HTMLDivElement | null>;
    dataLength: number;
}

export function useTranscriptScroll({ parentRef, dataLength }: UseTranscriptScrollProps) {
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showJumpToLive, setShowJumpToLive] = useState(false);
    const [userHasScrolled, setUserHasScrolled] = useState(false);

    // Check if user is at the bottom
    const checkScrollPosition = useCallback(() => {
        if (!parentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = parentRef.current;

        // 50px threshold for "at bottom"
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;

        setIsAtBottom(isNearBottom);

        // If not at bottom and we have data, show "Jump to Live"
        // Also track if user intentionally scrolled up
        if (!isNearBottom) {
            setUserHasScrolled(true);
            setShowJumpToLive(true);
        } else {
            setUserHasScrolled(false);
            setShowJumpToLive(false);
        }
    }, [parentRef]);

    // Attach listener
    useEffect(() => {
        const element = parentRef.current;
        if (!element) return;

        element.addEventListener('scroll', checkScrollPosition);
        return () => element.removeEventListener('scroll', checkScrollPosition);
    }, [parentRef, checkScrollPosition]);

    // Auto-scroll effect
    useEffect(() => {
        // Only auto-scroll if we were already at the bottom 
        // OR if the user hasn't manually scrolled up yet (initial load)
        if (isAtBottom && dataLength > 0 && parentRef.current) {
            parentRef.current.scrollTo({
                top: parentRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [dataLength, isAtBottom]);

    const jumpToLive = useCallback(() => {
        if (parentRef.current) {
            parentRef.current.scrollTo({
                top: parentRef.current.scrollHeight,
                behavior: 'smooth'
            });
            setIsAtBottom(true);
            setUserHasScrolled(false);
        }
    }, [parentRef]);

    return {
        isAtBottom,
        showJumpToLive,
        jumpToLive,
        userHasScrolled
    };
}
