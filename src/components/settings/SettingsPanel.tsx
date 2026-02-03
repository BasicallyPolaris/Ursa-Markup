import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { RotateCcw, Save, X } from "lucide-react";
import { useSettings } from "../../contexts/SettingsContext";

export function SettingsPanel() {
  const {
    settings,
    hasChanges,
    isOpen,
    closeSettings,
    updateDraft,
    updateColorPreset,
    save,
    cancel,
    reset,
  } = useSettings();
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && hasChanges) {
        cancel();
      }
      if (!open) {
        closeSettings();
      }
    },
    [hasChanges, cancel, closeSettings],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const success = await save();
    setIsSaving(false);
    if (success) {
      closeSettings();
    }
  }, [save, closeSettings]);

  const handleCancel = useCallback(() => {
    cancel();
    closeSettings();
  }, [cancel, closeSettings]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      cancel();
    }
    closeSettings();
  }, [hasChanges, cancel, closeSettings]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-toolbar-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-text-primary text-lg font-semibold flex-1 text-center pl-10">
              Settings
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-9 w-9 rounded-full text-text-muted hover:text-panel-bg hover:bg-accent-hover transition-all"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Auto-copy setting */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-text-primary text-sm">
                Auto-copy to clipboard
              </Label>
              <Switch
                checked={settings.autoCopyOnChange}
                onCheckedChange={(checked: boolean) =>
                  updateDraft({ autoCopyOnChange: checked })
                }
              />
            </div>
            <p className="text-xs text-text-muted">
              Automatically copy the image to clipboard after each stroke
            </p>
          </div>

          {/* Close Tab Behavior */}
          <div className="space-y-2">
            <Label className="text-text-primary text-sm">
              When closing a tab with unsaved changes:
            </Label>
            <div className="flex gap-2">
              <Button
                variant={
                  settings.closeTabBehavior === "prompt" ? "secondary" : "ghost"
                }
                size="sm"
                onClick={() => updateDraft({ closeTabBehavior: "prompt" })}
                className={`flex-1 h-8 text-xs ${
                  settings.closeTabBehavior === "prompt"
                    ? "bg-text-primary/15 text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                }`}
              >
                Ask me
              </Button>
              <Button
                variant={
                  settings.closeTabBehavior === "auto-save"
                    ? "secondary"
                    : "ghost"
                }
                size="sm"
                onClick={() => updateDraft({ closeTabBehavior: "auto-save" })}
                className={`flex-1 h-8 text-xs ${
                  settings.closeTabBehavior === "auto-save"
                    ? "bg-text-primary/15 text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                }`}
              >
                Auto-save
              </Button>
              <Button
                variant={
                  settings.closeTabBehavior === "discard"
                    ? "secondary"
                    : "ghost"
                }
                size="sm"
                onClick={() => updateDraft({ closeTabBehavior: "discard" })}
                className={`flex-1 h-8 text-xs ${
                  settings.closeTabBehavior === "discard"
                    ? "bg-text-primary/15 text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                }`}
              >
                Discard
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              {settings.closeTabBehavior === "prompt" &&
                "Show a confirmation dialog before closing"}
              {settings.closeTabBehavior === "auto-save" &&
                "Automatically save changes when closing"}
              {settings.closeTabBehavior === "discard" &&
                "Close without saving changes"}
            </p>
          </div>

          {/* Color Presets */}
          <div className="space-y-3">
            <Label className="text-text-primary text-sm">
              Color Presets (Ctrl+1 to Ctrl+7)
            </Label>
            <div className="grid grid-cols-7 gap-2">
              {settings.colorPresets.map((color, index) => (
                <div key={index} className="flex flex-col items-center gap-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => updateColorPreset(index, e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border-2 border-panel-border"
                  />
                  <span className="text-xs text-text-muted">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Default Tool Settings */}
          <div className="space-y-4">
            <Label className="text-text-primary text-sm font-medium">
              Default Tool Settings
            </Label>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-sm">Pen Size</span>
                <span className="text-text-muted text-sm">
                  {settings.defaultPenSize}px
                </span>
              </div>
              <Slider
                value={[settings.defaultPenSize]}
                onValueChange={([value]) =>
                  updateDraft({ defaultPenSize: value })
                }
                min={1}
                max={20}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-sm">Marker Size</span>
                <span className="text-text-muted text-sm">
                  {settings.defaultMarkerSize}px
                </span>
              </div>
              <Slider
                value={[settings.defaultMarkerSize]}
                onValueChange={([value]) =>
                  updateDraft({ defaultMarkerSize: value })
                }
                min={5}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-sm">
                  Marker Opacity
                </span>
                <span className="text-text-muted text-sm">
                  {Math.round(settings.defaultMarkerOpacity * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.defaultMarkerOpacity * 100]}
                onValueChange={([value]) =>
                  updateDraft({ defaultMarkerOpacity: value / 100 })
                }
                min={10}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-sm">
                  Marker Corner Radius
                </span>
                <span className="text-text-muted text-sm">
                  {settings.defaultMarkerBorderRadius}px
                </span>
              </div>
              <Slider
                value={[settings.defaultMarkerBorderRadius]}
                onValueChange={([value]) =>
                  updateDraft({ defaultMarkerBorderRadius: value })
                }
                min={0}
                max={20}
                step={1}
              />
            </div>

            {/* Marker Blend Mode Toggle */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary text-sm">
                  Default Marker Blend Mode
                </span>
                <div className="flex gap-2">
                  <Button
                    variant={
                      settings.defaultMarkerBlendMode === "normal"
                        ? "secondary"
                        : "ghost"
                    }
                    size="sm"
                    onClick={() =>
                      updateDraft({ defaultMarkerBlendMode: "normal" })
                    }
                    className={`h-7 text-xs ${
                      settings.defaultMarkerBlendMode === "normal"
                        ? "bg-text-primary/15 text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                    }`}
                  >
                    Normal
                  </Button>
                  <Button
                    variant={
                      settings.defaultMarkerBlendMode === "multiply"
                        ? "secondary"
                        : "ghost"
                    }
                    size="sm"
                    onClick={() =>
                      updateDraft({ defaultMarkerBlendMode: "multiply" })
                    }
                    className={`h-7 text-xs ${
                      settings.defaultMarkerBlendMode === "multiply"
                        ? "bg-text-primary/15 text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                    }`}
                  >
                    Multiply
                  </Button>
                </div>
              </div>
              <p className="text-xs text-text-muted">
                Multiply darkens underlying colors
              </p>
            </div>

            {/* Area Tool Settings */}
            <div className="pt-2 border-t border-toolbar-border">
              <Label className="text-text-primary text-sm font-medium">
                Area Tool Defaults
              </Label>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-sm">
                  Area Opacity
                </span>
                <span className="text-text-muted text-sm">
                  {Math.round(settings.defaultAreaOpacity * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.defaultAreaOpacity * 100]}
                onValueChange={([value]) =>
                  updateDraft({ defaultAreaOpacity: value / 100 })
                }
                min={10}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-sm">
                  Area Corner Radius
                </span>
                <span className="text-text-muted text-sm">
                  {settings.defaultAreaBorderRadius}px
                </span>
              </div>
              <Slider
                value={[settings.defaultAreaBorderRadius]}
                onValueChange={([value]) =>
                  updateDraft({ defaultAreaBorderRadius: value })
                }
                min={0}
                max={50}
                step={1}
              />
            </div>

            {/* Area Border Width - 0 = no border */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-sm">
                  Area Border Width
                </span>
                <span className="text-text-muted text-sm">
                  {settings.defaultAreaBorderWidth === 0
                    ? "Off"
                    : `${settings.defaultAreaBorderWidth}px`}
                </span>
              </div>
              <Slider
                value={[settings.defaultAreaBorderWidth]}
                onValueChange={([value]) =>
                  updateDraft({ defaultAreaBorderWidth: value })
                }
                min={0}
                max={10}
                step={1}
              />
            </div>

            {/* Area Blend Mode Toggle */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary text-sm">
                  Default Area Blend Mode
                </span>
                <div className="flex gap-2">
                  <Button
                    variant={
                      settings.defaultAreaBlendMode === "normal"
                        ? "secondary"
                        : "ghost"
                    }
                    size="sm"
                    onClick={() =>
                      updateDraft({ defaultAreaBlendMode: "normal" })
                    }
                    className={`h-7 text-xs ${
                      settings.defaultAreaBlendMode === "normal"
                        ? "bg-text-primary/15 text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                    }`}
                  >
                    Normal
                  </Button>
                  <Button
                    variant={
                      settings.defaultAreaBlendMode === "multiply"
                        ? "secondary"
                        : "ghost"
                    }
                    size="sm"
                    onClick={() =>
                      updateDraft({ defaultAreaBlendMode: "multiply" })
                    }
                    className={`h-7 text-xs ${
                      settings.defaultAreaBlendMode === "multiply"
                        ? "bg-text-primary/15 text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                    }`}
                  >
                    Multiply
                  </Button>
                </div>
              </div>
              <p className="text-xs text-text-muted">
                Multiply darkens underlying colors
              </p>
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div className="space-y-2">
            <Label className="text-text-primary text-sm font-medium">
              Keyboard Shortcuts
            </Label>
            <div className="text-xs text-text-muted space-y-1 bg-surface-bg p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <span>Ctrl+O</span>
                <span>Open image</span>
                <span>Ctrl+S</span>
                <span>Save image</span>
                <span>Ctrl+C</span>
                <span>Copy to clipboard</span>
                <span>Ctrl+Z</span>
                <span>Undo</span>
                <span>Ctrl+Shift+Z</span>
                <span>Redo</span>
                <span>Ctrl+R</span>
                <span>Toggle ruler</span>
                <span>Ctrl+T</span>
                <span>New tab</span>
                <span>Ctrl+W</span>
                <span>Close tab</span>
                <span>Ctrl+Tab</span>
                <span>Next tab</span>
                <span>Ctrl+Shift+Tab</span>
                <span>Previous tab</span>
                <span>1/2/3</span>
                <span>Pen/Marker/Area</span>
                <span>Ctrl+1-7</span>
                <span>Colors 1-7</span>
                <span>Ctrl+Scroll</span>
                <span>Zoom</span>
                <span>Ctrl+Click</span>
                <span>Pan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-toolbar-border flex items-center justify-between shrink-0">
          {/* Reset button on left */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-text-muted hover:text-text-primary hover:bg-surface-bg-hover h-8"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset
          </Button>

          {/* Cancel and Save on right */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover h-8"
            >
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="h-8 bg-text-primary/15 text-text-primary hover:bg-text-primary/25 disabled:opacity-40"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
