import type { RefObject } from "react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useCanvasEngine } from "~/contexts/CanvasEngineContext";
import { useDocument } from "~/contexts/DocumentContext";
import { useDrawing } from "~/contexts/DrawingContext";
import { useSettings } from "~/contexts/SettingsContext";
import { registerPendingCopy } from "~/hooks/useClipboardEvents";
import { useHotkeys } from "~/hooks/useKeyboardShortcuts";
import { cn } from "~/lib/utils";
import { services } from "~/services";
import {
  AnyPreviewState,
  type Point,
  type RulerSnapInfo,
  type ViewState,
} from "~/types";
import { ImageOpenBehaviors } from "~/types/settings";
import { Tools, type Tool, type ToolConfig } from "~/types/tools";
import { formatHotkey } from "~/utils/hotkeys";

interface CanvasContainerProps {
  className?: string;
  /** Optional external ref to control the container programmatically */
  containerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * CanvasContainer
 *
 * Acts as the bridge between React's declarative DOM/Event system and the
 * imperative CanvasEngine. It handles:
 * 1. Coordinate mapping (Screen space <-> World space)
 * 2. High-frequency event handling (Pointer/Wheel)
 * 3. View state management (Pan/Zoom)
 * 4. Tool lifecycle orchestration
 */
export function CanvasContainer({
  className,
  containerRef: externalRef,
}: CanvasContainerProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = (externalRef ||
    localRef) as React.RefObject<HTMLDivElement | null>;

  // Performance: Cache DOMRect to avoid layout thrashing (reflow) during high-frequency mouse events.
  const containerRectRef = useRef<DOMRect | null>(null);

  // --- Dependencies ---
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

  // --- Local Interaction State ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isRulerHover, setIsRulerHover] = useState(false);
  const [isRulerDragging, setIsRulerDragging] = useState(false);

  // Tracks updates to ruler position to force re-renders, distinct from the ruler object reference.
  const [, setRulerHash] = useState(0);

  // --- Event State Refs ---
  // Mutable refs are used here to access the latest state inside event listeners (closures)
  // without necessitating frequent re-binding of event handlers.
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const previewPointsRef = useRef<Point[]>([]);
  const startPointSnappedRef = useRef(false);
  const viewStateRef = useRef<ViewState>({ zoom, viewOffset, canvasSize });
  const autoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure viewStateRef is always synchronized for the next event loop
  useLayoutEffect(() => {
    viewStateRef.current = { zoom, viewOffset, canvasSize };
  }, [zoom, viewOffset, canvasSize]);

  // --- Coordinate Helpers ---

  /**
   * Converts client coordinates (browser viewport) to Canvas World coordinates.
   * Utilizes the cached DOMRect for performance.
   */
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

  /**
   * Converts client coordinates to Container Relative coordinates (0,0 is top-left of div).
   */
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

  // --- Snapping Logic ---

  const calculateSnappedPoint = useCallback(
    (
      canvasPoint: Point,
      snapInfo: RulerSnapInfo,
      viewState: ViewState,
      currentTool: Tool,
      config: ToolConfig,
    ): Point => {
      // Area tool specifically snaps to edges of the ruler, whereas brushes snap to the guide line.
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

  /**
   * Callback ref to notify the EngineProvider immediately upon DOM attachment.
   * Prevents race conditions between Provider initialization and Image loading.
   */
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (externalRef) {
        (externalRef as React.RefObject<HTMLDivElement | null>).current = node;
      } else {
        localRef.current = node;
      }

      if (typeof setCanvasRef === "function") {
        setCanvasRef(node);
      }
    },
    [externalRef, setCanvasRef],
  );

  // --- Lifecycle Effects ---

  // 1. Resize Observer: Maintain cached bounds for accurate coordinate conversion
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerRectRef.current = entry.target.getBoundingClientRect();
        if (engine) engine.render(viewStateRef.current, ruler);
      }
    });

    observer.observe(container);
    containerRectRef.current = container.getBoundingClientRect();

    return () => observer.disconnect();
  }, [containerRef, engine, ruler]);

  // 2. Image Loading & Initialization
  useEffect(() => {
    if (!document?.imageSrc || !engine) return;

    let mounted = true;

    engine.loadImage(document.imageSrc).then(() => {
      if (!mounted) return;

      if (engine.canvasSize.width > 0) {
        const loadedSize = engine.canvasSize;
        setCanvasSize(loadedSize);
        document.setCanvasSize(loadedSize);

        // Apply initial viewport fit strategy
        if (!document.hasAppliedInitialFit) {
          document.hasAppliedInitialFit = true;
          if (
            settings.miscSettings.imageOpenBehavior === ImageOpenBehaviors.FIT
          ) {
            stretchToFill(loadedSize);
          } else {
            fitToWindow(loadedSize);
          }
        }

        // Hydrate history
        engine.replayStrokes({
          groups: strokeHistory.groups,
          currentIndex: strokeHistory.currentIndex,
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, [document?.imageSrc, engine]); // Dependencies intentionally kept minimal to prevent reload loops

   // 3. History Synchronization
   useEffect(() => {
     if (!engine || !document) return;
     if (engine.canvasSize.width === 0) return;

     engine.replayStrokes({
       groups: strokeHistory.groups,
       currentIndex: strokeHistory.currentIndex,
     });

     engine.render({ zoom, viewOffset, canvasSize }, ruler);
   }, [strokeHistory.currentIndex, strokeHistory.groups, engine, zoom, viewOffset, canvasSize, ruler]);

  // 4. Main Render Loop
  // The Engine is imperative; this effect bridges declarative React state changes
  // to the Engine's render method.
  useEffect(() => {
    if (!engine) return;

    // Construct preview state for active drawing operations
    const previewState =
      isDrawing && startPointRef.current && tool != Tools.ERASER
        ? ({
            tool,
            color: activeColor,
            startPoint: startPointRef.current,
            currentPoint: currentPoint || startPointRef.current,
            points: previewPointsRef.current,
            toolConfig: toolConfig,
          } as AnyPreviewState)
        : undefined;

    engine.render({ zoom, viewOffset, canvasSize }, ruler, previewState);
  }, [
    engine,
    zoom,
    viewOffset,
    canvasSize,
    ruler.angle,
    ruler.x,
    ruler.y,
    ruler.visible,
    isDrawing,
    currentPoint,
    tool,
    toolConfig,
    activeColor,
  ]);

  // --- Input Handlers ---

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Suppress browser text selection

      const canvasPoint = getScreenToCanvas(e.clientX, e.clientY);
      const screenPoint = getRelativePoint(e.clientX, e.clientY);

      if (!canvasPoint || !screenPoint) return;

      // Interaction Priority:
      // 1. Pan (Middle Mouse / Ctrl+Left)
      // 2. Ruler Manipulation
      // 3. Drawing/Tools

      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        isPanningRef.current = true;
        panStartRef.current = canvasPoint;
        setIsPanning(true);
        return;
      }

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

      // Begin Drawing Sequence
      let startDrawPoint = canvasPoint;
      startPointSnappedRef.current = false;

      // Calculate initial snap if applicable
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

      setIsDrawing(true);
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

      // -- Passive Hover State --
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

      // -- Active Panning --
      if (isPanningRef.current && panStartRef.current) {
        // Delta is calculated in World Space to maintain sync with cursor
        const deltaX = panStartRef.current.x - canvasPoint.x;
        const deltaY = panStartRef.current.y - canvasPoint.y;

        setViewOffset({
          x: viewOffset.x + deltaX,
          y: viewOffset.y + deltaY,
        });
        return;
      }

      // -- Ruler Manipulation --
      if (ruler.isDragging || isRulerDragging) {
        dragRuler(screenPoint);
        setRulerHash((h) => h + 1);
        return;
      }

      // -- Active Drawing --
      if (isDrawingRef.current && startPointRef.current) {
        let drawPoint = canvasPoint;

        // Dynamic snapping during stroke
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

        setCurrentPoint(drawPoint);
        addPointToStroke(drawPoint);
        previewPointsRef.current.push(drawPoint);
        lastPointRef.current = drawPoint;
      }
    },
    [viewOffset, ruler, isRulerHover, isRulerDragging, tool, toolConfig],
  );

  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      setIsPanning(false);
      return;
    }

    if (ruler.isDragging || isRulerDragging) {
      endDragRuler();
      setIsRulerDragging(false);
      return;
    }

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

      // Handle Auto-Copy workflow (Debounced to prevent clipboard spam)
      if (settings.copySettings.autoCopyOnChange) {
        if (autoCopyTimerRef.current) clearTimeout(autoCopyTimerRef.current);

        autoCopyTimerRef.current = setTimeout(() => {
          const canvas = engine?.getFreshCombinedCanvas();
          if (canvas) {
            registerPendingCopy(document.version, true);
            services.ioService
              .copyToClipboard(canvas, document.version, {
                isAutoCopy: true,
                format: settings.copySettings.autoCopyFormat,
                jpegQuality: settings.copySettings.autoCopyJpegQuality,
              })
              .catch(console.error);
          }
        }, 200);
      }
    }
  }, [ruler, isRulerDragging, document, settings, engine]);

  // --- Wheel Event Interceptor ---
  // Must be attached imperatively to support { passive: false }, allowing
  // e.preventDefault() to block browser-level zooming.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!containerRectRef.current) return;

      const { zoom: currentZoom, viewOffset: currentOffset } =
        viewStateRef.current;
      const scrollSpeed = 0.4;

      // 1. Zoom (Ctrl + Wheel)
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(10, currentZoom * delta));

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
      // 3. Ruler Rotation (Mouse over Ruler)
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
          // Fallback to vertical pan if not on ruler
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
  }, [
    containerRef,
    ruler.visible,
    zoomAroundPoint,
    setViewOffset,
    rotateRuler,
  ]);

  // --- Render ---

  if (!document?.imageSrc) {
    return <EmptyState hotkeys={hotkeys} />;
  }

  return (
    <div
      ref={setContainerRef}
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
      onMouseLeave={handleMouseUp}
    >
      {settings.miscSettings.showDebugInfo && (
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
