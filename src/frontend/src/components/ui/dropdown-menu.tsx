import * as React from "react"
import { cn } from "@/lib/utils"

// Simplified Dropdown for MVP without Radix

const DropdownContext = React.createContext<{
    open: boolean
    toggle: () => void
    close: () => void
}>({ open: false, toggle: () => { }, close: () => { } })

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false)
    const toggle = () => setOpen(!open)
    const close = () => setOpen(false)

    // Close on outside click is tricky here without refs/listeners, 
    // but let's assume simple toggle for MVP or add a backdrop.
    // Adding a transparent backdrop when open to handle outside clicks.

    return (
        <DropdownContext.Provider value={{ open, toggle, close }}>
            <div className="relative inline-block text-left">
                {children}
                {open && <div className="fixed inset-0 z-30" onClick={close}></div>}
            </div>
        </DropdownContext.Provider>
    )
}

export const DropdownMenuTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
    const { toggle } = React.useContext(DropdownContext)

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: (e: any) => {
                e.stopPropagation();
                toggle();
                (children as React.ReactElement<any>).props.onClick?.(e);
            }
        })
    }

    return (
        <button
            ref={ref}
            className={className}
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            {...props}
        >
            {children}
        </button>
    )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

export const DropdownMenuContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" | "center" }
>(({ className, align = "center", ...props }, ref) => {
    const { open } = React.useContext(DropdownContext)
    if (!open) return null

    return (
        <div
            ref={ref}
            className={cn(
                "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                align === "end" ? "right-0" : "left-0",
                "top-full mt-2",
                className
            )}
            {...props}
        />
    )
})
DropdownMenuContent.displayName = "DropdownMenuContent"

export const DropdownMenuItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => {
    const { close } = React.useContext(DropdownContext)
    return (
        <div
            ref={ref}
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                inset && "pl-8",
                className
            )}
            onClick={(e) => {
                close();
                props.onClick?.(e);
            }}
            {...props}
        />
    )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

export const DropdownMenuSeparator = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    return (
        <div
            ref={ref}
            className={cn("my-1 h-px bg-border", className)}
            {...props}
        />
    )
})
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export const DropdownMenuLabel = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                "px-2 py-1.5 text-sm font-semibold",
                inset && "pl-8",
                className
            )}
            {...props}
        />
    )
})
DropdownMenuLabel.displayName = "DropdownMenuLabel"