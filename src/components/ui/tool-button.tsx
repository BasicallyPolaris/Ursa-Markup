import * as React from "react";
import { cn } from "../../utils";

export interface ToolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon: React.ReactNode;
  label?: string;
}

const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ className, active = false, icon, label: _label, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "size-8 rounded-lg border inline-flex items-center justify-center transition-all",
          "disabled:opacity-40 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          active
            ? "bg-surface-bg-active text-text-primary border-toolbar-border shadow-sm hover:bg-surface-bg-hover"
            : "text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border-transparent",
          className,
        )}
        {...props}
      >
        {icon}
      </button>
    );
  },
);
ToolButton.displayName = "ToolButton";

export { ToolButton };
