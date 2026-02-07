import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useLayoutEffect,
} from "react";
import type { RefObject } from "react";
import { useDocument } from "../../contexts/DocumentContext";
import { useCanvasEngine } from "../../contexts/CanvasEngineContext";
import { useDrawing } from "../../contexts/DrawingContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useHotkeys } from "../../hooks/useKeyboardShortcuts";
import { registerPendingCopy } from "../../hooks/useClipboardEvents";
import { formatHotkey } from "../../services/types";
import { services } from "../../services";
import { cn } from "../../lib/utils";
import {
  Tools,
  type Point,
  type ViewState,
  type Tool,
  type ToolConfig,
  type RulerSnapInfo,
  AnyPreviewState,
} from "../../types";

interface CanvasContainerProps {
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function CanvasContainer({
  className,
  containerRef: externalRef,
}: CanvasContainerProps) {
  console.log("[CANVAS CONTAINER] Render");
  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = (externalRef ||
    localRef) as React.MutableRefObject<HTMLDivElement | null>;

  // Cache container bounds to avoid getBoundingClientRect on every mousemove
  const containerRectRef = useRef<DOMRect | null>(null);

  // --- Contexts ---
  const {
    document,
    strokeHistory,
    ruler,
    startStrokeGroup,
    startStroke,
    addPointToStroke,
    endStrokeGroup,
    rotateRuler,
    startDragRuler,
    dragRulerTo: dragRuler,
    endDragRuler,
  } = useDocument();

  const {
    engine,
    zoom,
    viewOffset,
    setViewOffset,
    fitToWindow,
    stretchToFill,
    zoomAroundPoint,
    canvasSize,
    setCanvasSize,
    setCanvasRef,
  } = useCanvasEngine();

  const { tool, toolConfig, activeColor } = useDrawing();
  const { settings } = useSettings();
  const hotkeys = useHotkeys();

  // --- Local State ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isRulerHover, setIsRulerHover] = useState(false);
  const [isRulerDragging, setIsRulerDragging] = useState(false);

  // We track this state to trigger renders when ruler moves,
  // but we don't read it in the render loop (we read ruler directly)
  const [, setRulerHash] = useState(0);

  // --- Mutable Refs (for Event Listeners) ---
  // Using refs allows event listeners to remain bound without stale closures
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const previewPointsRef = useRef<Point[]>([]);
  const startPointSnappedRef = useRef(false);
  const viewStateRef = useRef<ViewState>({ zoom, viewOffset, canvasSize });
  const autoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync Ref with State
  useLayoutEffect(() => {
    viewStateRef.current = { zoom, viewOffset, canvasSize };
  }, [zoom, viewOffset, canvasSize]);

  // --- Helpers ---

  // High-performance coordinate conversion using cached rect
  const getScreenToCanvas = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = containerRectRef.current;
      if (!rect) return null;
      const vs = viewStateRef.current;

      return {
        x: (clientX - rect.left) / vs.zoom + vs.viewOffset.x,
        y: (clientY - rect.top) / vs.zoom + vs.viewOffset.y,
      };
    },
    [],
  );

  const getRelativePoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = containerRectRef.current;
      if (!rect) return null;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [],
  );

  // Snapping Logic
  const calculateSnappedPoint = useCallback(
    (
      canvasPoint: Point,
      snapInfo: RulerSnapInfo,
      viewState: ViewState,
      currentTool: Tool,
      config: ToolConfig,
    ): Point => {
      // Area tool snaps to edges, others snap based on brush size
      if (currentTool === Tools.AREA) {
        return ruler.snapPointToEdge(
          canvasPoint,
          snapInfo.snapToFarSide,
          viewState,
        );
      }

      const size = "size" in config ? config.size : 0;
      return ruler.snapPoint(
        canvasPoint,
        size,
        snapInfo.snapToFarSide,
        viewState,
      );
    },
    [ruler],
  );

  // Notify CanvasEngineContext when container is ready
  useEffect(() => {
    console.log("[CANVAS CONTAINER] setCanvasRef effect, container:", containerRef.current ? "exists" : "null");
    if (typeof setCanvasRef === "function") {
      setCanvasRef(containerRef.current);
      return () => {
        setCanvasRef(null);
      };
    }
    return () => {};
  }, [containerRef.current, setCanvasRef]);

  // --- Lifecycle Effects ---

  // 1. Initial Load & Resize Observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Observer to keep rect cache updated
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerRectRef.current = entry.target.getBoundingClientRect();
        // Force a re-render if size changes drastically to update canvas resolution
        if (engine) engine.render(viewStateRef.current, ruler);
      }
    });

    observer.observe(container);
    // Initial cache
    containerRectRef.current = container.getBoundingClientRect();

    return () => observer.disconnect();
  }, [containerRef, engine, ruler]);

  // 2. Load Image & Initial Setup
  useEffect(() => {
    console.log("[CANVAS CONTAINER LOAD EFFECT] imageSrc:", document?.imageSrc ? "exists" : "null", "engine:", engine ? "exists" : "null");
    if (!document?.imageSrc || !engine) return;

    let mounted = true;

    engine.loadImage(document.imageSrc).then(() => {
      console.log("[CANVAS CONTAINER LOAD EFFECT] Image loaded, engine.canvasSize:", engine.canvasSize);
      if (!mounted) return;

      if (engine.canvasSize.width > 0) {
        const loadedSize = engine.canvasSize;
        setCanvasSize(loadedSize);
        document.setCanvasSize(loadedSize);

        if (!document.hasAppliedInitialFit) {
          document.hasAppliedInitialFit = true;
          if (settings.imageOpenBehavior === "fit") {
            stretchToFill(loadedSize);
          } else {
            fitToWindow(loadedSize);
          }
        }

        // Initial replay
        engine.replayStrokes({
          groups: strokeHistory.groups,
          currentIndex: strokeHistory.currentIndex,
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, [document?.imageSrc, engine]); // Intentionally minimal deps

  // 3. History Changes & Auto-Copy
  useEffect(() => {
    if (!engine || !document) return;
    if (engine.canvasSize.width === 0) return;

    engine.replayStrokes({
      groups: strokeHistory.groups,
      currentIndex: strokeHistory.currentIndex,
    });
  }, [strokeHistory.currentIndex, strokeHistory.groups, engine]);

  // 4. The Render Loop
  // React is driving the frame loop here via state updates (isDrawing, currentPoint)
  useEffect(() => {
    console.log("[CANVAS CONTAINER RENDER EFFECT] engine:", engine ? "exists" : "null", "canvasSize:", canvasSize, "zoom:", zoom, "viewOffset:", viewOffset);
    if (!engine) {
      console.log("[CANVAS CONTAINER RENDER EFFECT] Early return - no engine");
      return;
    }

    const previewState =
      isDrawing &&
      startPointRef.current &&
      tool != Tools.ERASER
        ? ({
            tool,
            color: activeColor,
            startPoint: startPointRef.current,
            currentPoint: currentPoint || startPointRef.current,
            points: previewPointsRef.current,
            toolConfig: toolConfig,
          } as AnyPreviewState)
        : undefined;

    console.log("[CANVAS CONTAINER RENDER EFFECT] Calling engine.render with canvasSize:", canvasSize);
    engine.render({ zoom, viewOffset, canvasSize }, ruler, previewState);
    console.log("[CANVAS CONTAINER RENDER EFFECT] engine.render completed");
  }, [
    engine,
    zoom,
    viewOffset,
    canvasSize,
    ruler,
    isDrawing,
    currentPoint,
    tool,
    toolConfig,
    activeColor,
  ]);

  // --- Event Handlers ---

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent text selection

      const canvasPoint = getScreenToCanvas(e.clientX, e.clientY);
      const screenPoint = getRelativePoint(e.clientX, e.clientY);

      if (!canvasPoint || !screenPoint) return;

      // 1. Pan Start (Middle Mouse or Ctrl+Left)
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        isPanningRef.current = true;
        panStartRef.current = canvasPoint; // Store canvas point for accurate delta
        setIsPanning(true);
        return;
      }

      // 2. Ruler Interaction
      if (
        ruler.visible &&
        ruler.isPointOnRuler(screenPoint, {
          width: containerRef.current!.offsetWidth,
          height: containerRef.current!.offsetHeight,
        })
      ) {
        startDragRuler(screenPoint);
        setIsRulerDragging(true);
        return;
      }

      // 3. Drawing Start
      let startDrawPoint = canvasPoint;
      startPointSnappedRef.current = false;

      if (ruler.visible) {
        const snapInfo = ruler.getSnapInfo(canvasPoint, viewStateRef.current);
        if (snapInfo.inStickyZone) {
          startDrawPoint = calculateSnappedPoint(
            canvasPoint,
            snapInfo,
            viewStateRef.current,
            tool,
            toolConfig,
          );
          if (tool === Tools.AREA) startPointSnappedRef.current = true;
        }
      }

      isDrawingRef.current = true;
      startPointRef.current = startDrawPoint;
      lastPointRef.current = startDrawPoint;
      previewPointsRef.current = [startDrawPoint];

      setIsDrawing(true); // Triggers render loop
      startStrokeGroup();
      startStroke(tool, toolConfig, activeColor, startDrawPoint);
    },
    [tool, toolConfig, activeColor, ruler, getScreenToCanvas, getRelativePoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvasPoint = getScreenToCanvas(e.clientX, e.clientY);
      const screenPoint = getRelativePoint(e.clientX, e.clientY);
      if (!canvasPoint || !screenPoint) return;

      // 1. Hover States
      if (!isDrawingRef.current && !isPanningRef.current && !ruler.isDragging) {
        const onRuler =
          ruler.visible &&
          ruler.isPointOnRuler(screenPoint, {
            width: containerRef.current!.offsetWidth,
            height: containerRef.current!.offsetHeight,
          });
        if (onRuler !== isRulerHover) setIsRulerHover(onRuler);
        return;
      }

      // 2. Panning
      if (isPanningRef.current && panStartRef.current) {
        // Calculate delta in canvas space, then apply to view offset
        // This is simplified; usually we pan based on screen delta / zoom
        const deltaX = panStartRef.current.x - canvasPoint.x;
        const deltaY = panStartRef.current.y - canvasPoint.y;

        setViewOffset({
          x: viewOffset.x + deltaX,
          y: viewOffset.y + deltaY,
        });
        return;
      }

      // 3. Ruler Dragging
      if (ruler.isDragging || isRulerDragging) {
        dragRuler(screenPoint);
        setRulerHash((h) => h + 1); // Force re-render
        return;
      }

      // 4. Drawing
      if (isDrawingRef.current && startPointRef.current) {
        let drawPoint = canvasPoint;

        if (ruler.visible) {
          const snapInfo = ruler.getSnapInfo(canvasPoint, viewStateRef.current);
          if (snapInfo.inStickyZone) {
            const shouldSnap =
              tool !== Tools.AREA || !startPointSnappedRef.current;
            if (shouldSnap) {
              drawPoint = calculateSnappedPoint(
                canvasPoint,
                snapInfo,
                viewStateRef.current,
                tool,
                toolConfig,
              );
            }
          }
        }

        setCurrentPoint(drawPoint); // Triggers render loop
        addPointToStroke(drawPoint);
        previewPointsRef.current.push(drawPoint);
        lastPointRef.current = drawPoint;
      }
    },
    [viewOffset, ruler, isRulerHover, isRulerDragging, tool, toolConfig],
  );

  const handleMouseUp = useCallback(() => {
    // 1. End Pan
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      setIsPanning(false);
      return;
    }

    // 2. End Ruler Drag
    if (ruler.isDragging || isRulerDragging) {
      endDragRuler();
      setIsRulerDragging(false);
      return;
    }

    // 3. End Draw
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      startPointRef.current = null;
      lastPointRef.current = null;
      startPointSnappedRef.current = false;
      previewPointsRef.current = [];

      setIsDrawing(false);
      setCurrentPoint(null);
      endStrokeGroup();
      document.markAsChanged();

      // Trigger Auto-Copy (Debounced)
      if (settings.autoCopyOnChange) {
        if (autoCopyTimerRef.current) clearTimeout(autoCopyTimerRef.current);

        autoCopyTimerRef.current = setTimeout(() => {
          const canvas = engine?.getFreshCombinedCanvas();
          if (canvas) {
            registerPendingCopy(document.version, true);
            services.ioService
              .copyToClipboard(canvas, document.version, {
                isAutoCopy: true,
                format: settings.autoCopyFormat,
                jpegQuality: settings.autoCopyJpegQuality,
              })
              .catch(console.error);
          }
        }, 200);
      }
    }
  }, [ruler, isRulerDragging, document, settings, engine]);

  // --- Wheel Event (Zoom/Pan/Rotate) ---
  // Attached imperatively to support non-passive event prevention
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Check boundaries
      if (!containerRectRef.current) return;
      // Note: we can skip bounds check if event is attached to container directly,
      // but if event bubbles, we need it. Here we attach to container, so it's safe.

      const { zoom: currentZoom, viewOffset: currentOffset } =
        viewStateRef.current;
      const scrollSpeed = 0.4;

      // 1. Zoom (Ctrl + Wheel)
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(10, currentZoom * delta));

        // Pass rect explicitely or ensure context handles it
        zoomAroundPoint(
          newZoom,
          e.clientX,
          e.clientY,
          containerRectRef.current!,
        );
      }
      // 2. Pan (Shift + Wheel)
      else if (e.shiftKey) {
        e.preventDefault();
        const scrollDelta =
          Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        setViewOffset({
          x: currentOffset.x + (scrollDelta * scrollSpeed) / currentZoom,
          y: currentOffset.y,
        });
      }
      // 3. Rotate Ruler (Only if mouse is on the ruler)
      else if (ruler.visible) {
        const screenPoint = {
          x: e.clientX - containerRectRef.current.left,
          y: e.clientY - containerRectRef.current.top,
        };
        const isOnRuler = ruler.isPointOnRuler(screenPoint, {
          width: containerRectRef.current.width,
          height: containerRectRef.current.height,
        });

        if (isOnRuler) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 1 : -1;
          rotateRuler(delta);
          setRulerHash((h) => h + 1);
        } else {
          // Mouse not on ruler - scroll the canvas instead
          e.preventDefault();
          setViewOffset({
            x: currentOffset.x,
            y: currentOffset.y + (e.deltaY * scrollSpeed) / currentZoom,
          });
        }
      }
      // 4. Vertical Pan (Default)
      else {
        e.preventDefault();
        setViewOffset({
          x: currentOffset.x,
          y: currentOffset.y + (e.deltaY * scrollSpeed) / currentZoom,
        });
      }
    };

    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    return () =>
      container.removeEventListener("wheel", handleWheel, { capture: true });
  }, [containerRef, ruler.visible, zoomAroundPoint, setViewOffset, rotateRuler]);

  // --- Render ---

  if (!document?.imageSrc) {
    return <EmptyState hotkeys={hotkeys} />;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-canvas-bg flex-1 min-h-0",
        className,
      )}
      style={{
        cursor:
          isPanning || isRulerDragging
            ? "grabbing"
            : isRulerHover
              ? "grab"
              : "crosshair",
        // CSS Pattern for transparency grid
        backgroundImage: `
          linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
          linear-gradient(-45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%),
          linear-gradient(-45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%)`,
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Reuse MouseUp logic to cancel drags
    >
      {settings.showDebugInfo && (
        <DebugOverlay
          zoom={zoom}
          viewOffset={viewOffset}
          ruler={ruler.visible ? ruler : null}
        />
      )}
    </div>
  );
}

// --- Subcomponents ---

function EmptyState({ hotkeys }: { hotkeys: any }) {
  return (
    <div
      className="relative flex items-center justify-center select-none bg-canvas-bg flex-1 min-h-0 w-full h-full"
      style={{
        backgroundImage: `
                linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
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

function DebugOverlay({
  zoom,
  viewOffset,
  ruler,
}: {
  zoom: number;
  viewOffset: Point;
  ruler: any;
}) {
  return (
    <div className="absolute bottom-4 right-4 bg-surface-bg/95 text-text-primary px-3 py-2 rounded-lg text-xs font-mono pointer-events-none select-none flex flex-col gap-1 border border-toolbar-border z-50">
      <div>Zoom: {Math.round(zoom * 100)}%</div>
      {(viewOffset.x !== 0 || viewOffset.y !== 0) && (
        <div className="text-text-muted">Panned</div>
      )}
      {ruler && (
        <div className="text-accent-primary">
          Ruler: {Math.round(ruler.angle % 360)}°
        </div>
      )}
    </div>
  );
}
