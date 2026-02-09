"use client";

import { cn } from "../../utils";

type ColorSwatchProps = {
  /** The color to display */
  color: string;
  /** Size of the swatch in pixels */
  size?: "sm" | "md" | "lg";
  /** Whether the swatch is currently selected */
  selected?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Optional title/tooltip */
  title?: string;
};

const sizeClasses = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

/**
 * ColorSwatch - A reusable component for displaying color swatches
 *
 * Used for:
 * - Color palette previews in settings
 * - Color picker buttons in toolbar
 * - Anywhere a color needs to be displayed as a swatch
 */
export function ColorSwatch({
  color,
  size = "md",
  selected = false,
  onClick,
  className,
  title,
}: ColorSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-full transition-all shrink-0",
        sizeClasses[size],
        "border border-text-primary/20",
        selected
          ? "ring-2 ring-text-primary/60 ring-offset-2 ring-offset-toolbar-bg-secondary scale-110"
          : "hover:scale-105 hover:ring-2 hover:ring-text-primary/30",
        onClick && "cursor-pointer",
        className,
      )}
      style={{
        backgroundColor: color,
        boxShadow: selected ? "0 2px 8px hsl(var(--shadow-color))" : "none",
      }}
    />
  );
}

export default ColorSwatch;
