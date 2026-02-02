import { useRef, useEffect, useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { useDocument } from '../../contexts/DocumentContext';
import { useCanvasEngine } from '../../contexts/CanvasEngineContext';
import { useTabManager } from '../../contexts/TabManagerContext';
import { useDrawing } from '../../contexts/DrawingContext';
import { cn } from '../../lib/utils';
import type { Point } from '../../core/types';

interface CanvasContainerProps {
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function CanvasContainer({ className, containerRef: externalRef }: CanvasContainerProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = externalRef || localRef;
  const { 
    document, 
    strokeHistory, 
    ruler,
    startStrokeGroup,
    startStroke, 
    addPointToStroke, 
    endStrokeGroup,
    toggleRuler: _toggleRuler,
    rotateRuler,
    startDragRuler,
    dragRulerTo: dragRuler,
    endDragRuler
  } = useDocument();
  
  const { 
    engine, 
    zoom, 
    viewOffset, 
    setZoom: _setZoom, 
    setViewOffset,
    fitToWindow: _fitToWindow,
    zoomAroundPoint,
    canvasSize,
    setCanvasSize
  } = useCanvasEngine();
  
  const { /* no methods needed */ } = useTabManager();
  
  // Get drawing state from shared context
  const { tool, brush, blendMode } = useDrawing();
  
  // Local state for drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [_startPoint, _setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isRulerHover, setIsRulerHover] = useState(false);
  const [isRulerDragging, setIsRulerDragging] = useState(false);
  
  // Refs for mutable state during gestures
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const startPointRef = useRef<Point | null>(null);
  const panStartRef = useRef<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const previewPointsRef = useRef<Point[]>([]);

  // Load image when document changes
  useEffect(() => {
    if (!document?.imageSrc || !engine) return;
    
    engine.loadImage(document.imageSrc).then(() => {
      if (engine.canvasSize.width > 0 && engine.canvasSize.height > 0) {
        setCanvasSize(engine.canvasSize);
        document.setCanvasSize(engine.canvasSize);
      }
    });
  }, [document?.imageSrc, engine]);

  // Replay strokes when history changes
  useEffect(() => {
    if (!engine || !document) return;
    
    engine.replayStrokes({
      groups: strokeHistory.groups,
      currentIndex: strokeHistory.currentIndex
    });
  }, [strokeHistory.currentIndex, engine, document]);

  // Animation loop for rendering
  useEffect(() => {
    if (!engine) return;
    
    let animationId: number;
    const render = () => {
      engine.render(
        { zoom, viewOffset, canvasSize },
        ruler,
        isDrawingRef.current && startPointRef.current
          ? {
              tool,
              startPoint: startPointRef.current!,
              currentPoint: currentPoint || startPointRef.current!,
              brush,
              points: previewPointsRef.current,
              blendMode
            }
          : undefined
      );
      animationId = requestAnimationFrame(render);
    };
    
    render();
    return () => cancelAnimationFrame(animationId);
  }, [engine, zoom, viewOffset, canvasSize, ruler, tool, brush, blendMode, currentPoint]);

  // Screen to canvas coordinate conversion
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point | null => {
    if (!containerRef.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left) / zoom + viewOffset.x,
      y: (screenY - rect.top) / zoom + viewOffset.y,
    };
  }, [zoom, viewOffset]);

  // Mouse down handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const point = screenToCanvas(e.clientX, e.clientY);
    if (!point) return;

    // Pan with middle mouse or Ctrl+left click
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      isPanningRef.current = true;
      panStartRef.current = point;
      setIsPanning(true);
      return;
    }

    // Use a fallback canvas size if the actual size is not available yet
    const effectiveCanvasSize = canvasSize.width > 0 && canvasSize.height > 0 
      ? canvasSize 
      : { width: 1920, height: 1080 };

    // Check if clicking on ruler
    if (ruler.visible && ruler.isPointOnRuler(point, effectiveCanvasSize)) {
      startDragRuler(point);
      setIsRulerDragging(true);
      return;
    }

    // Start drawing
    isDrawingRef.current = true;
    startPointRef.current = point;
    lastPointRef.current = point;
    setIsDrawing(true);
    _setStartPoint(point);
    previewPointsRef.current = [point];

    startStrokeGroup();
    startStroke(tool, brush, point, blendMode);
  }, [screenToCanvas, ruler, canvasSize, tool, brush, blendMode, startStrokeGroup, startStroke, startDragRuler]);

  // Mouse move handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const point = screenToCanvas(e.clientX, e.clientY);
    if (!point) return;

    // Use a fallback canvas size if the actual size is not available yet
    const effectiveCanvasSize = canvasSize.width > 0 && canvasSize.height > 0 
      ? canvasSize 
      : { width: 1920, height: 1080 };

    if (!isDrawingRef.current && !isPanningRef.current && !ruler.isDragging && !isRulerDragging) {
      setIsRulerHover(ruler.visible && ruler.isPointOnRuler(point, effectiveCanvasSize));
    }

    // Handle panning
    if (isPanningRef.current && panStartRef.current) {
      const deltaX = panStartRef.current.x - point.x;
      const deltaY = panStartRef.current.y - point.y;
      setViewOffset({
        x: viewOffset.x + deltaX,
        y: viewOffset.y + deltaY
      });
      return;
    }

    // Handle ruler dragging
    if (ruler.isDragging || isRulerDragging) {
      dragRuler(point);
      return;
    }

    // Handle drawing
    if (!isDrawingRef.current || !startPointRef.current) return;

    // Snap to ruler if near
    let drawPoint = point;
    if (ruler.visible) {
      const snapInfo = ruler.getSnapInfo(point, effectiveCanvasSize);
      if (snapInfo.inStickyZone) {
        drawPoint = ruler.snapPoint(point, brush.size, snapInfo.snapToFarSide);
      }
    }

    setCurrentPoint(point);
    addPointToStroke(drawPoint);
    previewPointsRef.current = [...previewPointsRef.current, drawPoint];
    lastPointRef.current = drawPoint;
  }, [screenToCanvas, isPanning, ruler, canvasSize, brush.size, viewOffset, setViewOffset, dragRuler, addPointToStroke, isRulerDragging]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    // Handle end of panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      setIsPanning(false);
      return;
    }

    // Handle end of ruler drag
    if (ruler.isDragging || isRulerDragging) {
      endDragRuler();
      setIsRulerDragging(false);
      return;
    }

    // Handle end of drawing
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    startPointRef.current = null;
    lastPointRef.current = null;
    setIsDrawing(false);
    _setStartPoint(null);
    setCurrentPoint(null);
    previewPointsRef.current = [];
    
    endStrokeGroup();
    document.markAsChanged();
  }, [ruler.isDragging, isRulerDragging, endDragRuler, endStrokeGroup, document]);

  // Mouse leave handler
  const handleMouseLeave = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      setIsPanning(false);
    }
    if (ruler.isDragging || isRulerDragging) {
      endDragRuler();
      setIsRulerDragging(false);
    }
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      startPointRef.current = null;
      lastPointRef.current = null;
      setIsDrawing(false);
      _setStartPoint(null);
      setCurrentPoint(null);
      previewPointsRef.current = [];
      if (tool !== 'area') {
        endStrokeGroup();
      }
    }
    setIsRulerHover(false);
  }, [ruler.isDragging, isRulerDragging, tool, endDragRuler, endStrokeGroup]);

  // Wheel handler for zoom and ruler rotation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const rect = container.getBoundingClientRect();
      const isInContainer =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isInContainer) return;

      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
        zoomAroundPoint(newZoom, e.clientX, e.clientY, rect);
      } else if (ruler.visible && !e.shiftKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        rotateRuler(delta);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, [zoom, ruler.visible, zoomAroundPoint, rotateRuler]);

  // Get cursor style
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (ruler.isDragging || isRulerDragging) return 'grabbing';
    if (isRulerHover) return 'grab';
    if (isDrawing) return 'crosshair';
    return 'crosshair';
  };

  // Empty state when no image
  if (!document?.imageSrc) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'relative flex items-center justify-center select-none bg-canvas-bg flex-1 min-h-0',
          className
        )}
        style={{
          width: '100%',
          height: '100%',
          backgroundImage: `linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                           linear-gradient(-45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                           linear-gradient(45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%),
                           linear-gradient(-45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-text-primary/90 text-lg mb-2 font-medium">
              OmniMark
            </p>
            <p className="text-text-primary/60 text-sm mb-1">
              Press Ctrl+O to open an image
            </p>
            <p className="text-text-primary/40 text-xs">
              Ctrl+Click to pan • Ctrl+Scroll to zoom
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden bg-canvas-bg flex-1 min-h-0', className)}
      style={{
        width: '100%',
        height: '100%',
        cursor: getCursor(),
        backgroundImage: `linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                         linear-gradient(-45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                         linear-gradient(45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%),
                         linear-gradient(-45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Status indicator */}
      <div className="absolute bottom-4 right-4 bg-surface-bg/95 text-text-primary px-3 py-2 rounded-lg text-xs font-mono pointer-events-none select-none flex flex-col gap-1 border border-toolbar-border">
        <div>Zoom: {Math.round(zoom * 100)}%</div>
        {(viewOffset.x !== 0 || viewOffset.y !== 0) && (
          <div className="text-text-muted">Panned</div>
        )}
        {ruler.visible && (
          <div className="text-accent-primary">
            Ruler: {Math.round(ruler.angle % 360)}°
          </div>
        )}
      </div>
    </div>
  );
}
