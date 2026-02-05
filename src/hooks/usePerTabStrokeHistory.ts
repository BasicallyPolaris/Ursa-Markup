import { useRef, useCallback } from "react";
import type { StrokeGroup, Tool, BrushSettings, Point, Stroke } from "../types";

// Maximum number of stroke groups in history
const MAX_HISTORY = 100;

// Replay a single stroke onto a canvas context
export const replayStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (stroke.points.length === 0) return;

  const blendMode = stroke.brushSettings.blendMode || "normal";

  ctx.globalAlpha = stroke.brushSettings.opacity;
  ctx.strokeStyle = stroke.brushSettings.color;
  ctx.fillStyle = stroke.brushSettings.color;
  ctx.lineWidth = stroke.brushSettings.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (stroke.tool === "pen") {
    // Replay pen stroke with blend mode support
    ctx.beginPath();
    ctx.globalCompositeOperation =
      blendMode === "multiply" ? "multiply" : "source-over";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  } else if (stroke.tool === "highlighter") {
    // Replay highlighter stroke with pixel-based filling and blend mode support
    if (blendMode === "multiply") {
      ctx.globalCompositeOperation = "multiply";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    const height = stroke.brushSettings.size;
    const width = stroke.brushSettings.size * 0.3;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Track filled pixel grid cells to avoid over-drawing
    const filledPixels = new Set<string>();

    // Interpolate points along the path
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const stepSize = 2;
      const steps = Math.max(1, Math.ceil(distance / stepSize));

      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const interpX = p1.x + dx * t;
        const interpY = p1.y + dy * t;

        // Check all pixels under the highlighter at this position
        const startGridX = Math.floor(interpX - halfWidth);
        const endGridX = Math.ceil(interpX + halfWidth);
        const startGridY = Math.floor(interpY - halfHeight);
        const endGridY = Math.ceil(interpY + halfHeight);

        for (let gridX = startGridX; gridX < endGridX; gridX++) {
          for (let gridY = startGridY; gridY < endGridY; gridY++) {
            const pixelKey = `${gridX},${gridY}`;
            if (filledPixels.has(pixelKey)) continue;

            const pixelCenterX = gridX + 0.5;
            const pixelCenterY = gridY + 0.5;
            const pdx = Math.abs(pixelCenterX - interpX);
            const pdy = Math.abs(pixelCenterY - interpY);

            if (pdx <= halfWidth && pdy <= halfHeight) {
              filledPixels.add(pixelKey);
              // Draw smooth pixel with anti-aliasing (slightly larger than 1x1)
              ctx.fillRect(gridX - 0.5, gridY - 0.5, 2, 2);
            }
          }
        }
      }
    }
  } else if (stroke.tool === "area") {
    // Replay area tool with blend mode support
    if (stroke.points.length >= 2) {
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      ctx.globalCompositeOperation =
        blendMode === "multiply" ? "multiply" : "source-over";
      ctx.fillRect(x, y, width, height);
    }
  }

  // Reset composite operation
  ctx.globalCompositeOperation = "source-over";
};

interface UsePerTabStrokeHistoryProps {
  history: StrokeGroup[];
  historyIndex: number;
  onHistoryChange: (history: StrokeGroup[], historyIndex: number) => void;
}

export function usePerTabStrokeHistory({
  history,
  historyIndex,
  onHistoryChange,
}: UsePerTabStrokeHistoryProps) {
  const isDrawingRef = useRef(false);
  const currentStrokeGroupRef = useRef<StrokeGroup | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1 && historyIndex >= 0;

  // Replay strokes up to a specific index onto a canvas
  const replayStrokes = useCallback(
    (canvas: HTMLCanvasElement, upToIndex: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Replay all stroke groups up to the target index
      for (let i = 0; i <= upToIndex; i++) {
        const group = history[i];
        if (!group) continue;

        for (const stroke of group.strokes) {
          replayStroke(ctx, stroke);
        }
      }
    },
    [history],
  );

  // Start a new stroke group (called on mouse down)
  const startStrokeGroup = useCallback(() => {
    isDrawingRef.current = true;
    const group: StrokeGroup = {
      id: Math.random().toString(36).substr(2, 9),
      strokes: [],
      timestamp: Date.now(),
    };
    currentStrokeGroupRef.current = group;
    currentStrokeRef.current = null;
  }, []);

  // Start a new stroke within the current group
  const startStroke = useCallback(
    (tool: Tool, brushSettings: BrushSettings, point: Point) => {
      if (!isDrawingRef.current || !currentStrokeGroupRef.current) {
        return;
      }

      const stroke: Stroke = {
        id: Math.random().toString(36).slice(2, 9),
        tool,
        points: [point],
        brushSettings,
        timestamp: Date.now(),
      };
      currentStrokeRef.current = stroke;
      currentStrokeGroupRef.current.strokes.push(stroke);
    },
    [],
  );

  // Add a point to the current stroke
  const addPointToStroke = useCallback((point: Point) => {
    if (!isDrawingRef.current) {
      return;
    }
    if (!currentStrokeRef.current) {
      return;
    }
    currentStrokeRef.current.points.push(point);
  }, []);

  // End the current stroke group (called on mouse up)
  const endStrokeGroup = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeGroupRef.current) {
      return;
    }

    isDrawingRef.current = false;
    currentStrokeRef.current = null;

    // Only save if there are strokes
    if (currentStrokeGroupRef.current.strokes.length === 0) {
      currentStrokeGroupRef.current = null;
      return;
    }

    // Remove redo states and add new group
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentStrokeGroupRef.current);

    // Keep only last MAX_HISTORY groups
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    onHistoryChange(newHistory, newHistory.length - 1);
    currentStrokeGroupRef.current = null;
  }, [history, historyIndex, onHistoryChange]);

  const undo = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (historyIndex < 0) return;
      const newIndex = historyIndex - 1;
      replayStrokes(canvas, newIndex);
      onHistoryChange(history, newIndex);
    },
    [history, historyIndex, onHistoryChange, replayStrokes],
  );

  const redo = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (historyIndex >= history.length - 1) return;
      const newIndex = historyIndex + 1;
      replayStrokes(canvas, newIndex);
      onHistoryChange(history, newIndex);
    },
    [history, historyIndex, onHistoryChange, replayStrokes],
  );

  const clearHistory = useCallback(() => {
    onHistoryChange([], -1);
    currentStrokeGroupRef.current = null;
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
  }, [onHistoryChange]);

  // Check if currently drawing (for external use)
  const isDrawing = useCallback(() => {
    return isDrawingRef.current;
  }, []);

  return {
    canUndo,
    canRedo,
    startStrokeGroup,
    startStroke,
    addPointToStroke,
    endStrokeGroup,
    undo,
    redo,
    clearHistory,
    isDrawing,
  };
}
