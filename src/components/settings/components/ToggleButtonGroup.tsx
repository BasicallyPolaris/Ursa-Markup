import { cn } from "../../../lib/utils"

interface ToggleOption<T extends string> {
  value: T
  label: string
}

interface ToggleButtonGroupProps<T extends string> {
  options: ToggleOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function ToggleButtonGroup<T extends string>({
  options,
  value,
  onChange,
  className,
}: ToggleButtonGroupProps<T>) {
  return (
    <div className={cn("flex gap-1 p-1 rounded-lg bg-surface-bg border border-toolbar-border", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors border",
            value === opt.value
              ? "bg-surface-bg-active text-text-primary border-toolbar-border shadow-sm"
              : "text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border-transparent"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
