"use client";

import { Slider as BaseSlider } from "@base-ui-components/react/slider";
import * as React from "react";
import { cn } from "../../utils";

type SliderProps = {
  className?: string;
  defaultValue?: number[];
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onValueChange,
  onValueCommit,
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min],
    [value, defaultValue, min],
  );

  return (
    <BaseSlider.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(newValue) => {
        const valuesArray = Array.isArray(newValue)
          ? [...newValue]
          : [newValue];
        onValueChange?.(valuesArray);
      }}
      onValueCommitted={(newValue) => {
        const valuesArray = Array.isArray(newValue)
          ? [...newValue]
          : [newValue];
        onValueCommit?.(valuesArray);
      }}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50",
        className,
      )}
    >
      <BaseSlider.Control className="relative flex w-full items-center h-4">
        <BaseSlider.Track
          data-slot="slider-track"
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slider-track"
        >
          <BaseSlider.Indicator
            data-slot="slider-range"
            className="absolute left-0 h-full bg-slider-indicator"
          />
        </BaseSlider.Track>
        {_values.map((_, index) => (
          <BaseSlider.Thumb
            data-slot="slider-thumb"
            key={index}
            onMouseLeave={(e) => (e.target as HTMLElement).blur()}
            className="block size-4 rounded-full border border-slider-thumb-border bg-surface-bg shadow-md hover:scale-110 hover:bg-surface-bg-hover hover:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

export { Slider };
