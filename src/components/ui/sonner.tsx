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
            "flex items-center gap-3 w-full px-4 py-3 rounded-lg shadow-2xl border bg-[hsl(0_0%_22%)] border-[hsl(0_0%_32%)]",
          title: "text-white font-medium text-sm",
          description: "text-[hsl(0_0%_70%)] text-xs mt-0.5",
          success:
            "border-[hsl(142_70%_40%/0.5)] [&>svg]:text-[hsl(142_70%_50%)] [&>svg]:w-5 [&>svg]:h-5 [&>svg]:shrink-0",
          error:
            "border-[hsl(0_70%_50%/0.5)] [&>svg]:text-[hsl(0_70%_60%)] [&>svg]:w-5 [&>svg]:h-5 [&>svg]:shrink-0",
          actionButton:
            "bg-accent-primary text-white hover:bg-accent-primary/90 px-3 py-1.5 rounded text-xs font-medium",
          cancelButton:
            "bg-[hsl(0_0%_28%)] text-[hsl(0_0%_70%)] hover:bg-[hsl(0_0%_32%)] px-3 py-1.5 rounded text-xs",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
