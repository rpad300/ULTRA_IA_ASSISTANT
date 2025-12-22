import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Eye,
    EyeOff,
    Minimize2,
    Maximize2
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMeetingStore } from "@/store/meetingStore";
import { cn } from "@/lib/utils";

interface AdaptiveLayoutProps {
    panelIds: string[];
    onPanelToggle?: (panelId: string) => void;
}

export function AdaptiveLayout({ panelIds, onPanelToggle }: AdaptiveLayoutProps) {
    const { layoutMode, setLayoutMode, focusedPanels, togglePanelFocus } = useMeetingStore();

    const handleLayoutChange = (mode: 'minimal' | 'detailed' | 'balanced' | 'custom') => {
        setLayoutMode(mode);
        // Force a small delay to ensure state update
        setTimeout(() => {
            // Layout change will trigger re-render
        }, 100);
    };

    const handlePanelToggle = (panelId: string) => {
        togglePanelFocus(panelId);
        onPanelToggle?.(panelId);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2"
                >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">Layout</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Modo de Layout</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={() => handleLayoutChange('minimal')}
                    className={cn(
                        layoutMode === 'minimal' && "bg-accent"
                    )}
                >
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Minimal
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={() => handleLayoutChange('balanced')}
                    className={cn(
                        layoutMode === 'balanced' && "bg-accent"
                    )}
                >
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Balanceado
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={() => handleLayoutChange('detailed')}
                    className={cn(
                        layoutMode === 'detailed' && "bg-accent"
                    )}
                >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Detalhado
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Painéis</DropdownMenuLabel>

                {panelIds.map(panelId => {
                    const isFocused = focusedPanels.includes(panelId);
                    return (
                        <DropdownMenuItem
                            key={panelId}
                            onClick={() => handlePanelToggle(panelId)}
                            className={cn(
                                isFocused && "bg-accent"
                            )}
                        >
                            {isFocused ? (
                                <EyeOff className="h-4 w-4 mr-2" />
                            ) : (
                                <Eye className="h-4 w-4 mr-2" />
                            )}
                            {panelId}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

