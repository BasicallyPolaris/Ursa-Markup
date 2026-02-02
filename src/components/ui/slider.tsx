"use client"

import * as React from "react"
import { Slider as BaseSlider } from "@base-ui-components/react/slider"
import { cn } from "../../lib/utils"

interface SliderProps {
  className?: string
  defaultValue?: number[]
  value?: number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onValueChange?: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
}

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
    [value, defaultValue, min]
  )

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
        // newValue could be number or readonly number[]
        const valuesArray = Array.isArray(newValue) ? [...newValue] : [newValue]
        onValueChange?.(valuesArray)
      }}
      onValueCommitted={(newValue) => {
        const valuesArray = Array.isArray(newValue) ? [...newValue] : [newValue]
        onValueCommit?.(valuesArray)
      }}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className
      )}
    >
      <BaseSlider.Control className="relative flex w-full items-center h-4">
        <BaseSlider.Track
          data-slot="slider-track"
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/20"
        >
          <BaseSlider.Indicator
            data-slot="slider-range"
            className="absolute h-full bg-white/80"
          />
        </BaseSlider.Track>
        {_values.map((_, index) => (
          <BaseSlider.Thumb
            data-slot="slider-thumb"
            key={index}
            className="block h-4 w-4 rounded-full border border-white/50 bg-[#2a2a2a] shadow-md transition-all hover:scale-110 hover:bg-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}

export { Slider }
