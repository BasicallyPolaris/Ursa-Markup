"use client";

import { Switch as BaseSwitch } from "@base-ui-components/react/switch";
import * as React from "react";
import { cn } from "~/utils";

type SwitchProps = {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  id?: string;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { className, checked, defaultChecked, onCheckedChange, disabled, ...props },
    ref,
  ) => (
    <BaseSwitch.Root
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(newChecked) => onCheckedChange?.(newChecked)}
      disabled={disabled}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-toggle-checked data-unchecked:bg-toggle-unchecked",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-text-primary shadow-lg ring-0 transition-transform data-checked:translate-x-5 data-unchecked:translate-x-0",
        )}
      />
    </BaseSwitch.Root>
  ),
);
Switch.displayName = "Switch";

export { Switch };
