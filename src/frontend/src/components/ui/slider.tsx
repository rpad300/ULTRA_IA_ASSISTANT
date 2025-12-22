import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps {
    value?: number[];
    min?: number;
    max?: number;
    step?: number;
    onValueChange?: (value: number[]) => void;
    className?: string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, value, onValueChange, ...props }, ref) => {
        // Extract single value for native input
        const singleValue = value && value.length > 0 ? value[0] : 0;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = parseFloat(e.target.value);
            if (onValueChange) {
                onValueChange([val]);
            }
        };

        return (
            <input
                type="range"
                className={cn(
                    "w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950",
                    className
                )}
                ref={ref}
                value={singleValue}
                onChange={handleChange}
                {...props}
            />
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
