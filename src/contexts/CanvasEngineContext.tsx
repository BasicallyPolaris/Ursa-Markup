/**
 * CanvasEngineContext - Manages CanvasEngine instance
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { CanvasEngine, Document } from "../core";
import { CanvasEngine as CanvasEngineClass } from "../core";
import type { Point, Size } from "../core";

interface CanvasEngineContextValue {
  engine: CanvasEngine | null;
  zoom: number;
  viewOffset: Point;
  canvasSize: Size;
  setZoom: (zoom: number) => void;
  setViewOffset: (offset: Point) => void;
  setCanvasSize: (size: Size) => void;
  fitToWindow: (size?: Size) => void;
  stretchToFill: (size?: Size) => void;
  centerImage: (size?: Size) => void;
  zoomAroundPoint: (
    newZoom: number,
    screenX: number,
    screenY: number,
    containerRect: DOMRect,
  ) => void;
}

const CanvasEngineContext = createContext<CanvasEngineContextValue | null>(
  null,
);

interface CanvasEngineProviderProps {
  containerRef: React.RefObject<HTMLElement | null>;
  document: Document;
  children: React.ReactNode;
}

export function CanvasEngineProvider({
  containerRef,
  document,
  children,
}: CanvasEngineProviderProps) {
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  // Initialize from document's persisted values
  const [zoom, setZoomState] = useState<number>(document.zoom);
  const [viewOffset, setViewOffsetState] = useState<Point>(document.viewOffset);
  const [canvasSize, setCanvasSize] = useState<Size>(document.canvasSize);

  // Initialize engine when container is available
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!engine) {
      const newEngine = new CanvasEngineClass();
      newEngine.initialize(container);
      setEngine(newEngine);
    }

    return () => {
      if (engine) {
        engine.destroy();
      }
    };
  }, [containerRef, engine]);

  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
    setZoomState(clampedZoom);
    document.zoom = clampedZoom; // Persist to document
  }, [document]);

  const setViewOffset = useCallback((offset: Point) => {
    setViewOffsetState(offset);
    document.viewOffset = offset; // Persist to document
  }, [document]);

  const setCanvasSizeValue = useCallback((size: Size) => {
    setCanvasSize(size);
    document.canvasSize = size; // Persist to document
  }, [document]);

  const fitToWindow = useCallback((size?: Size) => {
    const container = containerRef.current;
    if (!container) return;
    
    const targetSize = size || canvasSize;
    if (targetSize.width === 0 || targetSize.height === 0) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const padding = 40;

    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    const scaleX = availableWidth / targetSize.width;
    const scaleY = availableHeight / targetSize.height;
    const newZoom = Math.min(scaleX, scaleY, 1);
    const finalZoom = Math.max(0.1, newZoom);

    const imageScreenWidth = targetSize.width * finalZoom;
    const imageScreenHeight = targetSize.height * finalZoom;

    const panX = (containerWidth - imageScreenWidth) / 2;
    const panY = (containerHeight - imageScreenHeight) / 2;
    const newOffset = { x: -panX / finalZoom, y: -panY / finalZoom };

    setZoomState(finalZoom);
    setViewOffsetState(newOffset);
    document.zoom = finalZoom;
    document.viewOffset = newOffset;
  }, [containerRef, canvasSize, document]);

  const stretchToFill = useCallback((size?: Size) => {
    const container = containerRef.current;
    if (!container) return;

    const targetSize = size || canvasSize;
    if (targetSize.width === 0 || targetSize.height === 0) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const padding = 40;

    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    const scaleX = availableWidth / targetSize.width;
    const scaleY = availableHeight / targetSize.height;
    // Zoom in or out to fill the canvas
    const finalZoom = Math.max(0.1, Math.min(10, Math.min(scaleX, scaleY)));

    const imageScreenWidth = targetSize.width * finalZoom;
    const imageScreenHeight = targetSize.height * finalZoom;

    const panX = (containerWidth - imageScreenWidth) / 2;
    const panY = (containerHeight - imageScreenHeight) / 2;
    const newOffset = { x: -panX / finalZoom, y: -panY / finalZoom };

    setZoomState(finalZoom);
    setViewOffsetState(newOffset);
    document.zoom = finalZoom;
    document.viewOffset = newOffset;
  }, [containerRef, canvasSize, document]);

  const centerImage = useCallback((size?: Size) => {
    const container = containerRef.current;
    if (!container) return;

    const targetSize = size || canvasSize;
    if (targetSize.width === 0 || targetSize.height === 0) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // Center the image at current zoom level (don't change zoom)
    const imageScreenWidth = targetSize.width * zoom;
    const imageScreenHeight = targetSize.height * zoom;
    const panX = (containerWidth - imageScreenWidth) / 2;
    const panY = (containerHeight - imageScreenHeight) / 2;
    const newOffset = { x: -panX / zoom, y: -panY / zoom };

    setViewOffsetState(newOffset);
    document.viewOffset = newOffset;
  }, [containerRef, canvasSize, zoom, document]);

  const zoomAroundPoint = useCallback(
    (
      newZoom: number,
      screenX: number,
      screenY: number,
      containerRect: DOMRect,
    ) => {
      const mouseScreenX = screenX - containerRect.left;
      const mouseScreenY = screenY - containerRect.top;

      // Calculate canvas coordinates at current zoom
      const canvasX = mouseScreenX / zoom + viewOffset.x;
      const canvasY = mouseScreenY / zoom + viewOffset.y;

      // Calculate new view offset to keep canvas point under mouse
      const newViewOffsetX = canvasX - mouseScreenX / newZoom;
      const newViewOffsetY = canvasY - mouseScreenY / newZoom;

      const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
      const newOffset = { x: newViewOffsetX, y: newViewOffsetY };
      
      setZoomState(clampedZoom);
      setViewOffsetState(newOffset);
      document.zoom = clampedZoom;
      document.viewOffset = newOffset;
    },
    [zoom, viewOffset, document],
  );

  const value: CanvasEngineContextValue = {
    engine,
    zoom,
    viewOffset,
    canvasSize,
    setZoom,
    setViewOffset,
      setCanvasSize: setCanvasSizeValue,
      fitToWindow,
      stretchToFill,
      centerImage,
      zoomAroundPoint,

  };

  return (
    <CanvasEngineContext.Provider value={value}>
      {children}
    </CanvasEngineContext.Provider>
  );
}

export function useCanvasEngine(): CanvasEngineContextValue {
  const context = useContext(CanvasEngineContext);
  if (!context) {
    throw new Error(
      "useCanvasEngine must be used within a CanvasEngineProvider",
    );
  }
  return context;
}

export { CanvasEngineContext };
