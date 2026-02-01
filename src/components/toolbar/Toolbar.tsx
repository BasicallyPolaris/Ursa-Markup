import { Pencil, Highlighter, Square, Ruler, Undo2, Redo2, FolderOpen, Save, Copy, Maximize, Minus, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import type { Tool, BrushSettings, RulerState, ColorPalette } from '../../types';
import { PASTEL_PALETTE } from '../../types';
import { cn } from '../../lib/utils';

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  brush: BrushSettings;
  onBrushChange: (brush: Partial<BrushSettings>) => void;
  ruler: RulerState;
  onToggleRuler: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpen: () => void;
  onSave: () => void;
  onCopy: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToWindow: () => void;
  palette?: ColorPalette;
}

export function Toolbar({
  tool,
  onToolChange,
  brush,
  onBrushChange,
  ruler,
  onToggleRuler,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpen,
  onSave,
  onCopy,
  zoom,
  onZoomChange,
  onFitToWindow,
  palette = PASTEL_PALETTE,
}: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col select-none">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
          <div className="flex items-center gap-1">
            <span className="text-white font-semibold text-sm mr-4">OmniSnip</span>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onOpen}
                  className="text-gray-300 hover:text-white hover:bg-[#3d3d3d] h-8"
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ctrl+O</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onSave}
                  className="text-gray-300 hover:text-white hover:bg-[#3d3d3d] h-8"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ctrl+S</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onCopy}
                  className="text-gray-300 hover:text-white hover:bg-[#3d3d3d] h-8"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ctrl+C</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="text-gray-300 hover:text-white hover:bg-[#3d3d3d] h-8 w-8 disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="text-gray-300 hover:text-white hover:bg-[#3d3d3d] h-8 w-8 disabled:opacity-30"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#2d2d2d]">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1 bg-[#1e1e1e] rounded-lg p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'pen' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onToolChange('pen')}
                  className={cn(
                    'h-8 px-3',
                    tool === 'pen' 
                      ? 'bg-[#005a9e] text-white hover:bg-[#004578]' 
                      : 'text-gray-300 hover:text-white hover:bg-[#3d3d3d]'
                  )}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Pen
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pen Tool (1)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'highlighter' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onToolChange('highlighter')}
                  className={cn(
                    'h-8 px-3',
                    tool === 'highlighter' 
                      ? 'bg-[#005a9e] text-white hover:bg-[#004578]' 
                      : 'text-gray-300 hover:text-white hover:bg-[#3d3d3d]'
                  )}
                >
                  <Highlighter className="h-4 w-4 mr-1" />
                  Marker
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marker - Square highlighter (2)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'area' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onToolChange('area')}
                  className={cn(
                    'h-8 px-3',
                    tool === 'area' 
                      ? 'bg-[#005a9e] text-white hover:bg-[#004578]' 
                      : 'text-gray-300 hover:text-white hover:bg-[#3d3d3d]'
                  )}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Area
                </Button>
              </TooltipTrigger>
              <TooltipContent>Area Highlight (3)</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-8 bg-[#3d3d3d]" />

          {/* Color Palette */}
          <div className="flex items-center gap-1">
            {palette.colors.slice(0, 7).map((color) => (
              <Tooltip key={color}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onBrushChange({ color })}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all border-2',
                      brush.color === color
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent hover:scale-105 hover:border-gray-400'
                    )}
                    style={{ backgroundColor: color }}
                  />
                </TooltipTrigger>
                <TooltipContent>Color: {color}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-px h-8 bg-[#3d3d3d]" />

          {/* Size & Opacity Controls */}
          <div className="flex items-center gap-4">
            {/* Size Slider - for all tools */}
            <div className="flex flex-col gap-1 w-28">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Size</span>
                <span className="text-xs text-gray-300 font-mono">{brush.size}px</span>
              </div>
              <Slider
                value={[brush.size]}
                min={1}
                max={tool === 'highlighter' ? 40 : 20}
                step={1}
                onValueChange={([value]) => onBrushChange({ size: value })}
              />
            </div>

            {/* Opacity Slider - for all tools */}
            <div className="flex flex-col gap-1 w-28">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Opacity</span>
                <span className="text-xs text-gray-300 font-mono">{Math.round(brush.opacity * 100)}%</span>
              </div>
              <Slider
                value={[brush.opacity * 100]}
                min={10}
                max={100}
                step={5}
                onValueChange={([value]) => onBrushChange({ opacity: value / 100 })}
              />
            </div>

            {/* Border Radius - only for marker */}
            {tool === 'highlighter' && (
              <div className="flex flex-col gap-1 w-28">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Radius</span>
                  <span className="text-xs text-gray-300 font-mono">{brush.borderRadius || 0}px</span>
                </div>
                <Slider
                  value={[brush.borderRadius || 0]}
                  min={0}
                  max={Math.floor(brush.size / 2)}
                  step={1}
                  onValueChange={([value]) => onBrushChange({ borderRadius: value })}
                />
              </div>
            )}

            {/* Brush Preview */}
            <div className="flex items-center justify-center w-10 h-10 bg-[#1e1e1e] rounded-lg border border-[#3d3d3d]">
              {tool === 'highlighter' ? (
                // Square marker preview - height controlled by slider, width is 30% of height
                <div
                  className="bg-current"
                  style={{
                    height: Math.min(28, brush.size),
                    width: Math.min(20, brush.size * 0.3),
                    backgroundColor: brush.color,
                    opacity: brush.opacity,
                    borderRadius: brush.borderRadius || 0,
                  }}
                />
              ) : (
                // Circle pen/area preview
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

          <div className="w-px h-8 bg-[#3d3d3d]" />

          {/* Ruler Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={ruler.visible ? 'secondary' : 'ghost'}
                size="sm"
                onClick={onToggleRuler}
                className={cn(
                  'h-8 px-3',
                  ruler.visible 
                    ? 'bg-[#005a9e] text-white hover:bg-[#004578]' 
                    : 'text-gray-300 hover:text-white hover:bg-[#3d3d3d]'
                )}
              >
                <Ruler className="h-4 w-4 mr-1" />
                Ruler
                {ruler.visible && (
                  <span className="ml-1 text-xs opacity-80">
                    {Math.round(ruler.angle % 360)}°
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Ruler (Ctrl+R) - Scroll to rotate, Drag to move</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#1e1e1e] rounded-lg p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoomChange(Math.max(0.1, zoom / 1.2))}
                  className="h-7 w-7 text-gray-300 hover:text-white hover:bg-[#3d3d3d]"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out (Ctrl+-)</TooltipContent>
            </Tooltip>

            <span className="text-xs text-gray-300 w-14 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoomChange(Math.min(5, zoom * 1.2))}
                  className="h-7 w-7 text-gray-300 hover:text-white hover:bg-[#3d3d3d]"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In (Ctrl++)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-[#3d3d3d] mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onFitToWindow}
                  className="h-7 w-7 text-gray-300 hover:text-white hover:bg-[#3d3d3d]"
                >
                  <Maximize className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit to Window (Ctrl+0)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
