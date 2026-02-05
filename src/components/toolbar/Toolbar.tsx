import { useCallback, useState, useEffect } from "react";
import {
  Pencil,
  Highlighter,
  Square,
  Ruler,
  Undo2,
  Redo2,
  FolderOpen,
  Save,
  Copy,
  Maximize,
  Expand,
  Minus,
  Plus,
  Settings,
  Layers,
  Blend,
} from "lucide-react";
import { Button } from "../ui/button";
import { ToolButton } from "../ui/tool-button";
import { IconButton } from "../ui/icon-button";
import { Slider } from "../ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useSettings } from "../../contexts/SettingsContext";
import { useTabManager } from "../../contexts/TabManagerContext";
import { useDocument } from "../../contexts/DocumentContext";
import { useCanvasEngine } from "../../contexts/CanvasEngineContext";
import { useDrawing } from "../../contexts/DrawingContext";
import { useHotkeys, useFileActions } from "../../hooks/useKeyboardShortcuts";
import { formatHotkey } from "../../services/types";
import type { Tool, BrushSettings } from "../../types";
import { cn } from "../../lib/utils";

export function Toolbar() {
  // Get contexts
  const { settings, openSettings } = useSettings();
  const { activeDocument } = useTabManager();
  const { strokeHistory, ruler, toggleRuler, undo, redo } = useDocument();
  const { zoom, setZoom, stretchToFill, centerImage } = useCanvasEngine();
  const hotkeys = useHotkeys();
  const { handleOpen, handleSave, handleCopy } = useFileActions();

  // Use shared drawing state from context
  const { tool, brush, blendMode, setBlendMode, updateBrush, switchTool } =
    useDrawing();

  // Use colorPresets from settings (consistent with hotkeys)
  const colorPresets = settings.colorPresets;
  const hasImage = activeDocument?.hasImage() ?? false;
  const canUndo = strokeHistory.canUndo;
  const canRedo = strokeHistory.canRedo;

  // Zoom input state
  const [zoomInputValue, setZoomInputValue] = useState(
    Math.round(zoom * 100).toString() + "%",
  );
  const [isEditingZoom, setIsEditingZoom] = useState(false);

  // Sync zoom input value when zoom changes externally
  useEffect(() => {
    if (!isEditingZoom) {
      setZoomInputValue(Math.round(zoom * 100).toString() + "%");
    }
  }, [zoom, isEditingZoom]);

  // Handlers
  const handleToolChange = useCallback(
    (newTool: Tool) => {
      switchTool(newTool);
    },
    [switchTool],
  );

  const handleBrushChange = useCallback(
    (changes: Partial<BrushSettings>) => {
      updateBrush(changes);
    },
    [updateBrush],
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
    // Remove % sign if present for parsing
    const cleanValue = zoomInputValue.replace("%", "").trim();
    const value = parseInt(cleanValue, 10);
    if (!isNaN(value) && value >= 10 && value <= 500) {
      setZoom(value / 100);
      setZoomInputValue(value.toString() + "%");
    } else {
      // Reset to current zoom if invalid
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
    (mode: "normal" | "multiply") => {
      setBlendMode(mode);
    },
    [setBlendMode],
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
        {/* Top Bar */}
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
                  <FolderOpen className="h-4 w-4 mr-1.5" />
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
                  <Copy className="h-4 w-4 mr-1.5" />
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
                  <Save className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {formatHotkey(hotkeys["file.save"])}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1">
            {/* Undo/Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Undo2 className="h-4 w-4" />}
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
                  icon={<Redo2 className="h-4 w-4" />}
                  onClick={handleRedo}
                  disabled={!canRedo}
                />
              </TooltipTrigger>
              <TooltipContent>
                Redo ({formatHotkey(hotkeys["edit.redo"])})
              </TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px h-5 bg-text-secondary/20 mx-2" />

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Settings className="h-4 w-4" />}
                  onClick={handleSettings}
                />
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-3 px-3 py-2 bg-toolbar-bg-secondary border-b border-toolbar-border overflow-x-auto scrollbar-thin scrollbar-thumb-toolbar-border scrollbar-track-transparent">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1 bg-surface-bg rounded-lg p-1 border border-toolbar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  active={tool === "pen"}
                  icon={<Pencil className="h-4 w-4" />}
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
                  active={tool === "highlighter"}
                  icon={<Highlighter className="h-4 w-4" />}
                  onClick={() => handleToolChange("highlighter")}
                />
              </TooltipTrigger>
              <TooltipContent>
                Marker ({formatHotkey(hotkeys["tool.marker"])})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToolButton
                  active={tool === "area"}
                  icon={<Square className="h-4 w-4" />}
                  onClick={() => handleToolChange("area")}
                />
              </TooltipTrigger>
              <TooltipContent>
                Area ({formatHotkey(hotkeys["tool.area"])})
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-8 bg-text-secondary/20" />

          {/* Color Palette with smooth anti-aliased circles */}
          <div className="flex items-center gap-1.5 overflow-visible">
            {colorPresets.slice(0, 7).map((color: string, index: number) => (
              <Tooltip key={`${color}-${index}`}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleBrushChange({ color })}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all",
                      brush.color === color
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

          {/* Size or Radius Controls */}
          <div className="flex items-center gap-4">
            {tool !== "area" ? (
              <div className="flex flex-col gap-1 w-24">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Size</span>
                  <span className="text-xs text-text-secondary font-mono">
                    {brush.size}px
                  </span>
                </div>
                <Slider
                  value={[brush.size]}
                  min={1}
                  max={tool === "highlighter" ? 40 : 20}
                  step={1}
                  onValueChange={([value]) =>
                    handleBrushChange({ size: value })
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1 w-24">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Radius</span>
                  <span className="text-xs text-text-secondary font-mono">
                    {brush.borderRadius || 0}px
                  </span>
                </div>
                <Slider
                  value={[brush.borderRadius || 0]}
                  min={0}
                  max={50}
                  step={1}
                  onValueChange={([value]) =>
                    handleBrushChange({ borderRadius: value })
                  }
                />
              </div>
            )}

            {/* Opacity Slider */}
            <div className="flex flex-col gap-1 w-24">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Opacity</span>
                <span className="text-xs text-text-secondary font-mono">
                  {Math.round(brush.opacity * 100)}%
                </span>
              </div>
              <Slider
                value={[brush.opacity * 100]}
                min={10}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  handleBrushChange({ opacity: value / 100 })
                }
              />
            </div>

            {/* Brush Preview */}
            <div className="flex items-center justify-center w-10 h-10 bg-surface-bg rounded-lg border border-toolbar-border">
              {tool === "highlighter" ? (
                <div
                  className="bg-current"
                  style={{
                    height: Math.min(28, brush.size),
                    width: Math.min(20, brush.size * 0.3),
                    backgroundColor: brush.color,
                    opacity: brush.opacity,
                  }}
                />
              ) : tool === "area" ? (
                <div
                  style={{
                    width: 24,
                    height: 18,
                    backgroundColor: brush.color,
                    opacity: brush.opacity,
                    borderRadius: Math.min(brush.borderRadius || 0, 9),
                  }}
                />
              ) : (
                <div
                  className="rounded-full"
                  style={{
                    width: Math.min(32, Math.max(4, brush.size)),
                    height: Math.min(32, Math.max(4, brush.size)),
                    backgroundColor: brush.color,
                    opacity: brush.opacity,
                  }}
                />
              )}
            </div>
          </div>

          <div className="w-px h-8 bg-surface-bg" />

          {/* Blend Mode Select - shown for drawing tools */}
          {(tool === "pen" || tool === "highlighter" || tool === "area") && (
            <Select
              value={blendMode}
              onValueChange={(value) =>
                handleBlendModeChange(value as "normal" | "multiply")
              }
            >
              <SelectTrigger className="w-27.5">
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    {blendMode === "normal" ? (
                      <>
                        <Layers className="h-3 w-3" />
                        Normal
                      </>
                    ) : (
                      <>
                        <Blend className="h-3 w-3" />
                        Multiply
                      </>
                    )}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    Normal
                  </span>
                </SelectItem>
                <SelectItem value="multiply">
                  <span className="flex items-center gap-1.5">
                    <Blend className="h-3 w-3" />
                    Multiply
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Ruler Toggle - icon only */}
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolButton
                active={ruler.visible}
                icon={<Ruler className="h-4 w-4" />}
                onClick={handleToggleRuler}
              />
            </TooltipTrigger>
            <TooltipContent>
              Ruler ({formatHotkey(hotkeys["nav.ruler"])})
              {ruler.visible && ` • ${Math.round(ruler.angle % 360)}°`}
            </TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-surface-bg rounded-lg p-1 border border-toolbar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Minus className="h-3 w-3" />}
                  size="sm"
                  onClick={() => handleZoomChange(Math.max(0.1, zoom / 1.2))}
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
              title="Click to edit zoom (10-500%)"
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<Plus className="h-3 w-3" />}
                  size="sm"
                  onClick={() => handleZoomChange(Math.min(5, zoom * 1.2))}
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
                  icon={<Expand className="h-3 w-3" />}
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
                  icon={<Maximize className="h-3 w-3" />}
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
