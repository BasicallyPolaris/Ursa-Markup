import { useRef, useEffect, useCallback, useState } from "react";
import type { RefObject } from "react";
import { useDocument } from "../../contexts/DocumentContext";
import { useCanvasEngine } from "../../contexts/CanvasEngineContext";
import { useTabManager } from "../../contexts/TabManagerContext";
import { useDrawing } from "../../contexts/DrawingContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useHotkeys } from "../../hooks/useKeyboardShortcuts";
import { registerPendingCopy } from "../../hooks/useClipboardEvents";
import { formatHotkey } from "../../services/types";
import { services } from "../../services";
import { cn } from "../../lib/utils";
import type { Point, ViewState } from "../../core/types";

interface CanvasContainerProps {
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function CanvasContainer({
  className,
  containerRef: externalRef,
}: CanvasContainerProps) {
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
    endDragRuler,
    autoCenter: _autoCenter,
    stretchToFill: _documentStretchToFill,
  } = useDocument();

  const {
    engine,
    zoom,
    viewOffset,
    setZoom: _setZoom,
    setViewOffset,
    fitToWindow,
    stretchToFill,
    centerImage: _centerImage,
    zoomAroundPoint,
    canvasSize,
    setCanvasSize,
  } = useCanvasEngine();

  const {
    /* no methods needed */
  } = useTabManager();

  // Get drawing state from shared context
  const { tool, brush, blendMode } = useDrawing();

  // Get settings for debug info display
  const { settings } = useSettings();

  // Get hotkeys for dynamic display
  const hotkeys = useHotkeys();

  // Local state for drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [_startPoint, _setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isRulerHover, setIsRulerHover] = useState(false);
  const [isRulerDragging, setIsRulerDragging] = useState(false);
  const [rulerPosition, setRulerPosition] = useState({ x: 0, y: 0, angle: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Refs for mutable state during gestures
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const startPointRef = useRef<Point | null>(null);
  const panStartRef = useRef<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const previewPointsRef = useRef<Point[]>([]);
  const startPointSnappedRef = useRef(false); // Track if start point snapped to ruler (for area tool)
  
  // Ref for debounced auto-copy timer
  const autoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get screen size of container
  const getScreenSize = useCallback(() => {
    if (!containerRef.current) return { width: 1920, height: 1080 };
    const rect = containerRef.current.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [containerRef]);

  // Load image when document changes, then replay strokes
  useEffect(() => {
    if (!document?.imageSrc || !engine) return;

    engine.loadImage(document.imageSrc).then(() => {
      if (engine.canvasSize.width > 0 && engine.canvasSize.height > 0) {
        const loadedSize = engine.canvasSize;
        setCanvasSize(loadedSize);
        document.setCanvasSize(loadedSize);

        // Apply fit behavior on INITIAL load only (not tab switch)
        // Use CanvasEngineContext functions that update React state
        // Track on the Document object since component remounts on tab switch
        if (!document.hasAppliedInitialFit) {
          document.hasAppliedInitialFit = true;
          
          if (settings.imageOpenBehavior === "fit") {
            stretchToFill(loadedSize);
          } else {
            fitToWindow(loadedSize);
          }
        }

        // Replay strokes after image is loaded (important for tab switching)
        engine.replayStrokes({
          groups: strokeHistory.groups,
          currentIndex: strokeHistory.currentIndex,
        });
      }
    });
    // Note: We intentionally only run this when imageSrc changes, not on settings change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.imageSrc, engine]);

  // Replay strokes when history changes (undo/redo or new strokes)
  useEffect(() => {
    if (!engine || !document) return;
    // Only replay if image is already loaded (canvas size > 0)
    if (engine.canvasSize.width === 0 || engine.canvasSize.height === 0) return;

    engine.replayStrokes({
      groups: strokeHistory.groups,
      currentIndex: strokeHistory.currentIndex,
    });
  }, [strokeHistory.currentIndex, strokeHistory.groups, engine, document]);

  // Render when state changes (not continuous animation loop)
  useEffect(() => {
    if (!engine) return;

    // Single render call when dependencies change
    engine.render(
      { zoom, viewOffset, canvasSize },
      ruler,
      isDrawing && startPointRef.current
        ? {
            tool,
            startPoint: startPointRef.current!,
            currentPoint: currentPoint || startPointRef.current!,
            brush,
            points: previewPointsRef.current,
            blendMode,
          }
        : undefined,
    );
  }, [
    engine,
    zoom,
    viewOffset,
    canvasSize,
    containerSize, // Trigger re-render on container resize
    ruler,
    ruler.visible, // Trigger re-render when ruler visibility changes
    rulerPosition, // Track ruler position changes for re-render during drag
    tool,
    brush,
    blendMode,
    currentPoint,
    isDrawing,
    strokeHistory.currentIndex, // Trigger re-render after undo/redo
  ]);

  // Screen to canvas coordinate conversion (for drawing strokes)
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Point | null => {
      if (!containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left) / zoom + viewOffset.x,
        y: (screenY - rect.top) / zoom + viewOffset.y,
      };
    },
    [zoom, viewOffset],
  );

  // Get screen point relative to container (for ruler operations)
  const getScreenPoint = useCallback((e: React.MouseEvent): Point | null => {
    if (!containerRef.current) return null;

    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Get current view state for ruler coordinate conversions
  const getViewState = useCallback((): ViewState => {
    return { zoom, viewOffset, canvasSize };
  }, [zoom, viewOffset, canvasSize]);

  // Mouse down handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const screenPoint = getScreenPoint(e);
      if (!canvasPoint || !screenPoint) return;

      // Pan with middle mouse or Ctrl+left click
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        isPanningRef.current = true;
        panStartRef.current = canvasPoint;
        setIsPanning(true);
        return;
      }

      // Get screen size for ruler hit detection
      const screenSize = getScreenSize();
      const viewState = getViewState();

      // Check if clicking on ruler (using screen coordinates)
      if (ruler.visible && ruler.isPointOnRuler(screenPoint, screenSize)) {
        startDragRuler(screenPoint);
        setIsRulerDragging(true);
        return;
      }

      // Snap start point to ruler if in sticky zone
      let startDrawPoint = canvasPoint;
      startPointSnappedRef.current = false; // Reset snap tracking
      if (ruler.visible) {
        const snapInfo = ruler.getSnapInfo(canvasPoint, viewState);
        if (snapInfo.inStickyZone) {
          if (tool === "area") {
            startDrawPoint = ruler.snapPointToEdge(
              canvasPoint,
              snapInfo.snapToFarSide,
              viewState,
            );
            startPointSnappedRef.current = true; // Track that start point snapped
          } else {
            startDrawPoint = ruler.snapPoint(
              canvasPoint,
              brush.size,
              snapInfo.snapToFarSide,
              viewState,
            );
          }
        }
      }

      // Start drawing (using canvas coordinates)
      isDrawingRef.current = true;
      startPointRef.current = startDrawPoint;
      lastPointRef.current = startDrawPoint;
      setIsDrawing(true);
      _setStartPoint(startDrawPoint);
      previewPointsRef.current = [startDrawPoint];

      startStrokeGroup();
      startStroke(tool, brush, startDrawPoint, blendMode);
    },
    [
      screenToCanvas,
      getScreenPoint,
      getScreenSize,
      getViewState,
      ruler,
      tool,
      brush,
      blendMode,
      startStrokeGroup,
      startStroke,
      startDragRuler,
    ],
  );

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const screenPoint = getScreenPoint(e);
      if (!canvasPoint || !screenPoint) return;

      // Get screen size for ruler hit detection
      const screenSize = getScreenSize();
      const viewState = getViewState();

      // Check ruler hover (using screen coordinates)
      if (
        !isDrawingRef.current &&
        !isPanningRef.current &&
        !ruler.isDragging &&
        !isRulerDragging
      ) {
        setIsRulerHover(
          ruler.visible && ruler.isPointOnRuler(screenPoint, screenSize),
        );
      }

      // Handle panning
      if (isPanningRef.current && panStartRef.current) {
        const deltaX = panStartRef.current.x - canvasPoint.x;
        const deltaY = panStartRef.current.y - canvasPoint.y;
        setViewOffset({
          x: viewOffset.x + deltaX,
          y: viewOffset.y + deltaY,
        });
        return;
      }

      // Handle ruler dragging (using screen coordinates)
      if (ruler.isDragging || isRulerDragging) {
        dragRuler(screenPoint);
        // Force re-render by updating ruler position state
        setRulerPosition({ x: ruler.x, y: ruler.y, angle: ruler.angle });
        return;
      }

      // Handle drawing
      if (!isDrawingRef.current || !startPointRef.current) return;

      // Snap to ruler if near (using canvas coordinates for stroke, viewState for ruler conversion)
      let drawPoint = canvasPoint;
      if (ruler.visible) {
        const snapInfo = ruler.getSnapInfo(canvasPoint, viewState);
        if (snapInfo.inStickyZone) {
          // Use different snap methods for area tool vs pen/highlighter
          if (tool === "area") {
            // Area tool: only snap end point if start point didn't snap
            // This prevents both endpoints from snapping simultaneously
            if (!startPointSnappedRef.current) {
              drawPoint = ruler.snapPointToEdge(
                canvasPoint,
                snapInfo.snapToFarSide,
                viewState,
              );
            }
          } else {
            // Pen/highlighter: snap with brush size offset
            drawPoint = ruler.snapPoint(
              canvasPoint,
              brush.size,
              snapInfo.snapToFarSide,
              viewState,
            );
          }
        }
      }

      setCurrentPoint(canvasPoint);
      addPointToStroke(drawPoint);
      previewPointsRef.current = [...previewPointsRef.current, drawPoint];
      lastPointRef.current = drawPoint;
    },
    [
      screenToCanvas,
      getScreenPoint,
      getScreenSize,
      getViewState,
      isPanning,
      ruler,
      brush.size,
      viewOffset,
      setViewOffset,
      dragRuler,
      addPointToStroke,
      isRulerDragging,
    ],
  );

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
    startPointSnappedRef.current = false; // Reset snap tracking
    setIsDrawing(false);
    _setStartPoint(null);
    setCurrentPoint(null);
    previewPointsRef.current = [];

    endStrokeGroup();
    document.markAsChanged();

    // Auto-copy to clipboard if enabled (debounced to avoid lag on rapid strokes)
    // Cancel any pending auto-copy timer
    if (autoCopyTimerRef.current) {
      clearTimeout(autoCopyTimerRef.current);
      autoCopyTimerRef.current = null;
    }
    
    if (settings.autoCopyOnChange && engine) {
      // Capture version after markAsChanged incremented it
      const versionToCopy = document.version;
      
      // Debounce auto-copy by 500ms to avoid unnecessary copies on rapid drawing
      autoCopyTimerRef.current = setTimeout(() => {
        // Use requestAnimationFrame to ensure rendering is complete
        requestAnimationFrame(() => {
          const canvas = engine.getCombinedCanvas();
          if (canvas) {
            // Register as auto-copy (silent - no toast on success)
            registerPendingCopy(versionToCopy, true);
            services.ioService.copyToClipboard(canvas, versionToCopy, { isAutoCopy: true }).catch((err) => {
              console.error("Auto-copy to clipboard failed:", err);
            });
          }
        });
        autoCopyTimerRef.current = null;
      }, 500);
    }
  }, [
    ruler.isDragging,
    isRulerDragging,
    endDragRuler,
    endStrokeGroup,
    document,
    settings.autoCopyOnChange,
    engine,
  ]);

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
      startPointSnappedRef.current = false; // Reset snap tracking
      setIsDrawing(false);
      _setStartPoint(null);
      setCurrentPoint(null);
      previewPointsRef.current = [];
      if (tool !== "area") {
        endStrokeGroup();
      }
    }
    setIsRulerHover(false);
  }, [ruler.isDragging, isRulerDragging, tool, endDragRuler, endStrokeGroup]);

  // Wheel handler for zoom, panning, and ruler rotation
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

      // Scroll speed factor - smaller value = smoother scrolling
      const scrollSpeed = 0.4;
      
      // Note: When Shift is pressed, some browsers swap deltaX and deltaY
      // We use deltaX when available for more natural horizontal scrolling
      const deltaY = e.deltaY;
      const deltaX = e.deltaX;

      if (e.ctrlKey) {
        // Ctrl + Scroll = Zoom
        e.preventDefault();
        const delta = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
        zoomAroundPoint(newZoom, e.clientX, e.clientY, rect);
      } else if (e.shiftKey) {
        // Shift + Scroll = Horizontal pan
        // Some browsers convert Shift+ScrollY to ScrollX, so we check both
        e.preventDefault();
        const scrollDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
        const scrollAmount = scrollDelta * scrollSpeed / zoom;
        setViewOffset({
          x: viewOffset.x + scrollAmount,
          y: viewOffset.y,
        });
      } else if (ruler.visible) {
        // No modifier + Scroll (when ruler visible) = Rotate ruler
        e.preventDefault();
        const delta = deltaY > 0 ? 1 : -1;
        rotateRuler(delta);
        // Force re-render by updating ruler position state
        setRulerPosition({ x: ruler.x, y: ruler.y, angle: ruler.angle });
      } else {
        // Normal scroll (no ruler) = Vertical pan
        e.preventDefault();
        const scrollAmount = deltaY * scrollSpeed / zoom;
        setViewOffset({
          x: viewOffset.x,
          y: viewOffset.y + scrollAmount,
        });
      }
    };

    window.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    return () =>
      window.removeEventListener("wheel", handleWheel, { capture: true });
  }, [zoom, viewOffset, ruler.visible, zoomAroundPoint, rotateRuler, setViewOffset]);

  // Cleanup auto-copy timer on unmount
  useEffect(() => {
    return () => {
      if (autoCopyTimerRef.current) {
        clearTimeout(autoCopyTimerRef.current);
        autoCopyTimerRef.current = null;
      }
    };
  }, []);

  // Handle container resize to trigger re-render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Get cursor style
  const getCursor = () => {
    if (isPanning) return "grabbing";
    if (ruler.isDragging || isRulerDragging) return "grabbing";
    if (isRulerHover) return "grab";
    if (isDrawing) return "crosshair";
    return "crosshair";
  };

  // Empty state when no image
  if (!document?.imageSrc) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "relative flex items-center justify-center select-none bg-canvas-bg flex-1 min-h-0",
          className,
        )}
        style={{
          width: "100%",
          height: "100%",
          backgroundImage: `linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                           linear-gradient(-45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                           linear-gradient(45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%),
                           linear-gradient(-45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%)`,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-text-primary/90 text-lg mb-2 font-medium">
              OmniMark
            </p>
            <p className="text-text-primary/60 text-sm mb-1">
              Press {formatHotkey(hotkeys["file.open"])} to open an image
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
      className={cn(
        "relative overflow-hidden bg-canvas-bg flex-1 min-h-0",
        className,
      )}
      style={{
        width: "100%",
        height: "100%",
        cursor: getCursor(),
        backgroundImage: `linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                         linear-gradient(-45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
                         linear-gradient(45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%),
                         linear-gradient(-45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%)`,
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Status indicator - conditional based on settings */}
      {settings.showDebugInfo && (
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
      )}
    </div>
  );
}
