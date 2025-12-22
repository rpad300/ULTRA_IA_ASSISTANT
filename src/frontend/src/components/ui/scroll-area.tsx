import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, onScroll, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("overflow-auto", className)}
        onScroll={onScroll}
        style={{ scrollbarWidth: 'thin' }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }

