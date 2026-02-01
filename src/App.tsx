import { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

import { getCurrentWindow, PhysicalSize } from '@tauri-apps/api/window';
import { DrawingCanvas } from './components/canvas/DrawingCanvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { useHistory } from './hooks/useHistory';
import { useRuler } from './hooks/useRuler';
import { useClipboard } from './hooks/useClipboard';
import type { Tool, BrushSettings, Point } from './types';
import { DEFAULT_CONFIG, PASTEL_PALETTE } from './types';
import './App.css';

function App() {
  // State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [brush, setBrush] = useState<BrushSettings>({
    color: PASTEL_PALETTE.colors[0],
    size: DEFAULT_CONFIG.tools.pen.defaultSize,
    opacity: 1,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Hooks
  const { canUndo, canRedo, saveState, undo, redo, clearHistory } = useHistory();
  const { ruler, toggleRuler, startDragging, drag, stopDragging, rotateRuler } = useRuler();
  const { copyToClipboard, saveImage } = useClipboard();

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

      const fileData = await readFile(filePath as string);
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
    
    console.log('[handleFitToWindow] Centering:', {
      canvasSize,
      containerSize: { width: rect.width, height: rect.height },
      imageScreenSize: { width: imageScreenWidth, height: imageScreenHeight },
      pan: { x: panX, y: panY },
      zoom: finalZoom,
      viewOffset: { x: viewOffsetX, y: viewOffsetY }
    });
    
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

    await saveImage(tempCanvas);
  }, [saveImage]);

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
        size: DEFAULT_CONFIG.tools.pen.defaultSize,
        opacity: 1 
      }));
    } else if (newTool === 'highlighter') {
      setBrush((prev) => ({ 
        ...prev, 
        size: DEFAULT_CONFIG.tools.highlighter.defaultSize,
        opacity: DEFAULT_CONFIG.tools.highlighter.opacity
      }));
    } else if (newTool === 'area') {
      setBrush((prev) => ({ 
        ...prev, 
        opacity: 0.3 
      }));
    }
  }, []);

  // Handle zoom change - zoom towards mouse position using viewOffset approach
  // Using functional updates to avoid stale closure issues
  const handleZoomChange = useCallback((newZoom: number, mouseX?: number, mouseY?: number) => {
    console.log('[handleZoomChange] Called with:', { newZoom, mouseX, mouseY });
    
    const container = containerRef.current;
    if (!container || mouseX === undefined || mouseY === undefined) {
      console.log('[handleZoomChange] No container or mouse position, simple zoom');
      setZoom(newZoom);
      return;
    }

    const rect = container.getBoundingClientRect();
    
    // Get mouse position relative to container
    const mouseScreenX = mouseX - rect.left;
    const mouseScreenY = mouseY - rect.top;
    
    console.log('[handleZoomChange] Calculating with:', { 
      mouseScreenX, 
      mouseScreenY, 
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    });
    
    // Use functional state updates to avoid stale closures
    setZoom(prevZoom => {
      console.log('[handleZoomChange] Functional zoom update, prevZoom:', prevZoom);
      
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
        
        console.log('[handleZoomChange] New viewOffset:', { 
          newViewOffsetX, 
          newViewOffsetY, 
          canvasX, 
          canvasY,
          prevOffset
        });
        
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

  // Handle save state
  const handleSaveState = useCallback((canvas: HTMLCanvasElement) => {
    saveState(canvas);
  }, [saveState]);

  // Handle stroke end
  const handleStrokeEnd = useCallback(() => {
    // Auto-copy disabled - only copy on explicit Ctrl+C
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

  // Update window size when image changes
  useEffect(() => {
    if (!imageSrc) {
      hasCenteredRef.current = false;
      return;
    }

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
          handleFitToWindow();
        }
      }, 150);
    };
    img.src = imageSrc;
  }, [imageSrc, handleFitToWindow]);

  // Get canvas ref
  useEffect(() => {
    const canvas = document.querySelector('canvas:nth-of-type(2)') as HTMLCanvasElement;
    if (canvas) {
      drawCanvasRef.current = canvas;
    }
  }, [imageSrc]);

  return (
    <div ref={containerRef} className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e]">
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
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onFitToWindow={handleFitToWindow}
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
        onStrokeEnd={handleStrokeEnd}
        onSaveState={handleSaveState}
        className="flex-1"
      />
    </div>
  );
}

export default App;
