import { HotkeyActions, type HotkeySettings } from "~/types/settings";
import { formatHotkey } from "~/utils/hotkeys";

type EmptyStateProps = {
  hotkeys: HotkeySettings;
};

export function EmptyState({ hotkeys }: EmptyStateProps) {
  return (
    <div
      className="relative flex items-center justify-center select-none bg-canvas-bg flex-1 min-h-0 w-full h-full"
      style={{
        backgroundImage: `
                linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                linear-gradient(-45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%),
                linear-gradient(-45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%)`,
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-text-primary/90 text-lg mb-2 font-medium">
            OmniMark
          </p>
          <p className="text-text-primary/60 text-sm mb-1">
            Press {formatHotkey(hotkeys[HotkeyActions.FILE_OPEN])} to open an
            image
          </p>
          <p className="text-text-primary/40 text-xs">
            Ctrl+Click to pan • Ctrl+Scroll to zoom
          </p>
        </div>
      </div>
    </div>
  );
}
