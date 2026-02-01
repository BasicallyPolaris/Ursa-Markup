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
        <div className="flex items-center justify-between px-3 py-2 bg-toolbar-bg border-b border-toolbar-border">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onOpen}
                  className="h-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover"
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
                  className="h-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="h-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="h-8 w-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover disabled:opacity-40 border border-transparent hover:border-toolbar-border"
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
                  className="h-8 w-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover disabled:opacity-40 border border-transparent hover:border-toolbar-border"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px h-5 bg-text-secondary/20 mx-2" />

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSettings}
                  className="h-8 w-8 text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover border border-transparent hover:border-toolbar-border"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-3 px-3 py-2 bg-toolbar-bg-secondary border-b border-toolbar-border">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1 bg-surface-bg rounded-lg p-1 border border-toolbar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'pen' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onToolChange('pen')}
                  className={cn(
                    'h-8 px-3 border',
                    tool === 'pen' 
                      ? 'bg-surface-bg-active text-text-primary border-toolbar-border shadow-sm' 
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border-transparent'
                  )}
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Pen</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pen (1)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'highlighter' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onToolChange('highlighter')}
                  className={cn(
                    'h-8 px-3 border',
                    tool === 'highlighter' 
                      ? 'bg-surface-bg-active text-text-primary border-toolbar-border shadow-sm' 
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border-transparent'
                  )}
                >
                  <Highlighter className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Marker</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marker (2)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'area' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onToolChange('area')}
                  className={cn(
                    'h-8 px-3 border',
                    tool === 'area' 
                      ? 'bg-surface-bg-active text-text-primary border-toolbar-border shadow-sm' 
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border-transparent'
                  )}
                >
                  <Square className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Area</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Area (3)</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-8 bg-text-secondary/20" />

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
                        ? 'ring-2 ring-text-primary/60 ring-offset-2 ring-offset-toolbar-bg-secondary scale-110'
                        : 'hover:scale-105 hover:ring-2 hover:ring-text-primary/30'
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

          <div className="w-px h-8 bg-surface-bg" />

          {/* Size & Opacity Controls */}
          <div className="flex items-center gap-4">
            {/* Size Slider - hidden for area tool */}
            {tool !== 'area' && (
              <div className="flex flex-col gap-1 w-24">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Size</span>
                  <span className="text-xs text-text-secondary font-mono">{brush.size}px</span>
                </div>
                <Slider
                  value={[brush.size]}
                  min={1}
                  max={tool === 'highlighter' ? 40 : 20}
                  step={1}
                  onValueChange={([value]) => onBrushChange({ size: value })}
                />
              </div>
            )}

            {/* Opacity Slider */}
            <div className="flex flex-col gap-1 w-24">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Opacity</span>
                <span className="text-xs text-text-secondary font-mono">{Math.round(brush.opacity * 100)}%</span>
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
                  <span className="text-xs text-text-muted">Radius</span>
                  <span className="text-xs text-text-secondary font-mono">{brush.borderRadius || 0}px</span>
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
            <div className="flex items-center justify-center w-10 h-10 bg-surface-bg rounded-lg border border-toolbar-border">
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

          <div className="w-px h-8 bg-surface-bg" />

          {/* Ruler Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={ruler.visible ? 'secondary' : 'ghost'}
                size="sm"
                onClick={onToggleRuler}
                className={cn(
                  'h-8 px-3 border',
                  ruler.visible 
                    ? 'bg-surface-bg-active text-text-primary border-toolbar-border shadow-sm' 
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border-transparent'
                )}
              >
                <Ruler className="h-4 w-4 mr-1.5" />
                <span className="text-sm">Ruler</span>
                {ruler.visible && (
                  <span className="ml-1.5 text-xs text-text-secondary">
                    {Math.round(ruler.angle % 360)}°
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Ruler (Ctrl+R)</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-surface-bg rounded-lg p-1 border border-toolbar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoomChange(Math.max(0.1, zoom / 1.2))}
                  className="h-7 w-7 text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border border-transparent hover:border-toolbar-border"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out (Ctrl+-)</TooltipContent>
            </Tooltip>

            <span className="text-xs text-text-secondary w-12 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoomChange(Math.min(5, zoom * 1.2))}
                  className="h-7 w-7 text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border border-transparent hover:border-toolbar-border"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In (Ctrl++)</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-text-secondary/20 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onFitToWindow}
                  className="h-7 w-7 text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border border-transparent hover:border-toolbar-border"
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
