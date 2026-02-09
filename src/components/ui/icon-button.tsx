import * as React from "react";
import { cn } from "../../utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: "default" | "sm";
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md transition-all",
          "text-text-muted hover:text-text-primary hover:bg-surface-bg-hover",
          "border border-transparent hover:border-toolbar-border",
          "disabled:opacity-40 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer",
          size === "default" ? "size-8" : "size-7",
          className,
        )}
        {...props}
      >
        {icon}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

export { IconButton };
