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
import { BlendModes, Tools, type BlendMode, type Tool } from "~/types/tools";
import { formatHotkey } from "~/utils/hotkeys";

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
    [updateToolConfig],
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
                {formatHotkey(hotkeys["file.open"])}
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
                {formatHotkey(hotkeys["file.copy"])}
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
                {formatHotkey(hotkeys["file.save"])}
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
                Undo ({formatHotkey(hotkeys["edit.undo"])})
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
                Redo ({formatHotkey(hotkeys["edit.redo"])})
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
                  active={tool === "pen"}
                  icon={<Pencil className="size-4" />}
                  onClick={() => handleToolChange("pen")}
                />
              </TooltipTrigger>
              <TooltipContent>
                Pen ({formatHotkey(hotkeys["tool.pen"])})
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
                Highlighter ({formatHotkey(hotkeys["tool.highlighter"])})
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
                Area ({formatHotkey(hotkeys["tool.area"])})
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  active={tool === "eraser"}
                  icon={<Eraser className="size-4" />}
                  onClick={() => handleToolChange("eraser")}
                />
              </TooltipTrigger>
              <TooltipContent>
                Eraser ({formatHotkey(hotkeys["tool.eraser"])})
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
                      "w-6 h-6 rounded-full transition-all",
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
              <div className="flex items-center justify-center w-10 h-10 bg-surface-bg rounded-lg border border-toolbar-border">
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
                      width: Math.min(20, toolConfig.size * 0.3),
                      backgroundColor: activeColor,
                      opacity: toolConfig.opacity,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-surface-bg" />

          {(tool === Tools.PEN ||
            tool === Tools.HIGHLIGHTER ||
            tool === Tools.AREA) && (
            <Select
              value={toolConfig}
              onValueChange={() => handleBlendModeChange(toolConfig.blendMode)}
            >
              <SelectTrigger className="w-27.5">
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    {toolConfig.blendMode === BlendModes.NORMAL ? (
                      <>
                        <Layers className="size-3" />
                        Normal
                      </>
                    ) : (
                      <>
                        <Blend className="size-3" />
                        Multiply
                      </>
                    )}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">
                  <span className="flex items-center gap-1.5">
                    <Layers className="size-3" />
                    Normal
                  </span>
                </SelectItem>
                <SelectItem value="multiply">
                  <span className="flex items-center gap-1.5">
                    <Blend className="size-3" />
                    Multiply
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <ToolButton
                active={ruler.visible}
                icon={<Ruler className="size-4" />}
                onClick={handleToggleRuler}
              />
            </TooltipTrigger>
            <TooltipContent>
              Ruler ({formatHotkey(hotkeys["nav.ruler"])})
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
                Zoom Out ({formatHotkey(hotkeys["nav.zoomOut"])})
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
                Zoom In ({formatHotkey(hotkeys["nav.zoomIn"])})
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
                Fit to Canvas ({formatHotkey(hotkeys["nav.stretchToFill"])})
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
                Center Canvas ({formatHotkey(hotkeys["nav.centerImage"])})
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
