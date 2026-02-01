import { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

import { getCurrentWindow, PhysicalSize } from '@tauri-apps/api/window';
import { DrawingCanvas } from './components/canvas/DrawingCanvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { useStrokeHistory } from './hooks/useStrokeHistory';
import { useRuler } from './hooks/useRuler';
import { useClipboard } from './hooks/useClipboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import type { Tool, BrushSettings, Point } from './types';
import './App.css';

function App() {
  // Hooks
  const { 
    canUndo, 
    canRedo, 
    startStrokeGroup, 
    startStroke, 
    addPointToStroke, 
    endStrokeGroup,
    undo, 
    redo, 
    clearHistory
  } = useStrokeHistory();
  const { ruler, toggleRuler, startDragging, drag, stopDragging, rotateRuler } = useRuler();
  const { copyToClipboard, saveImage } = useClipboard();
  const { settings, updateDraft, updateColorPreset, saveSettings, cancelChanges, resetToDefaults, hasChanges } = useSettings();
  const { getActivePalette } = useTheme();

  // State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [recentDir, setRecentDir] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [brush, setBrush] = useState<BrushSettings>({
    color: settings.colorPresets[0],
    size: settings.defaultPenSize,
    opacity: settings.defaultPenOpacity,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Refs
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCenteredRef = useRef(false);

  // Handle open image
  const handleOpen = useCallback(async () => {
    try {
      const filePath = await open({
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        multiple: false,
      });

      if (!filePath) return;

      // Track directory and filename of opened file
      const path = filePath as string;
      const lastSlash = path.lastIndexOf('/');
      const fileName = lastSlash > 0 ? path.substring(lastSlash + 1) : path;
      console.log('Opening file:', path, 'Extracted filename:', fileName);
      if (lastSlash > 0) {
        setRecentDir(path.substring(0, lastSlash));
      }
      setCurrentFileName(fileName);

      const fileData = await readFile(path);
      const blob = new Blob([fileData], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }

      setImageSrc(url);
      setZoom(1);
      setViewOffset({ x: 0, y: 0 });
      clearHistory();
    } catch (error) {
      console.error('Failed to open image:', error);
    }
  }, [imageSrc, clearHistory]);

  // Handle fit to window - zoom to fit and center the image
  const handleFitToWindow = useCallback(() => {
    if (!containerRef.current || canvasSize.width === 0) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const padding = 40;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;
    
    // Calculate zoom to fit
    const scaleX = availableWidth / canvasSize.width;
    const scaleY = availableHeight / canvasSize.height;
    const newZoom = Math.min(scaleX, scaleY, 1);
    const finalZoom = Math.max(0.1, newZoom);
    
    // Calculate the image size in screen pixels at this zoom
    const imageScreenWidth = canvasSize.width * finalZoom;
    const imageScreenHeight = canvasSize.height * finalZoom;
    
    // Calculate pan offset to center the image in the window
    // This is a screen-space offset (in pixels), not a canvas offset
    // Positive panX moves the image right, positive panY moves the image down
    const panX = (rect.width - imageScreenWidth) / 2;
    const panY = (rect.height - imageScreenHeight) / 2;
    
    // Convert pan to viewOffset
    // viewOffset = -pan / zoom (negative because pan moves image, viewOffset moves viewport)
    const viewOffsetX = -panX / finalZoom;
    const viewOffsetY = -panY / finalZoom;
    
    setZoom(finalZoom);
    setViewOffset({ x: viewOffsetX, y: viewOffsetY });
  }, [canvasSize]);

  // Ref to access handleFitToWindow in effects without circular dependencies
  const handleFitToWindowRef = useRef(handleFitToWindow);

  // Keep ref in sync
  useEffect(() => {
    handleFitToWindowRef.current = handleFitToWindow;
  }, [handleFitToWindow]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!drawCanvasRef.current) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const baseCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!baseCanvas) return;

    tempCanvas.width = baseCanvas.width;
    tempCanvas.height = baseCanvas.height;

    tempCtx.drawImage(baseCanvas, 0, 0);
    tempCtx.drawImage(drawCanvasRef.current, 0, 0);

    const defaultPath = recentDir ? `${recentDir}/annotated-image.png` : 'annotated-image.png';
    await saveImage(tempCanvas, defaultPath);
  }, [saveImage, recentDir]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!drawCanvasRef.current) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const baseCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!baseCanvas) return;

    tempCanvas.width = baseCanvas.width;
    tempCanvas.height = baseCanvas.height;

    tempCtx.drawImage(baseCanvas, 0, 0);
    tempCtx.drawImage(drawCanvasRef.current, 0, 0);

    await copyToClipboard(tempCanvas);
  }, [copyToClipboard]);

  // Handle brush change
  const handleBrushChange = useCallback((changes: Partial<BrushSettings>) => {
    setBrush((prev) => ({ ...prev, ...changes }));
  }, []);

  // Handle tool change
  const handleToolChange = useCallback((newTool: Tool) => {
    setTool(newTool);
    // Set default values based on tool
    if (newTool === 'pen') {
      setBrush((prev) => ({ 
        ...prev, 
        size: settings.defaultPenSize,
        opacity: settings.defaultPenOpacity 
      }));
    } else if (newTool === 'highlighter') {
      setBrush((prev) => ({ 
        ...prev, 
        size: settings.defaultMarkerSize,
        opacity: settings.defaultMarkerOpacity,
        borderRadius: settings.defaultMarkerBorderRadius
      }));
    } else if (newTool === 'area') {
      setBrush((prev) => ({ 
        ...prev, 
        opacity: 0.1 
      }));
    }
  }, [settings]);

  // Handle zoom change - zoom towards mouse position using viewOffset approach
  // Using functional updates to avoid stale closure issues
  const handleZoomChange = useCallback((newZoom: number, mouseX?: number, mouseY?: number) => {
    const container = containerRef.current;
    if (!container || mouseX === undefined || mouseY === undefined) {
      setZoom(newZoom);
      return;
    }

    const rect = container.getBoundingClientRect();
    
    // Get mouse position relative to container
    const mouseScreenX = mouseX - rect.left;
    const mouseScreenY = mouseY - rect.top;
    
    // Use functional state updates to avoid stale closures
    setZoom(prevZoom => {
      // Calculate new viewOffset based on prevZoom (the zoom we're transitioning FROM)
      setViewOffset(prevOffset => {
        // Calculate the canvas point currently under the mouse using PREVIOUS state
        // screenToCanvas: (screenX / prevZoom) + prevOffset.x
        const canvasX = mouseScreenX / prevZoom + prevOffset.x;
        const canvasY = mouseScreenY / prevZoom + prevOffset.y;
        
        // After zoom change, we want the same canvas point to be under the mouse
        // newViewOffset.x = canvasX - mouseScreenX / newZoom
        const newViewOffsetX = canvasX - mouseScreenX / newZoom;
        const newViewOffsetY = canvasY - mouseScreenY / newZoom;
        
        return { x: newViewOffsetX, y: newViewOffsetY };
      });
      
      return newZoom;
    });
  }, []);

  // Handle undo
  const handleUndo = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) {
      undo(canvas);
    }
  }, [undo]);

  // Handle redo
  const handleRedo = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) {
      redo(canvas);
    }
  }, [redo]);

  const handleSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  // Handle ruler interactions
  const handleRulerDragStart = useCallback((point: Point) => {
    startDragging(point);
  }, [startDragging]);

  const handleRulerDrag = useCallback((point: Point) => {
    drag(point);
  }, [drag]);

  const handleRulerDragEnd = useCallback(() => {
    stopDragging();
  }, [stopDragging]);

  const handleRulerRotate = useCallback((delta: number) => {
    rotateRuler(delta);
  }, [rotateRuler]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            handleOpen();
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'r':
            e.preventDefault();
            toggleRuler();
            break;
          case '=':
          case '+':
            e.preventDefault();
            handleZoomChange(Math.min(5, zoom * 1.2));
            break;
          case '-':
            e.preventDefault();
            handleZoomChange(Math.max(0.1, zoom / 1.2));
            break;
          case '0':
            e.preventDefault();
            handleFitToWindowRef.current();
            break;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
            e.preventDefault();
            const colorIndex = parseInt(e.key) - 1;
            if (colorIndex < settings.colorPresets.length) {
              handleBrushChange({ color: settings.colorPresets[colorIndex] });
            }
            break;
        }
      } else {
        switch (e.key) {
          case '1':
            handleToolChange('pen');
            break;
          case '2':
            handleToolChange('highlighter');
            break;
          case '3':
            handleToolChange('area');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpen, handleSave, handleCopy, handleUndo, handleRedo, toggleRuler, handleToolChange, handleZoomChange, zoom]);

  // Update window title when file changes
  useEffect(() => {
    const updateTitle = async () => {
      const currentWindow = getCurrentWindow();
      console.log('Setting window title:', currentFileName ? `${currentFileName} - OmniMark` : 'OmniMark');
      if (currentFileName) {
        await currentWindow.setTitle(`${currentFileName} - OmniMark`);
      } else {
        await currentWindow.setTitle('OmniMark');
      }
    };
    updateTitle();
  }, [currentFileName]);

  // Update window size when image changes
  useEffect(() => {
    if (!imageSrc) {
      hasCenteredRef.current = false;
      setCurrentFileName(null);
      // Clear history when image is removed
      clearHistory();
      return;
    }
    
    // Clear history when a new image is loaded
    clearHistory();

    const img = new Image();
    img.onload = () => {
      setCanvasSize({ width: img.width, height: img.height });
      
      const padding = 80;
      const width = Math.min(img.width + padding, globalThis.window.screen.availWidth * 0.95);
      const height = Math.min(img.height + padding + 80, globalThis.window.screen.availHeight * 0.95);

      const currentWindow = getCurrentWindow();
      const physicalSize = new PhysicalSize(Math.round(width), Math.round(height));
      currentWindow.setSize(physicalSize);
      
      // Auto-center the image after window resize (only once per image)
      setTimeout(() => {
        if (!hasCenteredRef.current) {
          hasCenteredRef.current = true;
          handleFitToWindowRef.current();
        }
      }, 150);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Get canvas ref
  useEffect(() => {
    const canvas = document.querySelector('canvas:nth-of-type(2)') as HTMLCanvasElement;
    if (canvas) {
      drawCanvasRef.current = canvas;
    }
  }, [imageSrc]);

  // Get the active color palette from theme
  const activePalette = getActivePalette();

  return (
    <div ref={containerRef} className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg">
      <Toolbar
        tool={tool}
        onToolChange={handleToolChange}
        brush={brush}
        onBrushChange={handleBrushChange}
        ruler={ruler}
        onToggleRuler={toggleRuler}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpen={handleOpen}
        onSave={handleSave}
        onCopy={handleCopy}
        onSettings={handleSettings}
        hasImage={!!imageSrc}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onFitToWindow={handleFitToWindow}
        palette={activePalette}
      />

      <SettingsPanel
        settings={settings}
        hasChanges={hasChanges}
        onUpdateDraft={updateDraft}
        onUpdateColorPreset={updateColorPreset}
        onSave={saveSettings}
        onCancel={cancelChanges}
        onReset={resetToDefaults}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <DrawingCanvas
        imageSrc={imageSrc}
        tool={tool}
        brush={brush}
        ruler={ruler}
        zoom={zoom}
        viewOffset={viewOffset}
        canvasSize={canvasSize}
        onZoomChange={handleZoomChange}
        onViewOffsetChange={setViewOffset}
        onCanvasSizeChange={setCanvasSize}
        onRulerDragStart={handleRulerDragStart}
        onRulerDrag={handleRulerDrag}
        onRulerDragEnd={handleRulerDragEnd}
        onRulerRotate={handleRulerRotate}
        onStartStrokeGroup={startStrokeGroup}
        onStartStroke={startStroke}
        onAddPointToStroke={addPointToStroke}
        onEndStrokeGroup={endStrokeGroup}
        className="flex-1"
      />
    </div>
  );
}

export default App;
