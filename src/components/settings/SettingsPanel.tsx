import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Settings2, RotateCcw } from 'lucide-react';
import type { AppSettings } from '../../hooks/useSettings';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
  onUpdateColorPreset: (index: number, color: string) => void;
  onResetSettings: () => void;
}

export function SettingsPanel({
  settings,
  onUpdateSettings,
  onUpdateColorPreset,
  onResetSettings,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
        >
          <Settings2 className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-[#1e1e1e] border-[#3d3d3d] text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            Settings
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetSettings}
              className="text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto-copy setting */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-white">Auto-copy to clipboard</Label>
              <Switch
                checked={settings.autoCopyOnChange}
                onCheckedChange={(checked: boolean) =>
                  onUpdateSettings({ autoCopyOnChange: checked })
                }
              />
            </div>
            <p className="text-xs text-gray-400">
              Automatically copy the image to clipboard after each stroke
            </p>
          </div>

          {/* Color Presets */}
          <div className="space-y-3">
            <Label className="text-white">Color Presets (Ctrl+1 to Ctrl+7)</Label>
            <div className="grid grid-cols-7 gap-2">
              {settings.colorPresets.map((color, index) => (
                <div key={index} className="flex flex-col items-center gap-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onUpdateColorPreset(index, e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-2 border-[#3d3d3d]"
                  />
                  <span className="text-xs text-gray-400">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Default Tool Settings */}
          <div className="space-y-4">
            <Label className="text-white">Default Tool Settings</Label>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Pen Size</span>
                <span className="text-gray-400">{settings.defaultPenSize}px</span>
              </div>
              <Slider
                value={[settings.defaultPenSize]}
                onValueChange={([value]) =>
                  onUpdateSettings({ defaultPenSize: value })
                }
                min={1}
                max={20}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Marker Size</span>
                <span className="text-gray-400">{settings.defaultMarkerSize}px</span>
              </div>
              <Slider
                value={[settings.defaultMarkerSize]}
                onValueChange={([value]) =>
                  onUpdateSettings({ defaultMarkerSize: value })
                }
                min={5}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Marker Opacity</span>
                <span className="text-gray-400">{Math.round(settings.defaultMarkerOpacity * 100)}%</span>
              </div>
              <Slider
                value={[settings.defaultMarkerOpacity * 100]}
                onValueChange={([value]) =>
                  onUpdateSettings({ defaultMarkerOpacity: value / 100 })
                }
                min={10}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Marker Corner Radius</span>
                <span className="text-gray-400">{settings.defaultMarkerBorderRadius}px</span>
              </div>
              <Slider
                value={[settings.defaultMarkerBorderRadius]}
                onValueChange={([value]) =>
                  onUpdateSettings({ defaultMarkerBorderRadius: value })
                }
                min={0}
                max={20}
                step={1}
              />
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div className="space-y-3">
            <Label className="text-white">Keyboard Shortcuts</Label>
            <div className="text-xs text-gray-400 space-y-1 bg-[#2a2a2a] p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <span>Ctrl+O</span><span>Open image</span>
                <span>Ctrl+S</span><span>Save image</span>
                <span>Ctrl+C</span><span>Copy to clipboard</span>
                <span>Ctrl+Z</span><span>Undo</span>
                <span>Ctrl+Shift+Z</span><span>Redo</span>
                <span>Ctrl+R</span><span>Toggle ruler</span>
                <span>1/2/3</span><span>Pen/Marker/Area</span>
                <span>Ctrl+1-7</span><span>Colors 1-7</span>
                <span>Ctrl+Scroll</span><span>Zoom</span>
                <span>Ctrl+Click</span><span>Pan</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
