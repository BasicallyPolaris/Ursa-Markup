import { Pencil, Highlighter, Square, Ruler, Undo2, Redo2, FolderOpen, Save, Copy, Maximize, Minus, Plus, Settings } from 'lucide-react';
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
  onSettings: () => void;
  hasImage: boolean;
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
  onSettings,
  hasImage,
  zoom,
  onZoomChange,
  onFitToWindow,
  palette = PASTEL_PALETTE,
}: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col select-none">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#252525] border-b border-[#333]">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onOpen}
                  className="h-8 text-gray-300 hover:text-white hover:bg-[#3a3a3a]"
                >
                  <FolderOpen className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Open</span>
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
                  disabled={!hasImage}
                  className="h-8 text-gray-300 hover:text-white hover:bg-[#3a3a3a] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Save</span>
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
                  disabled={!hasImage}
                  className="h-8 text-gray-300 hover:text-white hover:bg-[#3a3a3a] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Copy</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ctrl+C</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1">
            {/* Undo/Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="h-8 w-8 text-gray-300 hover:text-white hover:bg-[#3a3a3a] disabled:opacity-40"
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
                  className="h-8 w-8 text-gray-300 hover:text-white hover:bg-[#3a3a3a] disabled:opacity-40"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px h-5 bg-[#444] mx-2" />

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSettings}
                  className="h-8 w-8 text-gray-300 hover:text-white hover:bg-[#3a3a3a]"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-3 px-3 py-2 bg-[#1e1e1e] border-b border-[#333]">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1 bg-[#252525] rounded-lg p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'pen' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onToolChange('pen')}
                  className={cn(
                    'h-8 px-3',
                    tool === 'pen' 
                      ? 'bg-white/15 text-white hover:bg-white/20' 
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Pen</span>
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
                      ? 'bg-white/15 text-white hover:bg-white/20' 
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Highlighter className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Marker</span>
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
                      ? 'bg-white/15 text-white hover:bg-white/20' 
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Square className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Area</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Area Highlight (3)</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-8 bg-[#333]" />

          {/* Color Palette with smooth anti-aliased circles */}
          <div className="flex items-center gap-1.5">
            {palette.colors.slice(0, 7).map((color) => (
              <Tooltip key={color}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onBrushChange({ color })}
                    className={cn(
                      'w-6 h-6 rounded-full transition-all',
                      brush.color === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1e1e] scale-110'
                        : 'hover:scale-105 hover:ring-2 hover:ring-white/50'
                    )}
                    style={{ 
                      backgroundColor: color,
                      boxShadow: brush.color === color ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>{color}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-px h-8 bg-[#333]" />

          {/* Size & Opacity Controls */}
          <div className="flex items-center gap-4">
            {/* Size Slider */}
            <div className="flex flex-col gap-1 w-24">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Size</span>
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

            {/* Opacity Slider */}
            <div className="flex flex-col gap-1 w-24">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Opacity</span>
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
              <div className="flex flex-col gap-1 w-24">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Radius</span>
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
            <div className="flex items-center justify-center w-10 h-10 bg-[#252525] rounded-lg border border-[#333]">
              {tool === 'highlighter' ? (
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

          <div className="w-px h-8 bg-[#333]" />

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
                    ? 'bg-white/15 text-white hover:bg-white/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                )}
              >
                <Ruler className="h-4 w-4 mr-1.5" />
                <span className="text-sm">Ruler</span>
                {ruler.visible && (
                  <span className="ml-1.5 text-xs text-gray-400">
                    {Math.round(ruler.angle % 360)}°
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Ruler (Ctrl+R)</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#252525] rounded-lg p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoomChange(Math.max(0.1, zoom / 1.2))}
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out (Ctrl+-)</TooltipContent>
            </Tooltip>

            <span className="text-xs text-gray-300 w-12 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoomChange(Math.min(5, zoom * 1.2))}
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In (Ctrl++)</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-[#444] mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onFitToWindow}
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
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
