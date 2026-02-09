"use client";

import { Select as BaseSelect } from "@base-ui-components/react/select";
import * as React from "react";
import { cn } from "~/utils";

function Select<Value>({ children, ...props }: BaseSelect.Root.Props<Value>) {
  return <BaseSelect.Root {...props}>{children}</BaseSelect.Root>;
}

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Trigger>) {
  return (
    <BaseSelect.Trigger
      className={cn(
        "flex h-8 items-center justify-between gap-2 rounded-md border border-toolbar-border bg-surface-bg px-3 py-1 text-xs",
        "text-text-primary hover:bg-surface-bg-hover focus:outline-none focus:ring-2 focus:ring-accent-primary/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-popup-open:bg-surface-bg-active",
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="size-4 opacity-50">
        <ChevronDownIcon />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

function SelectValue(props: React.ComponentProps<typeof BaseSelect.Value>) {
  return <BaseSelect.Value {...props} />;
}

function SelectContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof BaseSelect.Popup>, "children"> & {
  children?: React.ReactNode;
}) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4} alignItemWithTrigger={false}>
        <BaseSelect.Popup
          className={cn(
            "z-50 min-w-32 overflow-hidden rounded-md border border-toolbar-border bg-panel-bg p-1 shadow-lg",
            "data-starting-style:opacity-0 data-starting-style:scale-95",
            "data-ending-style:opacity-0 data-ending-style:scale-95",
            "origin-(--transform-origin) transition-[opacity,transform] duration-150",
            className,
          )}
          {...props}
        >
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none",
        "text-text-primary hover:bg-surface-bg-hover",
        "data-highlighted:bg-surface-bg-active",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSelect.ItemIndicator className="absolute left-0 w-6 flex items-center justify-center">
        <CheckIcon className="size-3" />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText className="pl-5">{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
