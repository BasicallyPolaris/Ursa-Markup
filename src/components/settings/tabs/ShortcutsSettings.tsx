import { useState, useEffect, useCallback } from "react";
import {
  Keyboard,
  FileInput,
  Brush,
  MousePointer,
  Layers,
  RotateCcw,
  Info,
  X,
} from "lucide-react";
import { SettingsSection } from "../components/SettingsSection";
import { Button } from "../../ui/button";
import type {
  AppSettings,
  HotkeyAction,
  HotkeyBinding,
  HotkeySettings,
} from "../../../services/types";
import { formatHotkey, DEFAULT_HOTKEYS } from "../../../services/types";
import { cn } from "../../../lib/utils";

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  shortcuts: { action: HotkeyAction; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "File Operations",
    icon: <FileInput className="w-4 h-4" />,
    shortcuts: [
      { action: "file.open", description: "Open image" },
      { action: "file.save", description: "Save image" },
      { action: "file.copy", description: "Copy to clipboard" },
    ],
  },
  {
    title: "Edit",
    icon: <Layers className="w-4 h-4" />,
    shortcuts: [
      { action: "edit.undo", description: "Undo" },
      { action: "edit.redo", description: "Redo" },
    ],
  },
  {
    title: "Tools",
    icon: <Brush className="w-4 h-4" />,
    shortcuts: [
      { action: "tool.pen", description: "Pen tool" },
      { action: "tool.marker", description: "Marker tool" },
      { action: "tool.area", description: "Area tool" },
    ],
  },
  {
    title: "Quick Colors",
    icon: <Brush className="w-4 h-4" />,
    shortcuts: [
      { action: "color.1", description: "Color 1" },
      { action: "color.2", description: "Color 2" },
      { action: "color.3", description: "Color 3" },
      { action: "color.4", description: "Color 4" },
      { action: "color.5", description: "Color 5" },
      { action: "color.6", description: "Color 6" },
      { action: "color.7", description: "Color 7" },
    ],
  },
  {
    title: "Navigation",
    icon: <MousePointer className="w-4 h-4" />,
    shortcuts: [
      { action: "nav.ruler", description: "Toggle ruler" },
      { action: "nav.zoomIn", description: "Zoom in" },
      { action: "nav.zoomOut", description: "Zoom out" },
      { action: "nav.fitToWindow", description: "Fit to window" },
    ],
  },
  {
    title: "Tabs",
    icon: <Keyboard className="w-4 h-4" />,
    shortcuts: [
      { action: "tab.new", description: "New tab" },
      { action: "tab.close", description: "Close tab" },
      { action: "tab.next", description: "Next tab" },
      { action: "tab.previous", description: "Previous tab" },
    ],
  },
];

interface ShortcutsSettingsProps {
  settings: AppSettings;
  updateDraft: (updates: Partial<AppSettings>) => void;
}

export function ShortcutsSettings({
  settings,
  updateDraft,
}: ShortcutsSettingsProps) {
  const [recordingAction, setRecordingAction] = useState<HotkeyAction | null>(
    null,
  );
  const [pendingBinding, setPendingBinding] = useState<HotkeyBinding | null>(
    null,
  );

  const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;

  const handleStartRecording = useCallback((action: HotkeyAction) => {
    setRecordingAction(action);
    setPendingBinding(null);
  }, []);

  const handleCancelRecording = useCallback(() => {
    setRecordingAction(null);
    setPendingBinding(null);
  }, []);

  const handleResetHotkey = useCallback(
    (action: HotkeyAction) => {
      const newHotkeys: HotkeySettings = {
        ...hotkeys,
        [action]: DEFAULT_HOTKEYS[action],
      };
      updateDraft({ hotkeys: newHotkeys });
    },
    [hotkeys, updateDraft],
  );

  const handleResetAll = useCallback(() => {
    updateDraft({ hotkeys: DEFAULT_HOTKEYS });
  }, [updateDraft]);

  const handleClearHotkey = useCallback(
    (action: HotkeyAction) => {
      const newHotkeys: HotkeySettings = {
        ...hotkeys,
        [action]: { key: "" }, // Empty key = unbound
      };
      updateDraft({ hotkeys: newHotkeys });
    },
    [hotkeys, updateDraft],
  );

  // Listen for key press while recording
  useEffect(() => {
    if (!recordingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      // Handle escape to cancel
      if (e.key === "Escape") {
        handleCancelRecording();
        return;
      }

      // Handle Backspace/Delete to clear/unbind the hotkey
      if (e.key === "Backspace" || e.key === "Delete") {
        const newHotkeys: HotkeySettings = {
          ...hotkeys,
          [recordingAction]: { key: "" }, // Empty key = unbound
        };
        updateDraft({ hotkeys: newHotkeys });
        setRecordingAction(null);
        setPendingBinding(null);
        return;
      }

      const binding: HotkeyBinding = {
        key: e.key.toLowerCase(),
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      };

      // Remove false modifiers for cleaner storage
      if (!binding.ctrl) delete binding.ctrl;
      if (!binding.shift) delete binding.shift;
      if (!binding.alt) delete binding.alt;

      setPendingBinding(binding);

      // Save after a brief moment to show the user what was recorded
      setTimeout(() => {
        const newHotkeys: HotkeySettings = {
          ...hotkeys,
          [recordingAction]: binding,
        };
        updateDraft({ hotkeys: newHotkeys });
        setRecordingAction(null);
        setPendingBinding(null);
      }, 200);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingAction, hotkeys, updateDraft, handleCancelRecording]);

  // Check if a hotkey differs from default
  const isModified = (action: HotkeyAction): boolean => {
    const current = hotkeys[action];
    const defaultBinding = DEFAULT_HOTKEYS[action];
    return JSON.stringify(current) !== JSON.stringify(defaultBinding);
  };

  // Check if a hotkey is unbound (empty key)
  const isUnbound = (binding: HotkeyBinding): boolean => {
    return !binding.key || binding.key === "";
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-2 items-center">
        {/* Info Banner */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
          <Info className="w-4 h-4 text-accent-primary mt-0.5 shrink-0" />
          <p className="text-sm text-text-secondary">
            Click on any shortcut to{" "}
            <span className="text-text-primary font-medium">
              record a new key combination
            </span>
            . Press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface-bg rounded border border-toolbar-border">
              Esc
            </kbd>{" "}
            to cancel or{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface-bg rounded border border-toolbar-border">
              Backspace
            </kbd>{" "}
            to unbind.
          </p>
        </div>
        {/* Reset All Button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetAll}
            className="text-text-muted hover:text-text-primary"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset All to Defaults
          </Button>
        </div>
      </div>

      {shortcutGroups.map((group) => (
        <SettingsSection
          key={group.title}
          title={group.title}
          icon={group.icon}
        >
          <div className="space-y-1">
            {group.shortcuts.map(({ action, description }) => {
              const isRecording = recordingAction === action;
              const binding =
                pendingBinding && isRecording
                  ? pendingBinding
                  : hotkeys[action];
              const modified = isModified(action);

              return (
                <div
                  key={action}
                  className={cn(
                    "flex items-center justify-between py-2 px-2 rounded transition-colors group",
                    isRecording
                      ? "bg-accent-primary/20 ring-2 ring-accent-primary"
                      : "hover:bg-surface-bg-hover/50",
                  )}
                >
                  <span className="text-text-secondary text-sm">
                    {description}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Reset button - show when modified */}
                    {modified && !isRecording && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetHotkey(action);
                        }}
                        className="size-6 p-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary"
                        title="Reset to default"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                    {/* Clear button - show when bound and not modified (to allow unbinding defaults) */}
                    {!isUnbound(binding) && !modified && !isRecording && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearHotkey(action);
                        }}
                        className="size-6 p-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-destructive"
                        title="Unbind hotkey"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                    <button
                      onClick={() => handleStartRecording(action)}
                      className={cn(
                        "px-2.5 py-1 text-xs font-mono rounded-md border transition-all min-w-20 text-center",
                        isRecording
                          ? "bg-accent-primary text-accent-primary-fg border-accent-primary animate-pulse"
                          : isUnbound(binding)
                            ? "bg-surface-bg text-text-muted border-toolbar-border/50 hover:border-accent-primary/50 italic"
                            : modified
                              ? "bg-accent-primary/20 text-text-primary border-accent-primary/40 hover:border-accent-primary"
                              : "bg-surface-bg text-text-primary border-toolbar-border shadow-sm hover:border-accent-primary/50",
                      )}
                    >
                      {isRecording
                        ? pendingBinding
                          ? formatHotkey(pendingBinding)
                          : "Press keys..."
                        : formatHotkey(binding)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsSection>
      ))}
    </div>
  );
}
