import { useState, useCallback } from "react";

interface RetryOptions {
    maxRetries?: number;
    delay?: number;
    onRetry?: (attempt: number) => void;
}

export function useRetry<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
) {
    const { maxRetries = 3, delay = 1000, onRetry } = options;
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const executeWithRetry = useCallback(
        async (...args: Parameters<T>): Promise<ReturnType<T>> => {
            let lastError: Error | null = null;
            
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        setIsRetrying(true);
                        setRetryCount(attempt);
                        onRetry?.(attempt);
                        await new Promise(resolve => setTimeout(resolve, delay * attempt));
                    }
                    
                    const result = await fn(...args);
                    setIsRetrying(false);
                    setRetryCount(0);
                    return result;
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    
                    // Don't retry on 4xx errors (client errors)
                    if (error && typeof error === 'object' && 'response' in error) {
                        const status = (error as any).response?.status;
                        if (status >= 400 && status < 500) {
                            throw error;
                        }
                    }
                    
                    if (attempt === maxRetries) {
                        setIsRetrying(false);
                        setRetryCount(0);
                        throw lastError;
                    }
                }
            }
            
            throw lastError || new Error("Max retries exceeded");
        },
        [fn, maxRetries, delay, onRetry]
    );

    return { executeWithRetry, isRetrying, retryCount };
}

