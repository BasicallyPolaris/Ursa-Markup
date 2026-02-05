"use client"

import * as React from "react"
import { Dialog as BaseDialog } from "@base-ui-components/react/dialog"
import { cn } from "../../lib/utils"

function Dialog({
  children,
  open,
  onOpenChange,
  ...props
}: BaseDialog.Root.Props & { 
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <BaseDialog.Root 
      open={open} 
      onOpenChange={(open) => onOpenChange?.(open)}
      {...props}
    >
      {children}
    </BaseDialog.Root>
  )
}

function DialogTrigger({
  className,
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Trigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <BaseDialog.Trigger
        render={(triggerProps) => 
          React.cloneElement(children as React.ReactElement, triggerProps as React.Attributes)
        }
        {...props}
      />
    )
  }

  return (
    <BaseDialog.Trigger className={className} {...props}>
      {children}
    </BaseDialog.Trigger>
  )
}

const DialogPortal = BaseDialog.Portal

function DialogClose({
  className,
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Close> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <BaseDialog.Close
        render={(closeProps) => 
          React.cloneElement(children as React.ReactElement, closeProps as React.Attributes)
        }
        {...props}
      />
    )
  }

  return (
    <BaseDialog.Close className={className} {...props}>
      {children}
    </BaseDialog.Close>
  )
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-overlay/60",
        "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        "transition-opacity duration-150",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof BaseDialog.Popup>, 'children'> & { children?: React.ReactNode }) {
  return (
    <BaseDialog.Portal>
      <DialogOverlay />
      <BaseDialog.Popup
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-panel-border bg-panel-bg text-text-primary p-6 shadow-xl sm:rounded-lg",
          "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
          "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
          "origin-center transition-[opacity,transform] duration-150",
          className
        )}
        {...props}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
