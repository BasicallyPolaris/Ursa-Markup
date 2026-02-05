import { Clipboard, FolderClosed, Eye } from "lucide-react";
import { Switch } from "../../ui/switch";
import { Slider } from "../../ui/slider";
import { ToggleButtonGroup } from "../components/ToggleButtonGroup";
import {
  SettingsSection,
  SettingsRow,
  SettingsSliderRow,
} from "../components/SettingsSection";
import type { AppSettings, CloseTabBehavior } from "../../../services/types";

interface GeneralSettingsProps {
  settings: AppSettings;
  updateDraft: (updates: Partial<AppSettings>) => void;
}

export function GeneralSettings({
  settings,
  updateDraft,
}: GeneralSettingsProps) {
  const closeTabOptions: { value: CloseTabBehavior; label: string }[] = [
    { value: "prompt", label: "Ask me" },
    { value: "auto-save", label: "Auto-save" },
    { value: "discard", label: "Discard" },
  ];

  return (
    <div className="space-y-5">
      {/* Close Tab Behavior */}
      <SettingsSection
        title="Tab Behavior"
        description="What happens when closing a tab with unsaved changes"
        icon={<FolderClosed className="w-4 h-4" />}
      >
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
            onChange={(value) =>
              updateDraft({ imageOpenBehavior: value as any })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="Tab closing behavior"
          description="How images are positioned when opened"
        >
          <ToggleButtonGroup
            options={closeTabOptions}
            value={settings.closeTabBehavior}
            onChange={(value) => updateDraft({ closeTabBehavior: value })}
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
          <SettingsRow
            label="Confirm auto-copy with toast"
            description="Show a notification when auto-copy completes"
          >
            <Switch
              checked={settings.autoCopyShowToast}
              onCheckedChange={(checked: boolean) =>
                updateDraft({ autoCopyShowToast: checked })
              }
            />
          </SettingsRow>
        )}

        {settings.autoCopyOnChange && (
          <>
            <SettingsRow
              label="Auto-copy format"
              description="Image format for automatic clipboard copy"
            >
              <ToggleButtonGroup
                options={[
                  { value: "jpeg", label: "JPEG" },
                  { value: "png", label: "PNG" },
                ]}
                value={settings.autoCopyFormat}
                onChange={(value) =>
                  updateDraft({ autoCopyFormat: value as any })
                }
              />
            </SettingsRow>

            {settings.autoCopyFormat === "jpeg" && (
              <SettingsSliderRow
                label="JPEG quality"
                value={Math.round(settings.autoCopyJpegQuality * 100)}
                unit="%"
              >
                <Slider
                  value={[Math.round(settings.autoCopyJpegQuality * 100)]}
                  onValueChange={([value]) =>
                    updateDraft({ autoCopyJpegQuality: value / 100 })
                  }
                  min={30}
                  max={100}
                  step={5}
                />
              </SettingsSliderRow>
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
              { value: "jpeg", label: "JPEG" },
              { value: "png", label: "PNG" },
            ]}
            value={settings.manualCopyFormat}
            onChange={(value) =>
              updateDraft({ manualCopyFormat: value as any })
            }
          />
        </SettingsRow>

        {settings.manualCopyFormat === "jpeg" && (
          <SettingsSliderRow
            label="Manual copy JPEG quality"
            value={Math.round(settings.manualCopyJpegQuality * 100)}
            unit="%"
          >
            <Slider
              value={[Math.round(settings.manualCopyJpegQuality * 100)]}
              onValueChange={([value]) =>
                updateDraft({ manualCopyJpegQuality: value / 100 })
              }
              min={30}
              max={100}
              step={5}
            />
          </SettingsSliderRow>
        )}
      </SettingsSection>

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
      </SettingsSection>
    </div>
  );
}
