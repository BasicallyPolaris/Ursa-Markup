import { useState, useCallback, useRef } from "react";
import type { Tool, BrushSettings, Point } from "../types";

// Maximum number of stroke groups in history
const MAX_HISTORY = 100;

// A single drawing stroke/command
export interface Stroke {
  id: string;
  tool: Tool;
  points: Point[]; // For pen/highlighter: path points. For area: [start, end]
  brush: BrushSettings;
  timestamp: number;
}

// A group of strokes (one "undoable" action)
export interface StrokeGroup {
  id: string;
  strokes: Stroke[];
  timestamp: number;
}

export function useStrokeHistory() {
  // Removed verbose logging to prevent console spam during animation loop

  const historyRef = useRef<StrokeGroup[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isDrawingRef = useRef(false);
  const currentStrokeGroupRef = useRef<StrokeGroup | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const canUndo = historyIndex >= 0;
  const canRedo =
    historyIndex < historyRef.current.length - 1 && historyIndex >= 0;

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
    (tool: Tool, brush: BrushSettings, point: Point) => {
      if (!isDrawingRef.current || !currentStrokeGroupRef.current) {
        console.log("[startStroke] SKIPPED - not drawing or no group");
        return;
      }

      const stroke: Stroke = {
        id: Math.random().toString(36).substr(2, 9),
        tool,
        points: [point],
        brush: { ...brush }, // Clone brush settings
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
      console.log("[endStrokeGroup] SKIPPED - not drawing or no group");
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
    const newHistory = historyRef.current.slice(0, historyIndex + 1);
    newHistory.push(currentStrokeGroupRef.current);

    // Keep only last MAX_HISTORY groups
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    historyRef.current = newHistory;
    setHistoryIndex(newHistory.length - 1);
    currentStrokeGroupRef.current = null;
  }, [historyIndex]);

  // Replay strokes up to a specific index onto a canvas
  const replayStrokes = useCallback(
    (canvas: HTMLCanvasElement, upToIndex: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Replay all stroke groups up to the target index
      for (let i = 0; i <= upToIndex; i++) {
        const group = historyRef.current[i];
        if (!group) continue;

        for (const stroke of group.strokes) {
          replayStroke(ctx, stroke);
        }
      }
    },
    [],
  );

  // Replay a single stroke
  const replayStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    ctx.globalAlpha = stroke.brush.opacity;
    ctx.strokeStyle = stroke.brush.color;
    ctx.fillStyle = stroke.brush.color;
    ctx.lineWidth = stroke.brush.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (stroke.tool === "pen") {
      // Replay pen stroke
      ctx.beginPath();
      ctx.globalCompositeOperation = "source-over";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    } else if (stroke.tool === "highlighter") {
      // Replay highlighter stroke with pixel-based filling (each pixel drawn once for correct opacity)
      ctx.globalCompositeOperation = "source-over";

      const height = stroke.brush.size;
      const width = stroke.brush.size * 0.3;
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
      // Replay area tool
      if (stroke.points.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillRect(x, y, width, height);
      }
    }
  };

  const undo = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (historyIndex < 0) return;
      const newIndex = historyIndex - 1;
      replayStrokes(canvas, newIndex);
      setHistoryIndex(newIndex);
    },
    [historyIndex, replayStrokes],
  );

  const redo = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (historyIndex >= historyRef.current.length - 1) return;
      const newIndex = historyIndex + 1;
      replayStrokes(canvas, newIndex);
      setHistoryIndex(newIndex);
    },
    [historyIndex, replayStrokes],
  );

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistoryIndex(-1);
    currentStrokeGroupRef.current = null;
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
  }, []);

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
