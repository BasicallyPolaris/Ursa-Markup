import { Clipboard, Eye, FolderClosed } from "lucide-react";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { DeepPartial } from "~/types";
import {
  AutoCopyFormats,
  CloseTabBehaviors,
  CloseWindowBehaviors,
  ImageOpenBehaviors,
  type AppSettings,
  type AutoCopyFormat,
  type CloseTabBehavior,
} from "~/types/settings";
import {
  SettingsRow,
  SettingsSection,
  SettingsSliderRow,
} from "../components/SettingsSection";
import { ToggleButtonGroup } from "../components/ToggleButtonGroup";

type GeneralSettingsProps = {
  settings: AppSettings;
  updateDraft: (updates: DeepPartial<AppSettings>) => void;
};

export function GeneralSettings({
  settings,
  updateDraft,
}: GeneralSettingsProps) {
  const { copySettings, miscSettings } = settings;

  const closeTabOptions: { value: CloseTabBehavior; label: string }[] = [
    { value: CloseTabBehaviors.PROMPT, label: "Ask me" },
    { value: CloseTabBehaviors.AUTO_SAVE, label: "Auto-save" },
    { value: CloseTabBehaviors.DISCARD, label: "Discard" },
  ];

  const closeWindowOptions = [
    { value: CloseWindowBehaviors.EXIT, label: "Exit application" },
    { value: CloseWindowBehaviors.MINIMIZE_TO_TRAY, label: "Minimize to tray" },
  ];

  const imageOpenBehaviorOptions = [
    { value: ImageOpenBehaviors.FIT, label: "Fit" },
    { value: ImageOpenBehaviors.CENTER, label: "Center" },
  ];

  const copyFormatOptions = [
    { value: AutoCopyFormats.JPEG, label: "JPEG" },
    { value: AutoCopyFormats.PNG, label: "PNG" },
  ];

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------------------
          TAB & WINDOW BEHAVIOR
      ---------------------------------------------------------------------- */}
      <SettingsSection
        title="Tab Behavior"
        description="What happens when closing a tab with unsaved changes"
        icon={<FolderClosed className="size-4" />}
      >
        <SettingsRow
          label="Image open behavior"
          description="How images are positioned when opened"
        >
          <ToggleButtonGroup
            options={imageOpenBehaviorOptions}
            value={miscSettings.imageOpenBehavior}
            onChange={(value) =>
              updateDraft({
                miscSettings: { imageOpenBehavior: value },
              })
            }
          />
        </SettingsRow>

        <SettingsRow
          label="Tab closing behavior"
          description="What happens when closing a tab with unsaved changes"
        >
          <ToggleButtonGroup
            options={closeTabOptions}
            value={miscSettings.closeTabBehavior}
            onChange={(value) =>
              updateDraft({
                miscSettings: { closeTabBehavior: value },
              })
            }
          />
        </SettingsRow>

        <SettingsRow
          label="Window closing behavior"
          description="What happens when you close the main window"
        >
          <ToggleButtonGroup
            options={closeWindowOptions}
            value={miscSettings.closeWindowBehavior}
            onChange={(value) =>
              updateDraft({
                miscSettings: { closeWindowBehavior: value },
              })
            }
          />
        </SettingsRow>
      </SettingsSection>

      {/* ---------------------------------------------------------------------
          CLIPBOARD
      ---------------------------------------------------------------------- */}
      <SettingsSection
        title="Clipboard"
        description="Control how images are copied to clipboard"
        icon={<Clipboard className="size-4" />}
      >
        <SettingsRow
          label="Auto-copy to clipboard"
          description="Automatically copy the image to clipboard after each stroke"
        >
          <Switch
            checked={copySettings.autoCopyOnChange}
            onCheckedChange={(checked) =>
              updateDraft({
                copySettings: { autoCopyOnChange: checked },
              })
            }
          />
        </SettingsRow>

        {copySettings.autoCopyOnChange && (
          <SettingsRow
            label="Confirm auto-copy with toast"
            description="Show a notification when auto-copy completes"
          >
            <Switch
              checked={copySettings.autoCopyShowToast}
              onCheckedChange={(checked) =>
                updateDraft({
                  copySettings: { autoCopyShowToast: checked },
                })
              }
            />
          </SettingsRow>
        )}

        {copySettings.autoCopyOnChange && (
          <>
            <SettingsRow
              label="Auto-copy format"
              description="Image format for automatic clipboard copy"
            >
              <ToggleButtonGroup
                options={copyFormatOptions}
                value={copySettings.autoCopyFormat}
                onChange={(value) =>
                  updateDraft({
                    copySettings: { autoCopyFormat: value as AutoCopyFormat },
                  })
                }
              />
            </SettingsRow>

            {copySettings.autoCopyFormat === AutoCopyFormats.JPEG && (
              <SettingsSliderRow
                label="JPEG quality"
                value={Math.round(copySettings.autoCopyJpegQuality * 100)}
                unit="%"
              >
                <Slider
                  value={[Math.round(copySettings.autoCopyJpegQuality * 100)]}
                  onValueChange={([value]) =>
                    updateDraft({
                      copySettings: { autoCopyJpegQuality: value / 100 },
                    })
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
            options={copyFormatOptions}
            value={copySettings.manualCopyFormat}
            onChange={(value) =>
              updateDraft({
                copySettings: { manualCopyFormat: value as AutoCopyFormat },
              })
            }
          />
        </SettingsRow>

        {copySettings.manualCopyFormat === AutoCopyFormats.JPEG && (
          <SettingsSliderRow
            label="Manual copy JPEG quality"
            value={Math.round(copySettings.manualCopyJpegQuality * 100)}
            unit="%"
          >
            <Slider
              value={[Math.round(copySettings.manualCopyJpegQuality * 100)]}
              onValueChange={([value]) =>
                updateDraft({
                  copySettings: { manualCopyJpegQuality: value / 100 },
                })
              }
              min={30}
              max={100}
              step={5}
            />
          </SettingsSliderRow>
        )}
      </SettingsSection>

      {/* ---------------------------------------------------------------------
          DISPLAY
      ---------------------------------------------------------------------- */}
      <SettingsSection
        title="Display"
        description="Canvas and interface display options"
        icon={<Eye className="size-4" />}
      >
        <SettingsRow
          label="Show debug info"
          description="Display zoom level and ruler angle on canvas"
        >
          <Switch
            checked={miscSettings.showDebugInfo}
            onCheckedChange={(checked) =>
              updateDraft({
                miscSettings: { showDebugInfo: checked },
              })
            }
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
