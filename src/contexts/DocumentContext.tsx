/**
 * DocumentContext - Bridges active Document with React
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Document, Ruler, StrokeHistory } from "~/core";
import type { Point } from "~/types";
import type { Tool, ToolConfigs } from "~/types/tools";

interface DocumentContextValue {
  document: Document;
  strokeHistory: {
    groups: StrokeHistory["groups"];
    currentIndex: number;
    canUndo: boolean;
    canRedo: boolean;
  };
  ruler: Ruler;
  startStrokeGroup: () => void;
  startStroke: <T extends Tool>(
    tool: T,
    toolConfig: ToolConfigs[T],
    color: string,
    point: Point,
  ) => void;
  addPointToStroke: (point: Point) => void;
  endStrokeGroup: () => void;
  undo: () => void;
  redo: () => void;
  toggleRuler: () => void;
  showRuler: () => void;
  hideRuler: () => void;
  rotateRuler: (delta: number) => void;
  setRulerAngle: (angle: number) => void;
  startDragRuler: (point: Point) => void;
  dragRulerTo: (point: Point) => void;
  endDragRuler: () => void;
  autoCenter: (width: number, height: number) => void;
  stretchToFill: (width: number, height: number) => void;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

interface DocumentProviderProps {
  document: Document;
  children: React.ReactNode;
}

export function DocumentProvider({
  document,
  children,
}: DocumentProviderProps) {
  const [, forceUpdate] = useState({});

  // Subscribe to document changes
  useEffect(() => {
    let mounted = true;

    const handleChange = () => {
      if (mounted) {
        forceUpdate({});
      }
    };

    document.onChange(handleChange);

    return () => {
      mounted = false;
      document.offChange(handleChange);
    };
  }, [document]);

  // Stroke history actions
  const startStrokeGroup = useCallback(() => {
    document.strokeHistory.startGroup();
  }, [document]);

  const startStroke = useCallback(
    <T extends Tool>(
      tool: T,
      toolConfig: ToolConfigs[T],
      color: string,
      point: Point,
    ) => {
      document.strokeHistory.startStroke(tool, toolConfig, color, point);
      document.markAsChanged();
    },
    [document],
  );

  const addPointToStroke = useCallback(
    (point: Point) => {
      document.strokeHistory.addPoint(point);
    },
    [document],
  );

  const endStrokeGroup = useCallback(() => {
    document.strokeHistory.endGroup();
  }, [document]);

  const undo = useCallback(() => {
    if (document.strokeHistory.canUndo()) {
      document.strokeHistory.undo();
      document.markAsChanged();
    }
  }, [document]);

  const redo = useCallback(() => {
    if (document.strokeHistory.canRedo()) {
      document.strokeHistory.redo();
      document.markAsChanged();
    }
  }, [document]);

  // Ruler actions
  const toggleRuler = useCallback(() => {
    document.ruler.toggle();
    forceUpdate({});
  }, [document]);

  const showRuler = useCallback(() => {
    document.ruler.show();
    forceUpdate({});
  }, [document]);

  const hideRuler = useCallback(() => {
    document.ruler.hide();
    forceUpdate({});
  }, [document]);

  const rotateRuler = useCallback(
    (delta: number) => {
      document.ruler.rotate(delta);
      forceUpdate({});
    },
    [document],
  );

  const setRulerAngle = useCallback(
    (angle: number) => {
      document.ruler.setAngle(angle);
      forceUpdate({});
    },
    [document],
  );

  const startDragRuler = useCallback(
    (point: Point) => {
      document.ruler.startDrag(point);
      forceUpdate({});
    },
    [document],
  );

  const dragRulerTo = useCallback(
    (point: Point) => {
      document.ruler.dragTo(point);
      // Trigger a React update so components depending on ruler state re-render.
      // Previously an animation loop handled this; now we update on demand.
      forceUpdate({});
    },
    [document],
  );

  const endDragRuler = useCallback(() => {
    document.ruler.endDrag();
    forceUpdate({});
  }, [document]);

  const autoCenter = useCallback(
    (width: number, height: number) => {
      document.autoCenter(width, height);
    },
    [document],
  );

  const stretchToFill = useCallback(
    (width: number, height: number) => {
      document.stretchToFill(width, height);
    },
    [document],
  );

  const value: DocumentContextValue = {
    document,
    strokeHistory: {
      groups: document.strokeHistory.groups,
      currentIndex: document.strokeHistory.currentIndex,
      canUndo: document.strokeHistory.canUndo(),
      canRedo: document.strokeHistory.canRedo(),
    },
    ruler: document.ruler,
    startStrokeGroup,
    startStroke,
    addPointToStroke,
    endStrokeGroup,
    undo,
    redo,
    toggleRuler,
    showRuler,
    hideRuler,
    rotateRuler,
    setRulerAngle,
    startDragRuler,
    dragRulerTo,
    endDragRuler,
    autoCenter,
    stretchToFill,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument(): DocumentContextValue {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocument must be used within a DocumentProvider");
  }
  return context;
}

export { DocumentContext };
