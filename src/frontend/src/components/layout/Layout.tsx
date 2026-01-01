import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { GlobalCommandPalette } from "../ui/global-command-palette";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const location = useLocation();
    const isLiveSession = location.pathname.includes('/live') || location.pathname.includes('/transcript');

    return (
        <>
            <Toaster />
            <GlobalCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
            <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
                {/* Sidebar (Fixed width) */}
                <Sidebar />

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
                    {/* Top Bar */}
                    <TopBar />

                    {/* Content Area */}
                    {/* Content Area */}
                    <div className={cn(
                        "flex-1 flex flex-col min-w-0",
                        isLiveSession
                            ? "overflow-y-auto overflow-x-hidden" // Live View: Scrollable (Dynamic Growth)
                            : "overflow-y-auto overflow-x-auto" // Standard props: Scrollable
                    )}>
                        <div className={cn(
                            "flex-1 w-full",
                            isLiveSession ? "min-h-full" : "p-4 md:p-6" // Apply padding only for non-live
                        )}>
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
