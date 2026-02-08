import {
  Blend,
  Copy,
  Eraser,
  Expand,
  FolderOpen,
  Highlighter,
  Layers,
  Maximize,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Ruler,
  Save,
  Settings,
  Square,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { ToolButton } from "~/components/ui/tool-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useCanvasEngine } from "~/contexts/CanvasEngineContext";
import { useDocument } from "~/contexts/DocumentContext";
import { useDrawing } from "~/contexts/DrawingContext";
import { useSettings } from "~/contexts/SettingsContext";
import { useTabManager } from "~/contexts/TabManagerContext";
import { useFileActions, useHotkeys } from "~/hooks/useKeyboardShortcuts";
import { cn } from "~/lib/utils";
import {
  APP_SETTINGS_CONSTANTS,
  TOOL_SETTINGS_CONSTANTS,
} from "~/services/Settings/config";
import { HotkeyActions } from "~/types/settings";
import { BlendModes, Tools, type BlendMode, type Tool } from "~/types/tools";
import { formatHotkey } from "~/utils/hotkeys";

// Define options outside component for stability and clean DX
const blendModeOptions: {
  value: BlendMode;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: BlendModes.NORMAL, label: "Normal", icon: Layers },
  { value: BlendModes.MULTIPLY, label: "Multiply", icon: Blend },
];

export function Toolbar() {
  const { settings, openSettings } = useSettings();
  const { activeDocument } = useTabManager();
  const { strokeHistory, ruler, toggleRuler, undo, redo } = useDocument();
  const { zoom, setZoom, stretchToFill, centerImage } = useCanvasEngine();
  const hotkeys = useHotkeys();
  const { handleOpen, handleSave, handleCopy } = useFileActions();

  const {
    tool,
    switchTool,
    toolConfig,
    updateToolConfig,
    activeColor,
    setActiveColor,
  } = useDrawing();

  const colorPresets = settings.activePaletteColors;
  const hasImage = activeDocument?.hasImage() ?? false;
  const canUndo = strokeHistory.canUndo;
  const canRedo = strokeHistory.canRedo;

  const [zoomInputValue, setZoomInputValue] = useState(
    Math.round(zoom * 100).toString() + "%",
  );
  const [isEditingZoom, setIsEditingZoom] = useState(false);

  const activeBlendModeOption =
    "blendMode" in toolConfig
      ? blendModeOptions.find((opt) => opt.value === toolConfig.blendMode)
      : blendModeOptions[0];

  useEffect(() => {
    if (!isEditingZoom) {
      setZoomInputValue(Math.round(zoom * 100).toString() + "%");
    }
  }, [zoom, isEditingZoom]);

  const handleToolChange = useCallback(
    (newTool: Tool) => {
      switchTool(newTool);
    },
    [switchTool],
  );

  const handleSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  const handleZoomChange = useCallback(
    (newZoom: number) => {
      setZoom(newZoom);
    },
    [setZoom],
  );

  const handleZoomInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setZoomInputValue(e.target.value);
    },
    [],
  );

  const handleZoomInputBlur = useCallback(() => {
    setIsEditingZoom(false);
    const cleanValue = zoomInputValue.replace("%", "").trim();
    const value = parseInt(cleanValue, 10) / 100;
    if (
      !isNaN(value) &&
      value >= APP_SETTINGS_CONSTANTS.MIN_ZOOM &&
      value <= APP_SETTINGS_CONSTANTS.MAX_ZOOM
    ) {
      setZoom(value);
      setZoomInputValue(value.toString() + "%");
    } else {
      setZoomInputValue(Math.round(zoom * 100).toString() + "%");
    }
  }, [zoomInputValue, zoom, setZoom]);

  const handleZoomInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setZoomInputValue(Math.round(zoom * 100).toString() + "%");
        setIsEditingZoom(false);
        (e.target as HTMLInputElement).blur();
      }
    },
    [zoom],
  );

  const handleZoomInputFocus = useCallback(() => {
    setIsEditingZoom(true);
  }, []);

  const handleStretchToFill = useCallback(() => {
    stretchToFill();
  }, [stretchToFill]);

  const handleCenterImage = useCallback(() => {
    centerImage();
  }, [centerImage]);

  const handleBlendModeChange = useCallback(
    (blendMode: BlendMode) => {
      updateToolConfig(tool, { blendMode });
    },
    [updateToolConfig, tool],
  );

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  const handleToggleRuler = useCallback(() => {
    toggleRuler();
  }, [toggleRuler]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col select-none">
        <div className="flex items-center justify-between px-3 py-2 bg-toolbar-bg border-b border-toolbar-border">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpen}
                  className="h-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
                >
                  <FolderOpen className="size-4 mr-1.5" />
                  <span className="text-sm">Open</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {formatHotkey(hotkeys[HotkeyActions.FILE_OPEN])}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!hasImage}
                  className="h-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Copy className="size-4 mr-1.5" />
                  <span className="text-sm">Copy</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {formatHotkey(hotkeys[HotkeyActions.FILE_COPY])}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasImage}
                  className="h-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="size-4 mr-1.5" />
                  <span className="text-sm">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {formatHotkey(hotkeys[HotkeyActions.FILE_SAVE])}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Undo2 className="size-4" />}
                  onClick={handleUndo}
                  disabled={!canUndo}
                />
              </TooltipTrigger>
              <TooltipContent>
                Undo ({formatHotkey(hotkeys[HotkeyActions.EDIT_UNDO])})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Redo2 className="size-4" />}
                  onClick={handleRedo}
                  disabled={!canRedo}
                />
              </TooltipTrigger>
              <TooltipContent>
                Redo ({formatHotkey(hotkeys[HotkeyActions.EDIT_REDO])})
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-text-secondary/20 mx-2" />

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Settings className="size-4" />}
                  onClick={handleSettings}
                />
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-2 bg-toolbar-bg-secondary border-b border-toolbar-border overflow-x-auto scrollbar-thin scrollbar-thumb-toolbar-border scrollbar-track-transparent">
          <div className="flex items-center gap-1 bg-surface-bg rounded-lg p-1 border border-toolbar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  active={tool === Tools.PEN}
                  icon={<Pencil className="size-4" />}
                  onClick={() => handleToolChange(Tools.PEN)}
                />
              </TooltipTrigger>
              <TooltipContent>
                Pen ({formatHotkey(hotkeys[HotkeyActions.TOOL_PEN])})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  active={tool === Tools.HIGHLIGHTER}
                  icon={<Highlighter className="size-4" />}
                  onClick={() => handleToolChange(Tools.HIGHLIGHTER)}
                />
              </TooltipTrigger>
              <TooltipContent>
                Highlighter (
                {formatHotkey(hotkeys[HotkeyActions.TOOL_HIGHLIGHTER])})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  active={tool === Tools.AREA}
                  icon={<Square className="size-4" />}
                  onClick={() => handleToolChange(Tools.AREA)}
                />
              </TooltipTrigger>
              <TooltipContent>
                Area ({formatHotkey(hotkeys[HotkeyActions.TOOL_AREA])})
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  active={tool === Tools.ERASER}
                  icon={<Eraser className="size-4" />}
                  onClick={() => handleToolChange(Tools.ERASER)}
                />
              </TooltipTrigger>
              <TooltipContent>
                Eraser ({formatHotkey(hotkeys[HotkeyActions.TOOL_ERASER])})
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-8 bg-text-secondary/20" />

          <div className="flex items-center gap-1.5 overflow-visible">
            {colorPresets.slice(0, 7).map((color: string, index: number) => (
              <Tooltip key={`${color}-${index}`}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveColor(color)}
                    className={cn(
                      "size-6 rounded-full transition-all",
                      activeColor === color
                        ? "ring-2 ring-text-primary/60 ring-offset-1 ring-offset-toolbar-bg-secondary scale-110"
                        : "hover:scale-105 hover:ring-2 hover:ring-text-primary/30",
                    )}
                    style={{
                      backgroundColor: color,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {color} (
                  {formatHotkey(
                    hotkeys[`color.${index + 1}` as keyof typeof hotkeys],
                  )}
                  )
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-px h-8 bg-surface-bg" />

          <div className="flex items-center gap-4">
            {"size" in toolConfig && (
              <div className="flex flex-col gap-1 w-24">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Size</span>
                  <span className="text-xs text-text-secondary font-mono">
                    {toolConfig.size}px
                  </span>
                </div>
                <Slider
                  value={[toolConfig.size]}
                  min={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].minSize}
                  max={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].maxSize}
                  step={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].sizeStep}
                  onValueChange={([value]) =>
                    updateToolConfig(tool, { size: value })
                  }
                />
              </div>
            )}
            {"borderRadius" in toolConfig && (
              <div className="flex flex-col gap-1 w-24">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Radius</span>
                  <span className="text-xs text-text-secondary font-mono">
                    {toolConfig.borderRadius}px
                  </span>
                </div>
                <Slider
                  value={[toolConfig.borderRadius]}
                  min={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].minRadius}
                  max={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].maxRadius}
                  step={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].radiusStep}
                  onValueChange={([value]) =>
                    updateToolConfig(tool, { borderRadius: value })
                  }
                />
              </div>
            )}
            {"opacity" in toolConfig && (
              <div className="flex flex-col gap-1 w-24">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Opacity</span>
                  <span className="text-xs text-text-secondary font-mono">
                    {Math.round(toolConfig.opacity)}%
                  </span>
                </div>
                <Slider
                  value={[toolConfig.opacity]}
                  min={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].minOpacity}
                  max={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].maxOpacity}
                  step={TOOL_SETTINGS_CONSTANTS[toolConfig.tool].opacityStep}
                  onValueChange={([value]) =>
                    updateToolConfig(tool, { opacity: value })
                  }
                />
              </div>
            )}

            {(tool === Tools.PEN ||
              tool === Tools.HIGHLIGHTER ||
              tool === Tools.AREA) && (
              <div className="flex items-center justify-center size-10 bg-surface-bg rounded-lg border border-toolbar-border">
                {tool === Tools.PEN && (
                  <div
                    className="bg-current rounded-full"
                    style={{
                      width: Math.min(32, Math.max(4, toolConfig.size)),
                      height: Math.min(32, Math.max(4, toolConfig.size)),
                      backgroundColor: activeColor,
                      opacity: toolConfig.opacity,
                    }}
                  />
                )}
                {tool === Tools.AREA && (
                  <div
                    style={{
                      width: 24,
                      height: 18,
                      backgroundColor: activeColor,
                      opacity: toolConfig.opacity,
                      borderRadius: Math.min(toolConfig.borderRadius, 9),
                    }}
                  />
                )}
                {tool === Tools.HIGHLIGHTER && (
                  <div
                    className="bg-current"
                    style={{
                      height: Math.min(28, toolConfig.size),
                      width: Math.min(28, toolConfig.size),
                      backgroundColor: activeColor,
                      opacity: toolConfig.opacity,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {"blendMode" in toolConfig && activeBlendModeOption && (
            <>
              <div className="w-px h-8 bg-surface-bg" />
              <Select
                value={toolConfig.blendMode}
                onValueChange={(value) =>
                  handleBlendModeChange(value as BlendMode)
                }
              >
                <SelectTrigger className="w-27.5">
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <activeBlendModeOption.icon className="size-3" />
                      {activeBlendModeOption.label}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {blendModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-1.5">
                        <option.icon className="size-3" />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <ToolButton
                active={ruler.visible}
                className="shrink-0"
                icon={<Ruler className="size-4" />}
                onClick={handleToggleRuler}
              />
            </TooltipTrigger>
            <TooltipContent>
              Ruler ({formatHotkey(hotkeys[HotkeyActions.NAV_RULER])})
              {ruler.visible && ` • ${Math.round(ruler.angle % 360)}°`}
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1 bg-surface-bg rounded-lg p-1 border border-toolbar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Minus className="size-3" />}
                  size="sm"
                  onClick={() =>
                    handleZoomChange(
                      Math.max(APP_SETTINGS_CONSTANTS.MIN_ZOOM, zoom / 1.2),
                    )
                  }
                />
              </TooltipTrigger>
              <TooltipContent>
                Zoom Out ({formatHotkey(hotkeys[HotkeyActions.NAV_ZOOM_OUT])})
              </TooltipContent>
            </Tooltip>

            <input
              type="text"
              value={zoomInputValue}
              onChange={handleZoomInputChange}
              onFocus={handleZoomInputFocus}
              onBlur={handleZoomInputBlur}
              onKeyDown={handleZoomInputKeyDown}
              className="w-12 h-6 text-xs text-text-secondary text-center font-mono bg-transparent border border-transparent hover:border-toolbar-border focus:border-accent-primary focus:outline-none rounded px-1"
              title={`Click to edit zoom (${Math.round(APP_SETTINGS_CONSTANTS.MIN_ZOOM * 100)}-${Math.round(APP_SETTINGS_CONSTANTS.MAX_ZOOM * 100)}%)`}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Plus className="size-3" />}
                  size="sm"
                  onClick={() =>
                    handleZoomChange(
                      Math.min(APP_SETTINGS_CONSTANTS.MAX_ZOOM, zoom * 1.2),
                    )
                  }
                />
              </TooltipTrigger>
              <TooltipContent>
                Zoom In ({formatHotkey(hotkeys[HotkeyActions.NAV_ZOOM_IN])})
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-text-secondary/20 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Expand className="size-3" />}
                  size="sm"
                  onClick={handleStretchToFill}
                />
              </TooltipTrigger>
              <TooltipContent>
                Fit to Canvas (
                {formatHotkey(hotkeys[HotkeyActions.NAV_STRETCH_TO_FILL])})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Maximize className="size-3" />}
                  size="sm"
                  onClick={handleCenterImage}
                />
              </TooltipTrigger>
              <TooltipContent>
                Center Image (
                {formatHotkey(hotkeys[HotkeyActions.NAV_CENTER_IMAGE])})
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
