import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Monitor,
    Save,
    Command,
    Focus,
    Check,
    Eye,
    EyeOff,
    Smartphone
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMeetingStore } from "@/store/meetingStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { PanelId } from "@/types/slices/ui";

// --- Visual Blueprints (Mini-Layouts) ---

const BlueprintMinimal = () => (
    <div className="grid grid-cols-1 gap-0.5 w-6 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
        <div className="bg-current rounded-[1px] h-full w-full" />
    </div>
);

const BlueprintBalanced = () => (
    <div className="grid grid-cols-4 gap-0.5 w-6 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
        <div className="col-span-1 bg-current rounded-[1px] h-full w-full opacity-50" />
        <div className="col-span-2 bg-current rounded-[1px] h-full w-full" />
        <div className="col-span-1 bg-current rounded-[1px] h-full w-full opacity-50" />
    </div>
);

const BlueprintDetailed = () => (
    <div className="grid grid-cols-4 grid-rows-2 gap-0.5 w-6 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
        <div className="col-span-1 row-span-2 bg-current rounded-[1px] h-full w-full opacity-50" />
        <div className="col-span-2 row-span-2 bg-current rounded-[1px] h-full w-full" />
        <div className="col-span-1 bg-current rounded-[1px] h-full w-full opacity-50" />
        <div className="col-span-1 bg-current rounded-[1px] h-full w-full opacity-50" />
    </div>
);


interface AdaptiveLayoutProps {
    panelIds: PanelId[];
    onPanelToggle?: (panelId: PanelId) => void;
    className?: string;
}

export function AdaptiveLayout({ panelIds, onPanelToggle, className }: AdaptiveLayoutProps) {
    const {
        layoutMode,
        setLayoutMode,
        focusedPanels,
        togglePanelFocus,
        isZenMode,
        toggleZenMode,
        isScreenSharing,
        setScreenSharing
    } = useMeetingStore();

    const [screenSize, setScreenSize] = useState<{ width: number; height: number }>({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080
    });

    // --- Adaptive Intelligence ---

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setScreenSize({ width, height });

            // Auto-switch to Minimal on small screens if not already manually set
            if (width < 1024 && width > 0 && layoutMode !== 'minimal') {
                setLayoutMode('minimal');
                announceChange("Layout adaptado para ecrã pequeno.", "polite");
            }
        };

        // Initialize size if window exists (client-side)
        if (typeof window !== 'undefined') {
            handleResize();
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [layoutMode, setLayoutMode]);

    useEffect(() => {
        if (isScreenSharing && layoutMode !== 'minimal') {
            setLayoutMode('minimal');
            announceChange("Modo de partilha de ecrã detetado. Layout minimal ativado.", "assertive");
        }
    }, [isScreenSharing, layoutMode, setLayoutMode]);

    // --- Keyboard Shortcuts ---

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
                e.preventDefault();
                cycleLayout();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault();
                toggleZenMode();
                announceChange(isZenMode ? "Modo Zen desativado" : "Modo Zen ativado", "assertive");
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [layoutMode, isZenMode]);

    const cycleLayout = () => {
        const modes: Array<'minimal' | 'balanced' | 'detailed' | 'zen'> = ['minimal', 'balanced', 'detailed', 'zen'];
        const currentIndex = modes.indexOf(layoutMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        handleLayoutChange(nextMode);
    };

    const handleLayoutChange = (mode: 'minimal' | 'detailed' | 'balanced' | 'zen') => {
        setLayoutMode(mode);
        announceChange(`Layout alterado para modo ${mode}.`, "polite");
    };

    const handlePanelToggle = (panelId: PanelId) => {
        togglePanelFocus(panelId);
        onPanelToggle?.(panelId);
    };

    const announceChange = (message: string, ariaLive: "polite" | "assertive" = "polite") => {
        const announcer = document.getElementById('layout-announcer');
        if (announcer) {
            announcer.textContent = message;
            announcer.setAttribute('aria-live', ariaLive);
        }
    };

    const handleSaveDefault = () => {
        localStorage.setItem('defaultLayout', layoutMode);
        localStorage.setItem('defaultPanels', JSON.stringify(focusedPanels));
        announceChange("Layout salvo como predefinição.", "polite");
    };

    return (
        <>
            <div id="layout-announcer" className="sr-only" aria-live="polite"></div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-9 gap-2 transition-all duration-300 border border-white/10 hover:bg-white/10",
                            isZenMode && "ring-2 ring-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)] bg-primary/10",
                            className
                        )}
                        aria-label="Opções de layout e visualização"
                    >
                        <motion.div
                            animate={{ rotate: isZenMode ? 180 : 0 }}
                            transition={{ duration: 0.4, type: "spring" }}
                        >
                            {isZenMode ? <Focus className="h-4 w-4 text-primary animate-pulse" /> : <LayoutDashboard className="h-4 w-4" />}
                        </motion.div>

                        <span className="hidden sm:inline font-medium">
                            {isZenMode ? "Zen Mode" : "Layout"}
                        </span>

                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full ml-1 shadow-[0_0_5px_currentColor]",
                            layoutMode === 'minimal' && "bg-blue-400 text-blue-400",
                            layoutMode === 'balanced' && "bg-green-400 text-green-400",
                            layoutMode === 'detailed' && "bg-purple-400 text-purple-400",
                        )} />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    className="w-72 backdrop-blur-xl bg-background/80 border-white/10 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                            Command Center
                        </span>
                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                            {/* Viewport Analytics using screenSize */}
                            <span className="flex items-center gap-1 border border-white/5 rounded px-1 bg-black/5">
                                {screenSize.width < 768 ? <Smartphone className="h-2.5 w-2.5" /> : <Monitor className="h-2.5 w-2.5" />}
                                {screenSize.width}px
                            </span>
                            {/* Shortcut Hint */}
                            <div className="flex items-center gap-1 border border-white/5 rounded px-1.5 bg-black/5">
                                <Command className="h-3 w-3 mr-1" />
                                <span>J</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-1">
                        <MenuItem
                            active={layoutMode === 'minimal'}
                            onClick={() => handleLayoutChange('minimal')}
                        >
                            <div className="flex items-center gap-3 w-full group">
                                <div className="p-1.5 bg-background/50 rounded-md border border-white/5 group-hover:border-primary/20 transition-colors">
                                    <BlueprintMinimal />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-sm font-medium">Minimal</span>
                                    <span className="text-[10px] text-muted-foreground">Foco no conteúdo principal</span>
                                </div>
                                {layoutMode === 'minimal' && <ActiveBadge />}
                            </div>
                        </MenuItem>

                        <MenuItem
                            active={layoutMode === 'balanced'}
                            onClick={() => handleLayoutChange('balanced')}
                        >
                            <div className="flex items-center gap-3 w-full group">
                                <div className="p-1.5 bg-background/50 rounded-md border border-white/5 group-hover:border-primary/20 transition-colors">
                                    <BlueprintBalanced />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-sm font-medium">Balanceado</span>
                                    <span className="text-[10px] text-muted-foreground">Dashboard padrão</span>
                                </div>
                                {layoutMode === 'balanced' && <ActiveBadge />}
                            </div>
                        </MenuItem>

                        <MenuItem
                            active={layoutMode === 'detailed'}
                            onClick={() => handleLayoutChange('detailed')}
                        >
                            <div className="flex items-center gap-3 w-full group">
                                <div className="p-1.5 bg-background/50 rounded-md border border-white/5 group-hover:border-primary/20 transition-colors">
                                    <BlueprintDetailed />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-sm font-medium">Detalhado</span>
                                    <span className="text-[10px] text-muted-foreground">Todos os painéis visíveis</span>
                                </div>
                                {layoutMode === 'detailed' && <ActiveBadge />}
                            </div>
                        </MenuItem>
                    </div>

                    <DropdownMenuSeparator className="bg-white/10 my-2" />

                    <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                            Foco & Estado
                        </span>
                        <div className="flex gap-1 text-[10px] text-muted-foreground border border-white/5 rounded px-1.5 py-0.5 bg-black/5">
                            <Command className="h-3 w-3 mr-1" />
                            <span>B</span>
                        </div>
                    </div>

                    <DropdownMenuItem
                        onClick={toggleZenMode}
                        className={cn(
                            "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[disabled]:opacity-50 hover:bg-accent focus:bg-accent",
                            isZenMode ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
                        )}
                    >
                        <Focus className={cn("mr-2 h-4 w-4", isZenMode && "animate-pulse")} />
                        <span className="flex-1">Zen Mode</span>
                        {isZenMode && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => setScreenSharing(!isScreenSharing)}
                        className={cn(
                            "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:opacity-50 hover:bg-accent focus:bg-accent mt-1",
                            isScreenSharing && "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                        )}
                    >
                        <Monitor className="mr-2 h-4 w-4" />
                        <span className="flex-1">Partilha de Ecrã</span>
                        {isScreenSharing && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/20 rounded uppercase">On</span>}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-white/10 my-2" />

                    <div className="px-2 py-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">
                            Painéis Individuais
                        </span>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                            {panelIds.map(panelId => {
                                // Explicitly cast if needed, but here we strictly rely on panelId being compliant
                                const isFocused = focusedPanels.includes(panelId);
                                return (
                                    <div
                                        key={panelId}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePanelToggle(panelId);
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer border text-xs transition-all",
                                            isFocused
                                                ? "bg-accent text-accent-foreground border-white/10"
                                                : "text-muted-foreground border-transparent hover:bg-accent/50"
                                        )}
                                    >
                                        {isFocused ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 opacity-50" />}
                                        <span className="truncate capitalize">{panelId}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <DropdownMenuSeparator className="bg-white/10 my-2" />

                    <div className="px-2 pb-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full text-xs h-7 justify-start bg-secondary/50 hover:bg-secondary/80"
                            onClick={handleSaveDefault}
                        >
                            <Save className="h-3 w-3 mr-2" />
                            Salvar como Predefinição
                        </Button>
                    </div>

                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

// Helper Components

function MenuItem({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
    return (
        <DropdownMenuItem
            onClick={onClick}
            className={cn(
                "relative p-2 cursor-pointer transition-all duration-200 border border-transparent",
                active ? "bg-accent/80 shadow-inner border-white/5" : "hover:bg-accent/40 opacity-70 hover:opacity-100"
            )}
        >
            {children}
            {active && (
                <motion.div
                    layoutId="active-glow"
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                />
            )}
        </DropdownMenuItem>
    );
}

function ActiveBadge() {
    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-auto"
        >
            <div className="bg-primary/20 text-primary rounded-full p-0.5">
                <Check className="h-3 w-3" />
            </div>
        </motion.div>
    );
}
