import { Eraser, Highlighter, Pencil, Square } from "lucide-react";
import { Slider } from "~/components/ui/slider";
import { TOOL_SETTINGS_CONSTANTS } from "~/services/Settings/config";
import { DeepPartial } from "~/types";
import type { AppSettings } from "~/types/settings";
import { BlendModes, EraseModes, ToolConfigs, Tools } from "~/types/tools";
import {
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  SettingsSliderRow,
} from "../components/SettingsSection";
import { ToggleButtonGroup } from "../components/ToggleButtonGroup";

type ToolsSettingsProps = {
  toolConfigs: ToolConfigs;
  updateDraft: (updates: DeepPartial<AppSettings>) => void;
};

export function ToolsSettings({
  toolConfigs,
  updateDraft,
}: ToolsSettingsProps) {
  const blendModeOptions = [
    { value: BlendModes.NORMAL, label: "Normal" },
    { value: BlendModes.MULTIPLY, label: "Multiply" },
  ];

  const eraserModeOptions = [
    { value: EraseModes.FULL_STROKE, label: "Full Stroke" },
    { value: EraseModes.CONTAINED, label: "Contained" },
  ];

  return (
    <div className="space-y-5">
      {/* ======================= PEN TOOL ======================= */}
      <SettingsSection
        title="Pen Tool Defaults"
        description="Freehand drawing with solid strokes"
        icon={<Pencil className="w-4 h-4" />}
      >
        <SettingsGroup title="Appearance">
          <SettingsSliderRow
            label="Size"
            value={toolConfigs[Tools.PEN].size}
            unit="px"
          >
            <Slider
              value={[toolConfigs[Tools.PEN].size]}
              onValueChange={([value]) =>
                updateDraft({
                  toolConfigs: {
                    [Tools.PEN]: { size: value },
                  },
                })
              }
              min={1}
              max={20}
              step={1}
            />
          </SettingsSliderRow>
        </SettingsGroup>

        <div className="border-t border-toolbar-border/50 pt-4">
          <SettingsGroup title="Blending">
            <SettingsRow
              label="Blend"
              description="How colors mix with the image"
            >
              <ToggleButtonGroup
                options={blendModeOptions}
                value={toolConfigs[Tools.PEN].blendMode}
                onChange={(value) =>
                  updateDraft({
                    toolConfigs: {
                      [Tools.PEN]: { blendMode: value },
                    },
                  })
                }
                className="w-40"
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </SettingsSection>

      {/* ======================= HIGHLIGHTER TOOL ======================= */}
      <SettingsSection
        title="Highlighter Tool Defaults"
        description="Highlighter with customizable blend modes"
        icon={<Highlighter className="w-4 h-4" />}
      >
        <SettingsGroup title="Appearance">
          <SettingsSliderRow
            label="Size"
            value={toolConfigs[Tools.HIGHLIGHTER].size}
            unit="px"
          >
            <Slider
              value={[toolConfigs[Tools.HIGHLIGHTER].size]}
              onValueChange={([value]) =>
                updateDraft({
                  toolConfigs: {
                    [Tools.HIGHLIGHTER]: { size: value },
                  },
                })
              }
              min={TOOL_SETTINGS_CONSTANTS.highlighter.minSize}
              max={TOOL_SETTINGS_CONSTANTS.highlighter.maxSize}
              step={TOOL_SETTINGS_CONSTANTS.highlighter.sizeStep}
            />
          </SettingsSliderRow>

          <SettingsSliderRow
            label="Opacity"
            value={Math.round(toolConfigs[Tools.HIGHLIGHTER].opacity)}
            unit="%"
          >
            <Slider
              value={[toolConfigs[Tools.HIGHLIGHTER].opacity]}
              onValueChange={([value]) =>
                updateDraft({
                  toolConfigs: {
                    [Tools.HIGHLIGHTER]: { opacity: value },
                  },
                })
              }
              min={TOOL_SETTINGS_CONSTANTS.highlighter.minOpacity}
              max={TOOL_SETTINGS_CONSTANTS.highlighter.maxOpacity}
              step={TOOL_SETTINGS_CONSTANTS.highlighter.opacityStep}
            />
          </SettingsSliderRow>
        </SettingsGroup>

        <div className="border-t border-toolbar-border/50 pt-4">
          <SettingsGroup title="Blending">
            <SettingsRow
              label="Blend"
              description="How colors mix with the image"
            >
              <ToggleButtonGroup
                options={blendModeOptions}
                value={toolConfigs[Tools.HIGHLIGHTER].blendMode}
                onChange={(value) =>
                  updateDraft({
                    toolConfigs: {
                      [Tools.HIGHLIGHTER]: { blendMode: value },
                    },
                  })
                }
                className="w-40"
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </SettingsSection>

      {/* ======================= AREA TOOL ======================= */}
      <SettingsSection
        title="Area Tool Defaults"
        description="Rectangular highlight regions"
        icon={<Square className="w-4 h-4" />}
      >
        <SettingsGroup title="Appearance">
          <SettingsSliderRow
            label="Opacity"
            value={Math.round(toolConfigs[Tools.AREA].opacity)}
            unit="%"
          >
            <Slider
              value={[toolConfigs[Tools.AREA].opacity]}
              onValueChange={([value]) =>
                updateDraft({
                  toolConfigs: {
                    [Tools.AREA]: { opacity: value },
                  },
                })
              }
              min={TOOL_SETTINGS_CONSTANTS.area.minOpacity}
              max={TOOL_SETTINGS_CONSTANTS.area.maxOpacity}
              step={TOOL_SETTINGS_CONSTANTS.area.opacityStep}
            />
          </SettingsSliderRow>

          <SettingsSliderRow
            label="Corner Radius"
            value={toolConfigs[Tools.AREA].borderRadius}
            unit="px"
          >
            <Slider
              value={[toolConfigs[Tools.AREA].borderRadius]}
              onValueChange={([value]) =>
                updateDraft({
                  toolConfigs: {
                    [Tools.AREA]: { borderRadius: value },
                  },
                })
              }
              min={TOOL_SETTINGS_CONSTANTS.area.minRadius}
              max={TOOL_SETTINGS_CONSTANTS.area.maxRadius}
              step={TOOL_SETTINGS_CONSTANTS.area.radiusStep}
            />
          </SettingsSliderRow>
        </SettingsGroup>

        <div className="border-t border-toolbar-border/50 pt-4">
          <SettingsGroup title="Blending">
            <SettingsRow
              label="Blend"
              description="How colors mix with the image"
            >
              <ToggleButtonGroup
                options={blendModeOptions}
                value={toolConfigs[Tools.AREA].blendMode}
                onChange={(value) =>
                  updateDraft({
                    toolConfigs: {
                      [Tools.AREA]: { blendMode: value },
                    },
                  })
                }
                className="w-40"
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </SettingsSection>

      {/* ======================= ERASER TOOL ======================= */}
      <SettingsSection
        title="Eraser Tool Defaults"
        description="Remove strokes with an eraser brush"
        icon={<Eraser className="w-4 h-4" />}
      >
        <SettingsGroup title="Appearance">
          <SettingsSliderRow
            label="Size"
            value={toolConfigs[Tools.ERASER].size}
            unit="px"
          >
            <Slider
              value={[toolConfigs[Tools.ERASER].size]}
              onValueChange={([value]) =>
                updateDraft({
                  toolConfigs: {
                    [Tools.ERASER]: { size: value },
                  },
                })
              }
              min={TOOL_SETTINGS_CONSTANTS.eraser.minSize}
              max={TOOL_SETTINGS_CONSTANTS.eraser.maxSize}
              step={TOOL_SETTINGS_CONSTANTS.eraser.sizeStep}
            />
          </SettingsSliderRow>
        </SettingsGroup>

        <div className="border-t border-toolbar-border/50 pt-4">
          <SettingsGroup title="Behavior">
            <SettingsRow
              label="Eraser mode"
              description="How eraser selects strokes to remove"
            >
              <ToggleButtonGroup
                options={eraserModeOptions}
                value={toolConfigs[Tools.ERASER].eraserMode}
                onChange={(value) =>
                  updateDraft({
                    toolConfigs: {
                      [Tools.ERASER]: { eraserMode: value },
                    },
                  })
                }
                className="w-40"
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </SettingsSection>
    </div>
  );
}
