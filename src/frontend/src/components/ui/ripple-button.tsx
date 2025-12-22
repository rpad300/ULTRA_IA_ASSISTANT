import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface RippleButtonProps extends ButtonProps {
    rippleColor?: string;
}

export function RippleButton({ className, children, onClick, rippleColor = "rgba(255, 255, 255, 0.3)", ...props }: RippleButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (buttonRef.current && onClick) {
            const button = buttonRef.current;
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const size = Math.max(rect.width, rect.height);

            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: ${rippleColor};
                width: ${size}px;
                height: ${size}px;
                left: ${x - size / 2}px;
                top: ${y - size / 2}px;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;

            button.style.position = 'relative';
            button.style.overflow = 'hidden';
            button.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        }

        onClick?.(e);
    };

    return (
        <Button
            ref={buttonRef}
            className={cn("relative overflow-hidden", className)}
            onClick={handleClick}
            {...props}
        >
            {children}
        </Button>
    );
}

