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
import type { Point, Size } from "../types";

interface CanvasEngineContextValue {
  engine: CanvasEngine | null;
  // Optional: allow components to notify the provider of the actual DOM node
  setCanvasRef?: (node: HTMLElement | null) => void;
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

  // Sync local state with document when document changes
  // This handles the case where an empty document is reused and loadImage() resets its state
  useEffect(() => {
    const handleDocumentChange = () => {
      console.log("[DOC CHANGE] zoom:", document.zoom, "viewOffset:", document.viewOffset, "canvasSize:", document.canvasSize);
      setZoomState(document.zoom);
      setViewOffsetState(document.viewOffset);
      setCanvasSize(document.canvasSize);
    };

    document.onChange(handleDocumentChange);
    return () => {
      document.offChange(handleDocumentChange);
    };
  }, [document]);

  // Initialize engine when container is available
  useEffect(() => {
    console.log("[CANVAS ENGINE CONTEXT] Init effect running, engine:", engine ? "exists" : "null", "container:", containerRef.current ? "exists" : "null");
    const container = containerRef.current;
    if (!container) {
      console.log("[CANVAS ENGINE CONTEXT] No container, returning");
      return;
    }

    if (!engine) {
      console.log("[CANVAS ENGINE CONTEXT] Creating new engine");
      const newEngine = new CanvasEngineClass();
      newEngine.initialize(container);
      setEngine(newEngine);
      console.log("[CANVAS ENGINE CONTEXT] Engine set");
    }

    return () => {
      if (engine) {
        engine.destroy();
      }
    };
  }, [engine, containerRef.current]);

  // Allow imperative initialization from consumers (e.g. CanvasContainer)
  const setCanvasRef = useCallback((node: HTMLElement | null) => {
    if (!node) {
      if (engine) {
        engine.destroy();
        setEngine(null);
      }
      return;
    }

    if (!engine) {
      const newEngine = new CanvasEngineClass();
      newEngine.initialize(node);
      setEngine(newEngine);
    }
  }, [engine]);

  const setZoom = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
      setZoomState(clampedZoom);
      // Persist through Document API so listeners are notified
      document.setZoom(clampedZoom);
    },
    [document],
  );

  const setViewOffset = useCallback(
    (offset: Point) => {
      setViewOffsetState(offset);
      // Persist through Document API so listeners are notified
      document.setViewOffset(offset);
    },
    [document],
  );

  const setCanvasSizeValue = useCallback(
    (size: Size) => {
      setCanvasSize(size);
      // Persist through Document API so listeners are notified
      document.setCanvasSize(size);
    },
    [document],
  );

  const fitToWindow = useCallback(
    (size?: Size) => {
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
      // Persist through Document API
      document.setZoom(finalZoom);
      document.setViewOffset(newOffset);
    },
    [containerRef, canvasSize, document],
  );

  const stretchToFill = useCallback(
    (size?: Size) => {
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
      // Zoom in or out to fill the canvas (max 500% to match other zoom limits)
      const finalZoom = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)));

      const imageScreenWidth = targetSize.width * finalZoom;
      const imageScreenHeight = targetSize.height * finalZoom;

      const panX = (containerWidth - imageScreenWidth) / 2;
      const panY = (containerHeight - imageScreenHeight) / 2;
      const newOffset = { x: -panX / finalZoom, y: -panY / finalZoom };

      setZoomState(finalZoom);
      setViewOffsetState(newOffset);
      // Persist through Document API
      document.setZoom(finalZoom);
      document.setViewOffset(newOffset);
    },
    [containerRef, canvasSize, document],
  );

  const centerImage = useCallback(
    (size?: Size) => {
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
      // Persist through Document API
      document.setViewOffset(newOffset);
    },
    [containerRef, canvasSize, zoom, document],
  );

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
      // Persist through Document API
      document.setZoom(clampedZoom);
      document.setViewOffset(newOffset);
    },
    [zoom, viewOffset, document],
  );

  const value: CanvasEngineContextValue = {
    engine,
    setCanvasRef,
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
