import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster component wrapper for Sonner
 * Positioned at bottom-right with app theme styling
 * Uses a lighter background to stand out against the dark canvas
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-full px-4 py-3 rounded-lg shadow-2xl border bg-surface-bg border-toolbar-border",
          title: "text-text-primary font-medium text-sm",
          description: "text-text-muted text-xs mt-0.5",
          success:
            "border-success/50 [&>svg]:text-success [&>svg]:w-5 [&>svg]:h-5 [&>svg]:shrink-0",
          error:
            "border-destructive/50 [&>svg]:text-destructive [&>svg]:w-5 [&>svg]:h-5 [&>svg]:shrink-0",
          actionButton:
            "bg-accent-primary text-accent-primary-fg hover:bg-accent-primary/90 px-3 py-1.5 rounded text-xs font-medium",
          cancelButton:
            "bg-toolbar-bg-secondary text-text-muted hover:bg-surface-bg-hover px-3 py-1.5 rounded text-xs",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
