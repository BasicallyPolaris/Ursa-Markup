"use client";

import { Popover as BasePopover } from "@base-ui-components/react/popover";
import * as React from "react";
import { cn } from "../../utils";

function Popover({
  children,
  ...props
}: BasePopover.Root.Props & { children?: React.ReactNode }) {
  return (
    <BasePopover.Root data-slot="popover" {...props}>
      {children}
    </BasePopover.Root>
  );
}

function PopoverTrigger({
  className,
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof BasePopover.Trigger> & { asChild?: boolean }) {
  // Base UI uses render prop instead of asChild
  if (asChild && React.isValidElement(children)) {
    return (
      <BasePopover.Trigger
        data-slot="popover-trigger"
        render={(triggerProps) =>
          React.cloneElement(
            children as React.ReactElement,
            triggerProps as React.Attributes,
          )
        }
        {...props}
      />
    );
  }

  return (
    <BasePopover.Trigger
      data-slot="popover-trigger"
      className={className}
      {...props}
    >
      {children}
    </BasePopover.Trigger>
  );
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  side = "bottom",
  children,
  ...props
}: Omit<React.ComponentProps<typeof BasePopover.Popup>, "children"> & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
  children?: React.ReactNode;
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner sideOffset={sideOffset} side={side} align={align}>
        <BasePopover.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
            "data-starting-style:opacity-0 data-starting-style:scale-95",
            "data-ending-style:opacity-0 data-ending-style:scale-95",
            "origin-(--transform-origin) transition-[opacity,transform] duration-150",
            className,
          )}
          {...props}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

// Note: Base UI doesn't have a direct Anchor equivalent
// The anchor functionality is handled by the Trigger or through positioning
function PopoverAnchor({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="popover-anchor" className={className} {...props}>
      {children}
    </div>
  );
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
