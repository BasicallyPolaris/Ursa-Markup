import { cn } from "~/lib/utils";

type SettingsSectionProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SettingsSection({
  title,
  description,
  icon,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-toolbar-border bg-surface-bg/30 overflow-hidden",
        className,
      )}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-bg/50 border-b border-toolbar-border">
        {icon && (
          <div className="flex items-center justify-center size-8 rounded-md bg-surface-bg-active border border-toolbar-border text-text-primary">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {/* Section Content */}
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

type SettingsRowProps = {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsRow({
  label,
  description,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-sm">{label}</span>
        {children}
      </div>
      {description && <p className="text-xs text-text-muted">{description}</p>}
    </div>
  );
}

type SettingsSliderRowProps = {
  label: string;
  value: number;
  unit?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsSliderRow({
  label,
  value,
  unit = "",
  children,
  className,
}: SettingsSliderRowProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-muted tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      {children}
    </div>
  );
}

type SettingsGroupProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsGroup({
  title,
  children,
  className,
}: SettingsGroupProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
