import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const toastStore = {
    toasts: [] as Toast[],
    listeners: [] as Array<() => void>,
    add(toast: Omit<Toast, "id">) {
        const id = Math.random().toString(36).substring(7);
        this.toasts = [...this.toasts, { ...toast, id }];
        this.notify();
        setTimeout(() => this.remove(id), toast.duration || 3000);
    },
    remove(id: string) {
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.notify();
    },
    subscribe(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },
    notify() {
        this.listeners.forEach(l => l());
    }
};

export const toast = {
    success: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => 
        toastStore.add({ message, type: "success", duration: options?.duration, action: options?.action }),
    error: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => 
        toastStore.add({ message, type: "error", duration: options?.duration, action: options?.action }),
    info: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => 
        toastStore.add({ message, type: "info", duration: options?.duration, action: options?.action }),
    warning: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => 
        toastStore.add({ message, type: "warning", duration: options?.duration, action: options?.action }),
};

export function Toaster() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const unsubscribe = toastStore.subscribe(() => {
            setToasts([...toastStore.toasts]);
        });
        return unsubscribe;
    }, []);

    const icons = {
        success: CheckCircle2,
        error: AlertCircle,
        info: Info,
        warning: AlertTriangle,
    };

    const colors = {
        success: "bg-green-500/10 border-green-500/20 text-green-500",
        error: "bg-red-500/10 border-red-500/20 text-red-500",
        info: "bg-blue-500/10 border-blue-500/20 text-blue-500",
        warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500",
    };

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
            {toasts.map(toast => {
                const Icon = icons[toast.type];
                return (
                    <div
                        key={toast.id}
                        className={cn(
                            "flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg animate-in slide-in-from-right",
                            colors[toast.type]
                        )}
                    >
                        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{toast.message}</p>
                            {toast.action && (
                                <button
                                    onClick={() => {
                                        toast.action?.onClick();
                                        toastStore.remove(toast.id);
                                    }}
                                    className="mt-2 text-xs underline hover:no-underline font-medium"
                                >
                                    {toast.action.label}
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => toastStore.remove(toast.id)}
                            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
