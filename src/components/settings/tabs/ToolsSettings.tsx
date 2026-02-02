import { Pencil, Highlighter, Square, Info } from "lucide-react"
import { Slider } from "../../ui/slider"
import { ToggleButtonGroup } from "../components/ToggleButtonGroup"
import { SettingsSection, SettingsSliderRow, SettingsRow, SettingsGroup } from "../components/SettingsSection"
import type { AppSettings } from "../../../services/types"

interface ToolsSettingsProps {
  settings: AppSettings
  updateDraft: (updates: Partial<AppSettings>) => void
}

export function ToolsSettings({ settings, updateDraft }: ToolsSettingsProps) {
  const modeOptions = [
    { value: "normal" as const, label: "Normal" },
    { value: "composition" as const, label: "Composition" },
  ]

  const blendModeOptions = [
    { value: "normal" as const, label: "Normal" },
    { value: "multiply" as const, label: "Multiply" },
    { value: "color" as const, label: "Color" },
  ]

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
        <Info className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-text-secondary">
          These settings define the <span className="text-text-primary font-medium">default values</span> for new strokes. 
          You can still adjust tools in the toolbar while working.
        </p>
      </div>

      {/* Pen Settings */}
      <SettingsSection 
        title="Pen Tool Defaults" 
        description="Freehand drawing with solid strokes"
        icon={<Pencil className="w-4 h-4" />}
      >
        <SettingsSliderRow label="Default Size" value={settings.defaultPenSize} unit="px">
          <Slider
            value={[settings.defaultPenSize]}
            onValueChange={([value]) => updateDraft({ defaultPenSize: value })}
            min={1}
            max={20}
            step={1}
          />
        </SettingsSliderRow>
      </SettingsSection>

      {/* Marker Settings */}
      <SettingsSection
        title="Marker Tool Defaults"
        description="Highlighter with customizable blend modes"
        icon={<Highlighter className="w-4 h-4" />}
      >
        <SettingsGroup title="Appearance">
          <SettingsSliderRow label="Default Size" value={settings.defaultMarkerSize} unit="px">
            <Slider
              value={[settings.defaultMarkerSize]}
              onValueChange={([value]) => updateDraft({ defaultMarkerSize: value })}
              min={5}
              max={50}
              step={1}
            />
          </SettingsSliderRow>

          <SettingsSliderRow
            label="Default Opacity"
            value={Math.round(settings.defaultMarkerOpacity * 100)}
            unit="%"
          >
            <Slider
              value={[settings.defaultMarkerOpacity * 100]}
              onValueChange={([value]) => updateDraft({ defaultMarkerOpacity: value / 100 })}
              min={10}
              max={100}
              step={5}
            />
          </SettingsSliderRow>

          <SettingsSliderRow
            label="Corner Radius"
            value={settings.defaultMarkerBorderRadius}
            unit="px"
          >
            <Slider
              value={[settings.defaultMarkerBorderRadius]}
              onValueChange={([value]) => updateDraft({ defaultMarkerBorderRadius: value })}
              min={0}
              max={20}
              step={1}
            />
          </SettingsSliderRow>
        </SettingsGroup>

        <div className="border-t border-toolbar-border/50 pt-4">
          <SettingsGroup title="Blending">
            <SettingsRow 
              label="Default Mode"
              description="Composition preserves text visibility"
            >
              <ToggleButtonGroup
                options={modeOptions}
                value={settings.defaultMarkerMode}
                onChange={(value) => updateDraft({ defaultMarkerMode: value })}
                className="w-48"
              />
            </SettingsRow>

            <SettingsRow 
              label="Default Blend"
              description="How colors mix with the image"
            >
              <ToggleButtonGroup
                options={blendModeOptions}
                value={settings.defaultMarkerBlendMode}
                onChange={(value) => updateDraft({ defaultMarkerBlendMode: value })}
                className="w-48"
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </SettingsSection>

      {/* Area Tool Settings */}
      <SettingsSection
        title="Area Tool Defaults"
        description="Rectangular highlight regions"
        icon={<Square className="w-4 h-4" />}
      >
        <SettingsGroup title="Appearance">
          <SettingsSliderRow
            label="Default Opacity"
            value={Math.round(settings.defaultAreaOpacity * 100)}
            unit="%"
          >
            <Slider
              value={[settings.defaultAreaOpacity * 100]}
              onValueChange={([value]) => updateDraft({ defaultAreaOpacity: value / 100 })}
              min={10}
              max={100}
              step={5}
            />
          </SettingsSliderRow>

          <SettingsSliderRow
            label="Corner Radius"
            value={settings.defaultAreaBorderRadius}
            unit="px"
          >
            <Slider
              value={[settings.defaultAreaBorderRadius]}
              onValueChange={([value]) => updateDraft({ defaultAreaBorderRadius: value })}
              min={0}
              max={50}
              step={1}
            />
          </SettingsSliderRow>
        </SettingsGroup>

        <div className="border-t border-toolbar-border/50 pt-4">
          <SettingsGroup title="Border">
            <SettingsRow label="Show Border">
              <ToggleButtonGroup
                options={[
                  { value: "enabled" as const, label: "Enabled" },
                  { value: "disabled" as const, label: "Disabled" },
                ]}
                value={settings.defaultAreaBorderEnabled ? "enabled" : "disabled"}
                onChange={(value) =>
                  updateDraft({ defaultAreaBorderEnabled: value === "enabled" })
                }
                className="w-40"
              />
            </SettingsRow>

            {settings.defaultAreaBorderEnabled && (
              <SettingsSliderRow
                label="Border Width"
                value={settings.defaultAreaBorderWidth}
                unit="px"
              >
                <Slider
                  value={[settings.defaultAreaBorderWidth]}
                  onValueChange={([value]) => updateDraft({ defaultAreaBorderWidth: value })}
                  min={1}
                  max={10}
                  step={1}
                />
              </SettingsSliderRow>
            )}
          </SettingsGroup>
        </div>

        <div className="border-t border-toolbar-border/50 pt-4">
          <SettingsGroup title="Blending">
            <SettingsRow 
              label="Default Mode"
              description="Composition preserves text visibility"
            >
              <ToggleButtonGroup
                options={modeOptions}
                value={settings.defaultAreaMode}
                onChange={(value) => updateDraft({ defaultAreaMode: value })}
                className="w-48"
              />
            </SettingsRow>

            <SettingsRow 
              label="Default Blend"
              description="How colors mix with the image"
            >
              <ToggleButtonGroup
                options={blendModeOptions}
                value={settings.defaultAreaBlendMode}
                onChange={(value) => updateDraft({ defaultAreaBlendMode: value })}
                className="w-48"
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </SettingsSection>
    </div>
  )
}
