import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const toolbarButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover",
        active: "bg-surface-bg-active text-text-primary",
        ghost: "text-text-muted hover:text-text-primary hover:bg-surface-bg-hover",
      },
      size: {
        default: "h-8 px-3 py-2 rounded-md",
        icon: "h-8 w-8 rounded-md",
        sm: "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toolbarButtonVariants> {
  asChild?: boolean;
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(toolbarButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
ToolbarButton.displayName = "ToolbarButton";

export { ToolbarButton, toolbarButtonVariants };
