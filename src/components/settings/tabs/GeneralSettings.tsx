import { Clipboard, FolderClosed, Palette, Eye } from "lucide-react";
import { Switch } from "../../ui/switch";
import { ToggleButtonGroup } from "../components/ToggleButtonGroup";
import { SettingsSection, SettingsRow } from "../components/SettingsSection";
import type { AppSettings, CloseTabBehavior } from "../../../services/types";

interface GeneralSettingsProps {
  settings: AppSettings;
  updateDraft: (updates: Partial<AppSettings>) => void;
  updateColorPreset: (index: number, color: string) => void;
}

export function GeneralSettings({
  settings,
  updateDraft,
  updateColorPreset,
}: GeneralSettingsProps) {
  const closeTabOptions: { value: CloseTabBehavior; label: string }[] = [
    { value: "prompt", label: "Ask me" },
    { value: "auto-save", label: "Auto-save" },
    { value: "discard", label: "Discard" },
  ];

  return (
    <div className="space-y-5">
      {/* Display settings */}
      <SettingsSection
        title="Display"
        description="Canvas and interface display options"
        icon={<Eye className="w-4 h-4" />}
      >
        <SettingsRow
          label="Show debug info"
          description="Display zoom level and ruler angle on canvas"
        >
          <Switch
            checked={settings.showDebugInfo}
            onCheckedChange={(checked: boolean) =>
              updateDraft({ showDebugInfo: checked })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="Image open behavior"
          description="How images are positioned when opened"
        >
          <ToggleButtonGroup
            options={[
              { value: "fit", label: "Fit" },
              { value: "center", label: "Center" },
            ]}
            value={settings.imageOpenBehavior}
            onChange={(value) => updateDraft({ imageOpenBehavior: value as any })}
          />
        </SettingsRow>
      </SettingsSection>

      {/* Auto-copy setting */}
      <SettingsSection
        title="Clipboard"
        description="Control how images are copied to clipboard"
        icon={<Clipboard className="w-4 h-4" />}
      >
        <SettingsRow
          label="Auto-copy to clipboard"
          description="Automatically copy the image to clipboard after each stroke"
        >
          <Switch
            checked={settings.autoCopyOnChange}
            onCheckedChange={(checked: boolean) =>
              updateDraft({ autoCopyOnChange: checked })
            }
          />
        </SettingsRow>
        
        {settings.autoCopyOnChange && (
          <>
            <SettingsRow
              label="Auto-copy format"
              description="Image format for automatic clipboard copy"
            >
              <ToggleButtonGroup
                options={[
                  { value: "jpeg", label: "JPEG (Fast)" },
                  { value: "png", label: "PNG (Quality)" },
                ]}
                value={settings.autoCopyFormat}
                onChange={(value) => updateDraft({ autoCopyFormat: value as any })}
              />
            </SettingsRow>
            
            {settings.autoCopyFormat === "jpeg" && (
              <SettingsRow
                label="JPEG quality"
                description={`${Math.round(settings.autoCopyJpegQuality * 100)}% quality - lower is faster`}
              >
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={settings.autoCopyJpegQuality}
                  onChange={(e) => updateDraft({ autoCopyJpegQuality: parseFloat(e.target.value) })}
                  className="w-32 accent-accent-primary"
                />
              </SettingsRow>
            )}
          </>
        )}

        {/* Manual copy settings (Ctrl+C / Copy button) */}
        <SettingsRow
          label="Copy format (Ctrl+C / Copy)"
          description="Format used when manually copying via keyboard or the Copy action"
        >
          <ToggleButtonGroup
            options={[
              { value: "jpeg", label: "JPEG (Fast)" },
              { value: "png", label: "PNG (Quality)" },
            ]}
            value={settings.manualCopyFormat}
            onChange={(value) => updateDraft({ manualCopyFormat: value as any })}
          />
        </SettingsRow>

        {settings.manualCopyFormat === "jpeg" && (
          <SettingsRow
            label="Manual copy JPEG quality"
            description={`${Math.round(settings.manualCopyJpegQuality * 100)}% quality - lower is faster`}
          >
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={settings.manualCopyJpegQuality}
              onChange={(e) => updateDraft({ manualCopyJpegQuality: parseFloat(e.target.value) })}
              className="w-32 accent-accent-primary"
            />
          </SettingsRow>
        )}
      </SettingsSection>

      {/* Close Tab Behavior */}
      <SettingsSection
        title="Tab Behavior"
        description="What happens when closing a tab with unsaved changes"
        icon={<FolderClosed className="w-4 h-4" />}
      >
        <ToggleButtonGroup
          options={closeTabOptions}
          value={settings.closeTabBehavior}
          onChange={(value) => updateDraft({ closeTabBehavior: value })}
        />
        <p className="text-xs text-text-muted">
          {settings.closeTabBehavior === "prompt" &&
            "Show a confirmation dialog before closing"}
          {settings.closeTabBehavior === "auto-save" &&
            "Automatically save changes when closing"}
          {settings.closeTabBehavior === "discard" &&
            "Close without saving changes"}
        </p>
      </SettingsSection>

      {/* Color Presets */}
      <SettingsSection
        title="Color Presets"
        description="Quick access colors using Ctrl+1 through Ctrl+7"
        icon={<Palette className="w-4 h-4" />}
      >
        <div className="grid grid-cols-7 gap-3">
          {settings.colorPresets.map((color, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5">
              <div className="relative group">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => updateColorPreset(index, e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-toolbar-border hover:border-text-muted transition-colors"
                />
              </div>
              <kbd className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-surface-bg border border-toolbar-border">
                Ctrl+{index + 1}
              </kbd>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
