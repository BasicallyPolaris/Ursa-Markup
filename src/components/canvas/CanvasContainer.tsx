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
import { DebugOverlay } from "./DebugOverlay";
import { EmptyState } from "./EmptyState";

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

  // Performance: Cache DOMRect to avoid layout thrashing.
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
  // We keep state for things that change the UI Cursor (CSS)
  const [isPanning, setIsPanning] = useState(false);
  const [isRulerHover, setIsRulerHover] = useState(false);
  const [isRulerDragging, setIsRulerDragging] = useState(false);

  // Tracks updates to ruler position to force re-renders if the UI needs it
  const [, setRulerHash] = useState(0);

  // --- Event State Refs ---
  // Using Refs allows the Animation Loop to access the latest state without triggering re-renders
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const currentPointRef = useRef<Point | null>(null);
  const previewPointsRef = useRef<Point[]>([]);
  const startPointSnappedRef = useRef(false);

  // Loop Sync Refs (To avoid stale closures in the loop)
  const engineRef = useRef(engine);
  const rulerRef = useRef(ruler);
  const viewStateRef = useRef<ViewState>({ zoom, viewOffset, canvasSize });
  const toolRef = useRef(tool);
  const toolConfigRef = useRef(toolConfig);
  const activeColorRef = useRef(activeColor);

  // Used to distinguish render modes depending on user actions
  const needsRender = useRef(true);

  const autoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Synchronization Effects ---
  useLayoutEffect(() => {
    viewStateRef.current = { zoom, viewOffset, canvasSize };
    rulerRef.current = ruler;
    engineRef.current = engine;
    toolRef.current = tool;
    toolConfigRef.current = toolConfig;
    activeColorRef.current = activeColor;
    needsRender.current = true;
  }, [
    zoom,
    viewOffset,
    canvasSize,
    ruler,
    engine,
    tool,
    toolConfig,
    activeColor,
  ]);

  // --- Measurements & Initialization ---

  const setContainerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (externalRef) {
        (externalRef as React.RefObject<HTMLDivElement | null>).current = node;
      } else {
        localRef.current = node;
      }

      if (node) {
        containerRectRef.current = node.getBoundingClientRect();
      }

      if (typeof setCanvasRef === "function") {
        setCanvasRef(node);
      }
    },
    [externalRef, setCanvasRef],
  );

  // Resize Observer
  useEffect(() => {
    const node = externalRef?.current || localRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerRectRef.current = entry.target.getBoundingClientRect();
        needsRender.current = true;
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [externalRef]);

  // --- Helper Methods ---

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

  const calculateSnappedPoint = useCallback(
    (
      canvasPoint: Point,
      snapInfo: RulerSnapInfo,
      viewState: ViewState,
      currentTool: Tool,
      config: ToolConfig,
    ): Point => {
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

  // --- Image Loading ---

  useEffect(() => {
    if (!document?.imageSrc || !engine) return;

    let mounted = true;

    engine.loadImage(document.imageSrc).then(() => {
      if (!mounted) return;

      if (engine.canvasSize.width > 0) {
        const loadedSize = engine.canvasSize;
        setCanvasSize(loadedSize);
        document.setCanvasSize(loadedSize);

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

        engine.replayStrokes({
          groups: strokeHistory.groups,
          currentIndex: strokeHistory.currentIndex,
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, [document?.imageSrc, engine]);

  useEffect(() => {
    if (!engine || !document) return;
    if (engine.canvasSize.width === 0) return;

    engine.replayStrokes({
      groups: strokeHistory.groups,
      currentIndex: strokeHistory.currentIndex,
    });

    needsRender.current = true;
  }, [strokeHistory.currentIndex, strokeHistory.groups, engine]);

  // --- Animation Loop ---

  // --- Animation Loop ---
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      const engine = engineRef.current;
      const rect = containerRectRef.current;

      // OPTIMIZATION: Only render if input happened (needsRender)
      if (
        needsRender.current &&
        engine &&
        rect &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        const isDrawing = isDrawingRef.current;
        const startPoint = startPointRef.current;
        const currentPoint = currentPointRef.current;
        const activeTool = toolRef.current;

        const previewState =
          isDrawing && startPoint && activeTool !== Tools.ERASER
            ? ({
                tool: activeTool,
                color: activeColorRef.current,
                startPoint: startPoint,
                currentPoint: currentPoint || startPoint,
                points: previewPointsRef.current,
                toolConfig: toolConfigRef.current,
              } as AnyPreviewState)
            : undefined;

        engine.render(
          viewStateRef.current,
          rulerRef.current,
          { width: rect.width, height: rect.height },
          previewState,
        );

        // Go back to sleep until next input
        needsRender.current = false;
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- Input Handlers ---

  const handlePointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // Grab focus from other elements to ensure keyboard shortcuts work as expected
      (e.currentTarget as HTMLElement).focus();

      const canvasPoint = getScreenToCanvas(e.clientX, e.clientY);
      const screenPoint = getRelativePoint(e.clientX, e.clientY);

      if (!canvasPoint || !screenPoint) return;

      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        isPanningRef.current = true;
        panStartRef.current = canvasPoint;
        setIsPanning(true);
        return;
      }

      const rect = containerRectRef.current;

      if (
        ruler.visible &&
        rect &&
        ruler.isPointOnRuler(screenPoint, {
          width: rect.width,
          height: rect.height,
        })
      ) {
        startDragRuler(screenPoint);
        setIsRulerDragging(true);
        return;
      }

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

      // Sync Refs directly
      isDrawingRef.current = true;
      startPointRef.current = startDrawPoint;
      lastPointRef.current = startDrawPoint;
      currentPointRef.current = startDrawPoint;
      previewPointsRef.current = [startDrawPoint];

      // No useState calls here!
      startStrokeGroup();
      startStroke(tool, toolConfig, activeColor, startDrawPoint);
    },
    [tool, toolConfig, activeColor, ruler, getScreenToCanvas, getRelativePoint],
  );

  const handlePointerUp = useCallback(() => {
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
      currentPointRef.current = null;
      startPointSnappedRef.current = false;
      previewPointsRef.current = [];

      // Removed setIsDrawing(false) and setCurrentPoint(null)

      endStrokeGroup();
      document.markAsChanged();

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

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      switch (true) {
        // --- CASE 1: DRAWING (High Precision) ---
        case isDrawingRef.current && !!startPointRef.current: {
          needsRender.current = true; // Wake up renderer

          const events =
            "getCoalescedEvents" in e.nativeEvent
              ? (e.nativeEvent as PointerEvent).getCoalescedEvents()
              : [e];

          events.forEach((evt) => {
            const canvasPoint = getScreenToCanvas(evt.clientX, evt.clientY);
            if (!canvasPoint) return;

            let drawPoint = canvasPoint;

            // Apply Snapping (Per sub-pixel point for accuracy)
            if (ruler.visible) {
              const snapInfo = ruler.getSnapInfo(
                canvasPoint,
                viewStateRef.current,
              );
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

            // Update Refs
            currentPointRef.current = drawPoint;
            previewPointsRef.current.push(drawPoint);
            lastPointRef.current = drawPoint;
            addPointToStroke(drawPoint);
          });
          break;
        }

        // --- CASE 2: PANNING (Standard Precision) ---
        case isPanningRef.current && !!panStartRef.current: {
          needsRender.current = true; // Wake up renderer

          const canvasPoint = getScreenToCanvas(e.clientX, e.clientY);
          if (canvasPoint) {
            const deltaX = panStartRef.current.x - canvasPoint.x;
            const deltaY = panStartRef.current.y - canvasPoint.y;
            setViewOffset({
              x: viewOffset.x + deltaX,
              y: viewOffset.y + deltaY,
            });
          }
          break;
        }

        // --- CASE 3: RULER DRAGGING (Standard Precision) ---
        case ruler.isDragging || isRulerDragging: {
          needsRender.current = true; // Wake up renderer

          const screenPoint = getRelativePoint(e.clientX, e.clientY);
          if (screenPoint) {
            dragRuler(screenPoint);
            setRulerHash((h) => h + 1);
          }
          break;
        }

        // --- DEFAULT: PASSIVE HOVER (Idle) ---
        default: {
          const screenPoint = getRelativePoint(e.clientX, e.clientY);
          const rect = containerRectRef.current;

          if (rect && screenPoint && ruler.visible) {
            const onRuler = ruler.isPointOnRuler(screenPoint, {
              width: rect.width,
              height: rect.height,
            });

            if (onRuler !== isRulerHover) setIsRulerHover(onRuler);
          }
          break;
        }
      }
    },
    [
      viewOffset,
      ruler,
      isRulerHover,
      isRulerDragging,
      tool,
      toolConfig,
      getScreenToCanvas,
      getRelativePoint,
      calculateSnappedPoint,
      addPointToStroke,
      dragRuler,
      setViewOffset,
    ],
  );

  // Wheel Event Handler
  useEffect(() => {
    const node = externalRef?.current || localRef.current;
    if (!node) return;

    const handleWheel = (e: WheelEvent) => {
      if (!containerRectRef.current) return;

      needsRender.current = true;

      const { zoom: currentZoom, viewOffset: currentOffset } =
        viewStateRef.current;
      const scrollSpeed = 0.4;

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
      } else if (e.shiftKey) {
        e.preventDefault();
        const scrollDelta =
          Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        setViewOffset({
          x: currentOffset.x + (scrollDelta * scrollSpeed) / currentZoom,
          y: currentOffset.y,
        });
      } else if (ruler.visible) {
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
          e.preventDefault();
          setViewOffset({
            x: currentOffset.x,
            y: currentOffset.y + (e.deltaY * scrollSpeed) / currentZoom,
          });
        }
      } else {
        e.preventDefault();
        setViewOffset({
          x: currentOffset.x,
          y: currentOffset.y + (e.deltaY * scrollSpeed) / currentZoom,
        });
      }
    };

    node.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    return () =>
      node.removeEventListener("wheel", handleWheel, { capture: true });
  }, [externalRef, ruler.visible, zoomAroundPoint, setViewOffset, rotateRuler]);

  if (!document?.imageSrc) {
    return <EmptyState hotkeys={hotkeys} />;
  }

  return (
    <div
      ref={setContainerRefCallback}
      tabIndex={-1}
      className={cn(
        "relative overflow-hidden bg-canvas-bg flex-1 min-h-0 focus:outline-none",
        className,
      )}
      style={{
        cursor:
          isPanning || isRulerDragging
            ? "grabbing"
            : isRulerHover
              ? "grab"
              : "crosshair",
        backgroundImage: `
          linear-gradient(45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
          linear-gradient(-45deg, hsl(var(--canvas-pattern)) 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%),
          linear-gradient(-45deg, transparent 75%, hsl(var(--canvas-pattern)) 75%)`,
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {settings.miscSettings.showDebugInfo && (
        <DebugOverlay zoom={zoom} viewOffset={viewOffset} ruler={ruler} />
      )}
    </div>
  );
}
