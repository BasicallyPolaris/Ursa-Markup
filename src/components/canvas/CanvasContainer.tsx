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
import { useToolCursor } from "~/hooks/useToolCursor";
import { cn } from "~/lib/utils";
import { services } from "~/services";
import {
  AnyPreviewState,
  type Point,
  type RulerSnapInfo,
  type ViewState,
} from "~/types";
import { ImageOpenBehaviors } from "~/types/settings";
import {
  EraserToolConfig,
  Tools,
  type Tool,
  type ToolConfig,
} from "~/types/tools";
import { DebugOverlay } from "./DebugOverlay";
import { EmptyState } from "./EmptyState";

/* eslint-disable react-hooks/exhaustive-deps */

type CanvasContainerProps = {
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
};

export function CanvasContainer({
  className,
  containerRef: externalRef,
}: CanvasContainerProps) {
  // Use state to trigger the effect only when the node is actually ready
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(
    null,
  );

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
    abortStrokeGroup,
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

  const { tool, toolConfig, activeColor, setIsDrawing } = useDrawing();
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
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const currentPointRef = useRef<Point | null>(null);
  const previewPointsRef = useRef<Point[]>([]);
  const startPointSnappedRef = useRef(false);

  // Loop Sync Refs
  const engineRef = useRef(engine);
  const rulerRef = useRef(ruler);
  const viewStateRef = useRef<ViewState>({ zoom, viewOffset, canvasSize });
  const toolRef = useRef(tool);
  const toolConfigRef = useRef(toolConfig);
  const activeColorRef = useRef(activeColor);

  const needsRender = useRef(true);
  const autoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const interactionState = {
    isPanning,
    isRulerHover,
    isRulerDragging,
  };
  const cursorStyle = useToolCursor(tool, toolConfig, zoom, interactionState);

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

  // --- Ruler Visibility Change ---
  useEffect(() => {
    needsRender.current = true;
  }, [ruler.visible]);

  // --- Ref Callback ---
  const setContainerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (externalRef) {
        (externalRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }
      if (typeof setCanvasRef === "function") {
        setCanvasRef(node);
      }
      setContainerNode(node);
      if (node) {
        containerRectRef.current = node.getBoundingClientRect();
      }
    },
    [externalRef, setCanvasRef],
  );

  // --- Robust Resize Observer ---
  useEffect(() => {
    if (!containerNode) return;
    needsRender.current = true;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerRectRef.current = entry.target.getBoundingClientRect();
        needsRender.current = true;
      }
    });
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [containerNode]);

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

  // --- Sync History Changes (Fix 1 Implementation) ---
  useEffect(() => {
    if (!engine || !document) return;
    if (engine.canvasSize.width === 0) return;

    // 1. Replay history (renders all strokes, including the new eraser stroke if any)
    engine.replayStrokes({
      groups: strokeHistory.groups,
      currentIndex: strokeHistory.currentIndex,
    });

    // 2. NOW it is safe to clear the preview, because the persistent history layer
    // has taken over the job of "erasing" the strokes.
    // This prevents the "flash" where strokes momentarily reappear.
    engine.clearEraserPreview();

    needsRender.current = true;
  }, [strokeHistory.currentIndex, strokeHistory.groups, engine, document]);

  // --- Animation Loop ---
  useEffect(() => {
    let animationFrameId: number;
    const renderLoop = () => {
      const engine = engineRef.current;
      const rect = containerRectRef.current;
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
        const toolConfig = toolConfigRef.current;

        let previewState: AnyPreviewState | undefined;

        if (isDrawing && startPoint && activeTool !== Tools.ERASER) {
          previewState = {
            tool: activeTool,
            color: activeColorRef.current,
            startPoint: startPoint,
            currentPoint: currentPoint || startPoint,
            points: previewPointsRef.current,
            toolConfig: toolConfig,
          } as AnyPreviewState;
        }

        engine.render(
          viewStateRef.current,
          rulerRef.current,
          { width: rect.width, height: rect.height },
          previewState,
        );
        needsRender.current = false;
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- Input Handlers (Pointer Down/Up/Move) ---

  const handlePointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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

      isDrawingRef.current = true;
      startPointRef.current = startDrawPoint;
      lastPointRef.current = startDrawPoint;
      currentPointRef.current = startDrawPoint;
      previewPointsRef.current = [startDrawPoint];

      startStrokeGroup();
      startStroke(tool, toolConfig, activeColor, startDrawPoint);
      setIsDrawing(true);
    },
    [tool, toolConfig, activeColor, ruler, getScreenToCanvas, getRelativePoint, calculateSnappedPoint, setIsDrawing, startDragRuler, startStroke, startStrokeGroup],
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
      const wasDrawing = isDrawingRef.current;
      const activeTool = toolRef.current;

      isDrawingRef.current = false;
      startPointRef.current = null;
      lastPointRef.current = null;
      currentPointRef.current = null;
      startPointSnappedRef.current = false;
      previewPointsRef.current = [];

      setIsDrawing(false);

      let shouldCommit = true;

      // --- Fix 2: "No-Op" Detection ---
      if (wasDrawing && activeTool === Tools.ERASER && engine) {
        // Instead of computationally expensive recalculation, check if the engine
        // actually hid anything during the drag.
        const didEraseAnything = engine.hasEraserChangedAnything();

        if (!didEraseAnything) {
          shouldCommit = false;
          // If we abort, we MUST clear the preview immediately because the history
          // effect hook will not run (since history didn't change).
          engine.clearEraserPreview();
          needsRender.current = true;
        } else {
          // If committing, DO NOT clear preview here.
          // It will be cleared in the strokeHistory useEffect to prevent ghosting.
        }
      }

      if (shouldCommit) {
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
      } else {
        abortStrokeGroup();
      }
    }
  }, [
    ruler,
    isRulerDragging,
    document,
    settings,
    engine,
    endStrokeGroup,
    abortStrokeGroup,
    endDragRuler,
    setIsDrawing,
  ]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      switch (true) {
        case isDrawingRef.current && !!startPointRef.current: {
          needsRender.current = true;
          const events =
            "getCoalescedEvents" in e.nativeEvent
              ? (e.nativeEvent as PointerEvent).getCoalescedEvents()
              : [e];

          events.forEach((evt) => {
            const canvasPoint = getScreenToCanvas(evt.clientX, evt.clientY);
            if (!canvasPoint) return;
            let drawPoint = canvasPoint;
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

            if (tool === Tools.ERASER && engine) {
              const didHide = engine.updateEraserPreview(
                drawPoint,
                (toolConfig as EraserToolConfig).size,
              );
              // If we hid something new, trigger render to show the disappearance
              if (didHide) {
                needsRender.current = true;
                // We rely on the engine's internal `previewHiddenStrokes` set
                // rather than calling replayStrokes here, because replayStrokes
                // is for committed history.
                // The render loop calls `computeVisibleStrokes` which checks the set.
              }
            }

            currentPointRef.current = drawPoint;
            previewPointsRef.current.push(drawPoint);
            lastPointRef.current = drawPoint;
            addPointToStroke(drawPoint);
          });
          break;
        }

        case isPanningRef.current && !!panStartRef.current: {
          needsRender.current = true;
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

        case ruler.isDragging || isRulerDragging: {
          needsRender.current = true;
          const screenPoint = getRelativePoint(e.clientX, e.clientY);
          if (screenPoint) {
            dragRuler(screenPoint);
            setRulerHash((h) => h + 1);
          }
          break;
        }

        default: {
          const screenPoint = getRelativePoint(e.clientX, e.clientY);
          const canvasPoint = getScreenToCanvas(e.clientX, e.clientY);
          const rect = containerRectRef.current;

          if (rect && screenPoint && ruler.visible) {
            const onRuler = ruler.isPointOnRuler(screenPoint, {
              width: rect.width,
              height: rect.height,
            });
            if (onRuler !== isRulerHover) setIsRulerHover(onRuler);
          }
          if (tool === Tools.ERASER && canvasPoint) {
            currentPointRef.current = canvasPoint;
            needsRender.current = true;
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
      engine,
    ],
  );

  // Wheel Handler
  useEffect(() => {
    if (!containerNode) return; // Wait for node
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
        if (
          ruler.isPointOnRuler(screenPoint, {
            width: containerRectRef.current.width,
            height: containerRectRef.current.height,
          })
        ) {
          e.preventDefault();
          rotateRuler(e.deltaY > 0 ? 1 : -1);
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
    containerNode.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    return () =>
      containerNode.removeEventListener("wheel", handleWheel, {
        capture: true,
      });
  }, [
    containerNode,
    ruler,
    zoomAroundPoint,
    setViewOffset,
    rotateRuler,
  ]);

  if (!document?.imageSrc) {
    return <EmptyState hotkeys={hotkeys} />;
  }

  return (
    <div
      ref={setContainerRefCallback}
      tabIndex={-1}
      className={cn(
        "relative overflow-hidden bg-canvas-bg flex-1 min-h-0 w-full h-full focus:outline-none",
        className,
      )}
      style={{
        cursor: cursorStyle,
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
