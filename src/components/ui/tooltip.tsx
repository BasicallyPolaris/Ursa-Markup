"use client"

import * as React from "react"
import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip"
import { cn } from "../../lib/utils"

function TooltipProvider({ 
  children,
  delayDuration = 0
}: { 
  children: React.ReactNode 
  delayDuration?: number
}) {
  // Map Radix API to Base UI API
  return (
    <BaseTooltip.Provider delay={delayDuration} closeDelay={0}>
      {children}
    </BaseTooltip.Provider>
  )
}

function Tooltip({
  children,
  ...props
}: BaseTooltip.Root.Props & { children: React.ReactNode }) {
  return (
    <BaseTooltip.Provider delay={0} closeDelay={0}>
      <BaseTooltip.Root {...props}>{children}</BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}

function TooltipTrigger({
  className,
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Trigger> & { asChild?: boolean }) {
  // When asChild is true, use render prop to avoid nested buttons
  if (asChild && React.isValidElement(children)) {
    return (
      <BaseTooltip.Trigger
        data-slot="tooltip-trigger"
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return (
    <BaseTooltip.Trigger
      data-slot="tooltip-trigger"
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </BaseTooltip.Trigger>
  )
}

function TooltipContent({
  className,
  sideOffset = 4,
  side = "top",
  children,
  ...props
}: Omit<React.ComponentProps<typeof BaseTooltip.Popup>, 'children'> & { 
  sideOffset?: number 
  side?: "top" | "bottom" | "left" | "right"
  children?: React.ReactNode
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset} side={side}>
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 overflow-hidden rounded-md bg-panel-bg border border-panel-border px-3 py-1.5 text-xs text-text-primary shadow-lg",
            "data-starting-style:opacity-0 data-starting-style:scale-95",
            "data-ending-style:opacity-0 data-ending-style:scale-95",
            "origin-(--transform-origin) transition-[opacity,transform] duration-150",
            className
          )}
          {...props}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
