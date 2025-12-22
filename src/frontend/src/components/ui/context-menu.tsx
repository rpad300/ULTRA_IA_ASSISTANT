import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ContextMenuOption {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: "default" | "destructive";
}

interface ContextMenuProps {
    options: ContextMenuOption[];
    children: React.ReactNode;
    className?: string;
}

export function ContextMenu({ options, children, className }: ContextMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            if (containerRef.current?.contains(e.target as Node)) {
                e.preventDefault();
                setPosition({ x: e.clientX, y: e.clientY });
                setIsOpen(true);
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener("contextmenu", handleContextMenu);
        }
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleEscape);

        return () => {
            if (container) {
                container.removeEventListener("contextmenu", handleContextMenu);
            }
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    useEffect(() => {
        if (isOpen && menuRef.current) {
            const menu = menuRef.current;
            const rect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let x = position.x;
            let y = position.y;

            // Adjust if menu would go off screen
            if (x + rect.width > viewportWidth) {
                x = viewportWidth - rect.width - 10;
            }
            if (y + rect.height > viewportHeight) {
                y = viewportHeight - rect.height - 10;
            }

            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
        }
    }, [isOpen, position]);

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            {children}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        ref={menuRef}
                        className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-lg p-1 animate-in fade-in zoom-in-95"
                        style={{ left: position.x, top: position.y }}
                    >
                        {options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    if (!option.disabled) {
                                        option.onClick();
                                        setIsOpen(false);
                                    }
                                }}
                                disabled={option.disabled}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2",
                                    option.disabled
                                        ? "opacity-50 cursor-not-allowed"
                                        : "hover:bg-accent cursor-pointer",
                                    option.variant === "destructive" && "text-destructive hover:bg-destructive/10"
                                )}
                            >
                                {option.icon}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

