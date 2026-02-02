import { useEffect, useRef, useCallback, useState } from "react";
import type { Tool, BrushSettings, RulerState, Point, StrokeGroup } from "../../types";
import { cn } from "../../lib/utils";

/**
 * Helper to get a CSS custom property value
 */
function getCssVar(name: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || "0 0% 50%";
}

/**
 * Convert HSL CSS variable to rgba string for canvas
 */
function getRulerColor(varName: string, alpha: number = 1): string {
  const hslValue = getCssVar(varName);
  const parts = hslValue.split(" ");
  if (parts.length >= 3) {
    const h = parseInt(parts[0]);
    const s = parseInt(parts[1]);
    const l = parseInt(parts[2]);
    // Convert HSL to RGB
    const sPercent = s / 100;
    const lPercent = l / 100;
    const c = (1 - Math.abs(2 * lPercent - 1)) * sPercent;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lPercent - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    return `rgba(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}, ${alpha})`;
  }
  return `rgba(128, 128, 128, ${alpha})`;
}

/**
 * HSL Color manipulation helpers for Color blend mode
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/**
 * Draw a pixel with Color blend mode (HSL-based)
 * Preserves pixel lightness, applies brush hue/saturation
 */
function drawPixelWithColorBlend(
  ctx: CanvasRenderingContext2D,
  gridX: number,
  gridY: number,
  brushColor: string,
  brushOpacity: number,
  baseImageData: ImageData | null,
  canvasWidth: number
): void {
  if (!baseImageData) {
    // Fallback to normal drawing if no base image
    ctx.globalAlpha = brushOpacity;
    ctx.fillStyle = brushColor;
    ctx.fillRect(gridX, gridY, 1, 1);
    ctx.globalAlpha = 1;
    return;
  }

  const pixelIndex = (gridY * canvasWidth + gridX) * 4;
  if (pixelIndex < 0 || pixelIndex >= baseImageData.data.length - 3) {
    ctx.globalAlpha = brushOpacity;
    ctx.fillStyle = brushColor;
    ctx.fillRect(gridX, gridY, 1, 1);
    ctx.globalAlpha = 1;
    return;
  }

  const r = baseImageData.data[pixelIndex];
  const g = baseImageData.data[pixelIndex + 1];
  const b = baseImageData.data[pixelIndex + 2];

  // Convert brush color to HSL
  const brushHsl = hexToHsl(brushColor);
  // Convert pixel to HSL
  const pixelHsl = rgbToHsl(r, g, b);

  // Apply brush hue/saturation to pixel lightness
  const newColor = hslToRgb(brushHsl.h, brushHsl.s, pixelHsl.l);

  ctx.fillStyle = `rgba(${newColor.r}, ${newColor.g}, ${newColor.b}, ${brushOpacity})`;
  ctx.fillRect(gridX, gridY, 1, 1);
}

interface DrawingCanvasProps {
  imageSrc: string | null;
  tool: Tool;
  brush: BrushSettings;
  ruler: RulerState;
  zoom: number;
  viewOffset: { x: number; y: number };
  canvasSize: { width: number; height: number };
  // Global blend mode for all tools: normal, color (HSL), multiply
  blendMode?: 'normal' | 'color' | 'multiply';
  onZoomChange: (zoom: number, mouseX?: number, mouseY?: number) => void;
  onViewOffsetChange: (offset: { x: number; y: number }) => void;
  onCanvasSizeChange: (size: { width: number; height: number }) => void;
  onRulerDragStart: (point: Point) => void;
  onRulerDrag: (point: Point) => void;
  onRulerDragEnd: () => void;
  onRulerRotate: (delta: number) => void;
  // Stroke-based history methods
  onStartStrokeGroup: () => void;
  onStartStroke: (tool: Tool, brush: BrushSettings, point: Point, blendMode: 'normal' | 'color' | 'multiply') => void;
  onAddPointToStroke: (point: Point) => void;
  onEndStrokeGroup: () => void;
  // Stroke history for replay
  strokeHistory?: StrokeGroup[];
  strokeHistoryIndex?: number;
  className?: string;
}

export function DrawingCanvas({
  imageSrc,
  tool,
  brush,
  ruler,
  zoom,
  viewOffset,
  canvasSize,
  blendMode = 'normal',
  onZoomChange,
  onViewOffsetChange,
  onCanvasSizeChange,
  onRulerDragStart,
  onRulerDrag,
  onRulerDragEnd,
  onRulerRotate,
  // Stroke-based history methods
  onStartStrokeGroup,
  onStartStroke,
  onAddPointToStroke,
  onEndStrokeGroup,
  // Stroke history for replay
  strokeHistory,
  strokeHistoryIndex,
  className,
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isRulerHovered, setIsRulerHovered] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const lastMarkerPointRef = useRef<Point | null>(null);
  const requestRef = useRef<number | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const viewOffsetRef = useRef(viewOffset);
  const coloredPixelsRef = useRef<Set<string>>(new Set());
  const isImageLoadingRef = useRef(false);
  const baseImageDataRef = useRef<ImageData | null>(null);

  // Replay stroke helper function - supports blend modes
  const replayStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: any) => {
    if (!stroke || stroke.points.length < 1) return;

    const strokeBrush = stroke.brush;
    const strokeTool = stroke.tool;
    const points = stroke.points;
    const strokeBlendMode = stroke.brush.blendMode || 'normal';

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = strokeBrush.size;
    ctx.globalAlpha = strokeBrush.opacity;

    // Apply blend mode
    if (strokeBlendMode === 'multiply') {
      ctx.globalCompositeOperation = 'multiply';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    if (strokeTool === "pen") {
      ctx.strokeStyle = strokeBrush.color;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    } else if (strokeTool === "highlighter") {
      const height = strokeBrush.size;
      const width = strokeBrush.size * 0.3;
      const halfWidth = width / 2;
      const halfHeight = height / 2;

      // Handle blend mode for highlighter
      if (strokeBlendMode === 'multiply') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = strokeBrush.color;
        ctx.globalAlpha = strokeBrush.opacity;
      } else if (strokeBlendMode === 'color') {
        ctx.globalCompositeOperation = 'source-over';
        // Color blend mode requires per-pixel processing - handled below
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = strokeBrush.color;
        ctx.globalAlpha = strokeBrush.opacity;
      }

      // For each segment of the stroke
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const stepSize = 2;
        const steps = Math.max(1, Math.ceil(distance / stepSize));

        for (let step = 0; step <= steps; step++) {
          const t = step / steps;
          const interpX = start.x + dx * t;
          const interpY = start.y + dy * t;

          const startGridX = Math.floor(interpX - halfWidth);
          const endGridX = Math.ceil(interpX + halfWidth);
          const startGridY = Math.floor(interpY - halfHeight);
          const endGridY = Math.ceil(interpY + halfHeight);

          for (let gridX = startGridX; gridX < endGridX; gridX++) {
            for (let gridY = startGridY; gridY < endGridY; gridY++) {
              const pixelCenterX = gridX + 0.5;
              const pixelCenterY = gridY + 0.5;
              const pdx = Math.abs(pixelCenterX - interpX);
              const pdy = Math.abs(pixelCenterY - interpY);

              if (pdx <= halfWidth && pdy <= halfHeight) {
                if (strokeBlendMode === 'color') {
                  drawPixelWithColorBlend(
                    ctx,
                    gridX,
                    gridY,
                    strokeBrush.color,
                    strokeBrush.opacity,
                    baseImageDataRef.current,
                    ctx.canvas.width
                  );
                } else {
                  ctx.fillRect(gridX, gridY, 1, 1);
                }
              }
            }
          }
        }
      }
    } else if (strokeTool === "area") {
      if (points.length >= 2) {
        const start = points[0];
        const end = points[points.length - 1];
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        const borderRadius = strokeBrush.borderRadius || 0;
        const borderWidth = strokeBrush.borderWidth || 2;
        const borderEnabled = strokeBrush.borderEnabled !== false;
        
        ctx.globalAlpha = strokeBrush.opacity;
        ctx.fillStyle = strokeBrush.color;
        
        // Draw rounded rectangle fill
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, borderRadius);
        ctx.fill();
        
        // Draw border if enabled
        if (borderEnabled) {
          ctx.strokeStyle = strokeBrush.color;
          ctx.lineWidth = borderWidth;
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, borderRadius);
          ctx.stroke();
        }
      }
    }
  }, []);

  // Replay strokes helper - extracted for reuse
  const strokeHistoryRef = useRef(strokeHistory);
  const strokeHistoryIndexRef = useRef(strokeHistoryIndex);
  
  useEffect(() => {
    strokeHistoryRef.current = strokeHistory;
    strokeHistoryIndexRef.current = strokeHistoryIndex;
  }, [strokeHistory, strokeHistoryIndex]);
  
  const replayStrokesToCanvas = useCallback(() => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas || drawCanvas.width === 0) return;
    
    const drawCtx = drawCanvas.getContext('2d');
    if (!drawCtx) return;
    
    // Get latest values from refs to avoid stale closure
    const currentHistory = strokeHistoryRef.current;
    const currentIndex = strokeHistoryIndexRef.current;
    
    // Clear and replay all strokes up to the current index
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    
    for (let i = 0; i <= (currentIndex ?? -1); i++) {
      const group = currentHistory?.[i];
      if (!group) continue;
      
      for (const stroke of group.strokes) {
        replayStroke(drawCtx, stroke);
      }
    }
  }, [replayStroke]);

  // Initialize canvas with image
  useEffect(() => {
    if (!imageSrc) {
      // Clear canvases when image is removed to free memory
      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;

      if (baseCanvas) {
        const baseCtx = baseCanvas.getContext("2d");
        if (baseCtx) {
          baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
        }
        baseCanvas.width = 0;
        baseCanvas.height = 0;
      }

      if (drawCanvas) {
        const drawCtx = drawCanvas.getContext("2d");
        if (drawCtx) {
          drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        }
        drawCanvas.width = 0;
        drawCanvas.height = 0;
      }

      // Clear colored pixels tracking
      coloredPixelsRef.current.clear();

      return;
    }

    // Prevent concurrent loading
    if (isImageLoadingRef.current) return;
    isImageLoadingRef.current = true;

    const img = new Image();
    img.onload = () => {
      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!baseCanvas || !drawCanvas) {
        isImageLoadingRef.current = false;
        return;
      }

      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      drawCanvas.width = img.width;
      drawCanvas.height = img.height;

      const baseCtx = baseCanvas.getContext("2d");
      if (baseCtx) {
        baseCtx.imageSmoothingEnabled = true;
        baseCtx.imageSmoothingQuality = "high";
        baseCtx.drawImage(img, 0, 0);
        // Capture base image data for Color blend mode
        baseImageDataRef.current = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
      }

      const drawCtx = drawCanvas.getContext("2d");
      if (drawCtx) {
        drawCtx.imageSmoothingEnabled = true;
        drawCtx.imageSmoothingQuality = "high";
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      }

      // Clear colored pixels tracking for new image
      coloredPixelsRef.current.clear();

      onCanvasSizeChange({ width: img.width, height: img.height });

      // Replay strokes after canvas is properly sized
      // This ensures annotations are restored when switching tabs
      replayStrokesToCanvas();
      
      isImageLoadingRef.current = false;
    };
    
    img.onerror = () => {
      isImageLoadingRef.current = false;
    };
    
    img.src = imageSrc;

    // Cleanup: clear canvases and coloredPixels when unmounting or switching images
    return () => {
      coloredPixelsRef.current.clear();
    };
  }, [imageSrc, onCanvasSizeChange, replayStrokesToCanvas]);

  // Replay strokes when history changes (for undo/redo while viewing same canvas)
  useEffect(() => {
    if (!imageSrc) return;
    replayStrokesToCanvas();
  }, [strokeHistory, strokeHistoryIndex, replayStrokesToCanvas, imageSrc]);

  // Keep zoomRef in sync with zoom prop
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Keep viewOffsetRef in sync with viewOffset prop
  useEffect(() => {
    viewOffsetRef.current = viewOffset;
  }, [viewOffset]);

  // Render display canvas
  const renderDisplay = useCallback(() => {
    try {
      // ALWAYS use refs for fresh values to avoid stale closure issues
      const currentZoom = zoomRef.current;
      const currentViewOffset = viewOffsetRef.current;

      // Get ruler colors from CSS variables
      const rulerBgColor = getRulerColor("--ruler-bg", 0.9);
      const rulerBorderColor = getRulerColor("--ruler-border", 1);
      const rulerTickColor = getRulerColor("--ruler-tick", 1);
      const rulerCenterBg = getRulerColor("--ruler-center-bg", 1);
      const rulerCenterBorder = getRulerColor("--ruler-center-border", 1);
      const rulerCompassColor = getRulerColor("--ruler-compass", 1);

      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      const displayCanvas = displayCanvasRef.current;
      const container = containerRef.current;
      if (!baseCanvas || !drawCanvas || !displayCanvas || !container) return;

      // Safety check for valid canvas dimensions
      if (baseCanvas.width <= 0 || baseCanvas.height <= 0) return;
      if (drawCanvas.width <= 0 || drawCanvas.height <= 0) return;

      // Safety check for valid numeric values
      if (
        !Number.isFinite(currentZoom) ||
        !Number.isFinite(currentViewOffset.x) ||
        !Number.isFinite(currentViewOffset.y)
      ) {
        console.error("Invalid zoom or viewOffset values:", {
          zoom: currentZoom,
          viewOffset: currentViewOffset,
        });
        return;
      }
      if (currentZoom <= 0 || currentZoom > 10) {
        console.error("Zoom out of range:", currentZoom);
        return;
      }

      const displayCtx = displayCanvas.getContext("2d");
      if (!displayCtx) return;

      displayCtx.imageSmoothingEnabled = true;
      displayCtx.imageSmoothingQuality = "high";

      const rect = container.getBoundingClientRect();
      displayCanvas.width = rect.width;
      displayCanvas.height = rect.height;

      displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

      // Simple viewOffset-based rendering
      // Canvas to screen: (canvasX - viewOffset.x) * zoom
      displayCtx.save();
      displayCtx.translate(
        -currentViewOffset.x * currentZoom,
        -currentViewOffset.y * currentZoom,
      );
      displayCtx.scale(currentZoom, currentZoom);
      displayCtx.drawImage(baseCanvas, 0, 0);
      displayCtx.drawImage(drawCanvas, 0, 0);

      // Draw area tool preview
      if (isDrawing && tool === "area" && startPoint && currentPoint) {
        displayCtx.save();
        const x = Math.min(startPoint.x, currentPoint.x);
        const y = Math.min(startPoint.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);
        const borderRadius = brush.borderRadius || 0;
        const borderWidth = brush.borderWidth || 2;
        const borderEnabled = brush.borderEnabled !== false;
        
        displayCtx.globalAlpha = brush.opacity;
        displayCtx.fillStyle = brush.color;
        
        // Draw rounded rectangle fill
        displayCtx.beginPath();
        displayCtx.roundRect(x, y, width, height, borderRadius);
        displayCtx.fill();
        
        // Draw border if enabled
        if (borderEnabled) {
          displayCtx.globalAlpha = brush.opacity;
          displayCtx.strokeStyle = brush.color;
          displayCtx.lineWidth = borderWidth / currentZoom;
          displayCtx.beginPath();
          displayCtx.roundRect(x, y, width, height, borderRadius);
          displayCtx.stroke();
        }
        displayCtx.restore();
      }

      // Draw ruler
      if (ruler.visible) {
        try {
          displayCtx.save();

          // Safety check for valid ruler position
          if (
            !Number.isFinite(ruler.x) ||
            !Number.isFinite(ruler.y) ||
            !Number.isFinite(ruler.angle)
          ) {
            console.error("Invalid ruler values:", ruler);
            displayCtx.restore();
            return;
          }

          displayCtx.translate(ruler.x, ruler.y);
          displayCtx.rotate((ruler.angle * Math.PI) / 180);

          // Safety check for valid canvas dimensions
          if (canvasSize.width > 0 && canvasSize.height > 0) {
            const diagonal = Math.sqrt(
              canvasSize.width ** 2 + canvasSize.height ** 2,
            );
            const rulerLength = diagonal * 3;
            const rulerHeight = 60;

            // Ensure ruler dimensions are valid
            if (rulerLength > 0 && rulerHeight > 0) {
              displayCtx.fillStyle = rulerBgColor;
              displayCtx.fillRect(
                -rulerLength / 2,
                -rulerHeight / 2,
                rulerLength,
                rulerHeight,
              );

              displayCtx.strokeStyle = rulerBorderColor;
              displayCtx.lineWidth = 2 / currentZoom;
              displayCtx.strokeRect(
                -rulerLength / 2,
                -rulerHeight / 2,
                rulerLength,
                rulerHeight,
              );

              displayCtx.strokeStyle = rulerTickColor;
              displayCtx.lineWidth = 1.5 / currentZoom;
              displayCtx.beginPath();

              const tickSpacing = 10;
              const tickCount = Math.floor(rulerLength / tickSpacing);

              for (
                let i = -Math.floor(tickCount / 2);
                i <= Math.floor(tickCount / 2);
                i++
              ) {
                const x = i * tickSpacing;
                const absI = Math.abs(i);
                let height = 6;
                if (absI % 10 === 0) height = 18;
                else if (absI % 5 === 0) height = 12;

                displayCtx.moveTo(x, -rulerHeight / 2);
                displayCtx.lineTo(x, -rulerHeight / 2 + height);
                displayCtx.moveTo(x, rulerHeight / 2);
                displayCtx.lineTo(x, rulerHeight / 2 - height);

                if (absI % 10 === 0 && i !== 0) {
                  displayCtx.fillStyle = rulerTickColor;
                  displayCtx.font = `bold ${11 / currentZoom}px sans-serif`;
                  displayCtx.textAlign = "center";
                  displayCtx.textBaseline = "middle";
                  displayCtx.fillText(String(absI / 10), x, 0);
                }
              }

              displayCtx.stroke();

              const centerRadius = 22;
              displayCtx.beginPath();
              displayCtx.arc(0, 0, centerRadius, 0, Math.PI * 2);
              displayCtx.fillStyle = rulerCenterBg;
              displayCtx.fill();
              displayCtx.strokeStyle = rulerCenterBorder;
              displayCtx.lineWidth = 2 / currentZoom;
              displayCtx.stroke();

              displayCtx.fillStyle = rulerTickColor;
              displayCtx.font = `bold ${13 / currentZoom}px sans-serif`;
              displayCtx.textAlign = "center";
              displayCtx.textBaseline = "middle";
              displayCtx.fillText(`${Math.round(ruler.angle % 360)}°`, 0, 0);

              displayCtx.beginPath();
              for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                const r1 = centerRadius + 2;
                const r2 = i % 2 === 0 ? centerRadius + 8 : centerRadius + 5;
                displayCtx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
                displayCtx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
              }
              displayCtx.strokeStyle = rulerCompassColor;
              displayCtx.lineWidth = 1.5 / currentZoom;
              displayCtx.stroke();
            }
          }

          displayCtx.restore();
        } catch (error) {
          console.error("Error drawing ruler:", error);
          displayCtx.restore();
        }
      }

      displayCtx.restore();
    } catch (error) {
      console.error("Error in renderDisplay:", error);
    }
  }, [
    canvasSize,
    ruler,
    isDrawing,
    tool,
    startPoint,
    currentPoint,
    brush.color,
    brush.opacity,
  ]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      renderDisplay();
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [renderDisplay]);

  // Transform coordinates
  // Screen to canvas: (screenX - rect.left) / zoom + viewOffset.x
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Point => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };

      const rect = container.getBoundingClientRect();

      return {
        x: (screenX - rect.left) / zoom + viewOffset.x,
        y: (screenY - rect.top) / zoom + viewOffset.y,
      };
    },
    [zoom, viewOffset],
  );

  const RULER_HEIGHT = 60;
  const SNAP_DISTANCE = 50; // pixels

  // Get perpendicular distance from point to ruler center line
  const getRulerSnapInfo = useCallback(
    (
      point: Point,
    ): {
      distance: number;
      snapToFarSide: boolean;
      inStickyZone: boolean;
      onRuler: boolean;
    } => {
      if (!ruler.visible)
        return {
          distance: Infinity,
          snapToFarSide: false,
          inStickyZone: false,
          onRuler: false,
        };

      const angleRad = (ruler.angle * Math.PI) / 180;
      const dx = point.x - ruler.x;
      const dy = point.y - ruler.y;

      const perpDist = dx * Math.sin(angleRad) - dy * Math.cos(angleRad);
      const parallelDist = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);
      const rulerLength =
        Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2) * 2;
      const onRuler = Math.abs(parallelDist) <= rulerLength / 2;

      const distToTopEdge = perpDist - -RULER_HEIGHT / 2;
      const distToBottomEdge = perpDist - RULER_HEIGHT / 2;

      const absDistToTop = Math.abs(distToTopEdge);
      const absDistToBottom = Math.abs(distToBottomEdge);

      if (absDistToTop < absDistToBottom) {
        const inStickyZone = absDistToTop < SNAP_DISTANCE;
        return {
          distance: absDistToTop,
          snapToFarSide: true,
          inStickyZone,
          onRuler,
        };
      } else {
        const inStickyZone = absDistToBottom < SNAP_DISTANCE;
        return {
          distance: absDistToBottom,
          snapToFarSide: false,
          inStickyZone,
          onRuler,
        };
      }
    },
    [ruler, canvasSize],
  );

  // Check if point is on the ruler (for dragging the ruler itself)
  const isClickOnRuler = useCallback(
    (point: Point): boolean => {
      if (!ruler.visible) return false;

      const dx = point.x - ruler.x;
      const dy = point.y - ruler.y;

      const angleRad = (-ruler.angle * Math.PI) / 180;
      const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
      const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

      const rulerLength =
        Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2) * 3;

      return (
        Math.abs(rotatedX) <= rulerLength / 2 &&
        Math.abs(rotatedY) <= RULER_HEIGHT / 2
      );
    },
    [ruler, canvasSize],
  );

  // Snap point to ruler edge
  const getSnappedPoint = useCallback(
    (point: Point, snapToFarSide: boolean, brushSize: number): Point => {
      if (!ruler.visible) return point;

      const angleRad = (ruler.angle * Math.PI) / 180;
      const dx = point.x - ruler.x;
      const dy = point.y - ruler.y;

      const distAlong = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);

      const markerHeight = brushSize;
      const markerWidth = brushSize * 0.3;
      const perpExtent =
        Math.abs(Math.cos(angleRad)) * (markerHeight / 2) +
        Math.abs(Math.sin(angleRad)) * (markerWidth / 2);

      const edgeOffset = snapToFarSide
        ? -RULER_HEIGHT / 2 - perpExtent
        : RULER_HEIGHT / 2 + perpExtent;

      return {
        x:
          ruler.x +
          distAlong * Math.cos(angleRad) +
          edgeOffset * Math.sin(angleRad),
        y:
          ruler.y +
          distAlong * Math.sin(angleRad) -
          edgeOffset * Math.cos(angleRad),
      };
    },
    [ruler],
  );

  // Mouse down handler - SIMPLIFIED: no blend modes
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);

      // Pan with middle mouse or Ctrl+left click
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        setIsPanning(true);
        panStartRef.current = {
          x: canvasPoint.x,
          y: canvasPoint.y,
        };
        return;
      }

      // Check if clicking on ruler
      if (isClickOnRuler(canvasPoint)) {
        onRulerDragStart(canvasPoint);
        return;
      }

      setIsDrawing(true);
      setStartPoint(canvasPoint);
      lastPointRef.current = canvasPoint;
      lastMarkerPointRef.current = canvasPoint;

      const canvas = drawCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brush.size;
      ctx.globalCompositeOperation = 'source-over';

      if (tool === "pen") {
        ctx.globalAlpha = brush.opacity;
        ctx.strokeStyle = brush.color;
        // Apply blend mode for pen
        if (blendMode === 'multiply') {
          ctx.globalCompositeOperation = 'multiply';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.beginPath();
        ctx.moveTo(canvasPoint.x, canvasPoint.y);
      } else if (tool === "highlighter") {
        coloredPixelsRef.current.clear();

        const height = brush.size;
        const width = brush.size * 0.3;
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        // Handle blend mode for highlighter
        if (blendMode === 'multiply') {
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = brush.color;
          ctx.globalAlpha = brush.opacity;
        } else if (blendMode === 'color') {
          ctx.globalCompositeOperation = 'source-over';
          // Color blend mode requires per-pixel processing - handled below
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = brush.color;
          ctx.globalAlpha = brush.opacity;
        }

        // Draw initial marker
        const startGridX = Math.floor(canvasPoint.x - halfWidth);
        const endGridX = Math.ceil(canvasPoint.x + halfWidth);
        const startGridY = Math.floor(canvasPoint.y - halfHeight);
        const endGridY = Math.ceil(canvasPoint.y + halfHeight);

        for (let gridX = startGridX; gridX < endGridX; gridX++) {
          for (let gridY = startGridY; gridY < endGridY; gridY++) {
            const pixelKey = `${gridX},${gridY}`;
            if (coloredPixelsRef.current.has(pixelKey)) continue;

            const pixelCenterX = gridX + 0.5;
            const pixelCenterY = gridY + 0.5;

            const dx = Math.abs(pixelCenterX - canvasPoint.x);
            const dy = Math.abs(pixelCenterY - canvasPoint.y);

            if (dx <= halfWidth && dy <= halfHeight) {
              coloredPixelsRef.current.add(pixelKey);
              if (blendMode === 'color') {
                drawPixelWithColorBlend(
                  ctx,
                  gridX,
                  gridY,
                  brush.color,
                  brush.opacity,
                  baseImageDataRef.current,
                  canvas.width
                );
              } else {
                ctx.fillRect(gridX, gridY, 1, 1);
              }
            }
          }
        }
      } else if (tool === "area") {
        ctx.globalAlpha = brush.opacity;
        ctx.fillStyle = brush.color;
      }

      // Start stroke-based recording
      onStartStrokeGroup();
      onStartStroke(tool, brush, canvasPoint, blendMode);
    },
    [
      tool,
      brush,
      isClickOnRuler,
      onRulerDragStart,
      screenToCanvas,
      onStartStrokeGroup,
      onStartStroke,
    ],
  );

  // Mouse move handler - SIMPLIFIED: no blend modes
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);

      if (isPanning) {
        const deltaX = panStartRef.current.x - canvasPoint.x;
        const deltaY = panStartRef.current.y - canvasPoint.y;
        const newViewOffset = {
          x: viewOffset.x + deltaX,
          y: viewOffset.y + deltaY,
        };
        onViewOffsetChange(newViewOffset);
        return;
      }

      if (ruler.visible && !isDrawing && !ruler.isDragging) {
        setIsRulerHovered(isClickOnRuler(canvasPoint));
      }

      if (ruler.isDragging) {
        onRulerDrag(canvasPoint);
        return;
      }

      if (!isDrawing || !startPoint) return;

      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (tool === "pen" || tool === "highlighter") {
        let drawPoint = canvasPoint;

        if (ruler.visible) {
          const rulerSnapInfo = getRulerSnapInfo(canvasPoint);
          if (rulerSnapInfo.inStickyZone) {
            drawPoint = getSnappedPoint(
              canvasPoint,
              rulerSnapInfo.snapToFarSide,
              brush.size,
            );
          }
        }

        if (tool === "pen") {
          ctx.lineTo(drawPoint.x, drawPoint.y);
          ctx.stroke();
        } else if (tool === "highlighter") {
          if (lastMarkerPointRef.current) {
            const height = brush.size;
            const width = brush.size * 0.3;
            const halfWidth = width / 2;
            const halfHeight = height / 2;

            // Handle blend mode for highlighter in mouse move
            if (blendMode === 'multiply') {
              ctx.globalCompositeOperation = 'multiply';
              ctx.fillStyle = brush.color;
              ctx.globalAlpha = brush.opacity;
            } else if (blendMode === 'color') {
              ctx.globalCompositeOperation = 'source-over';
              // Color blend mode requires per-pixel processing
            } else {
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = brush.color;
              ctx.globalAlpha = brush.opacity;
            }

            const lastPoint = lastMarkerPointRef.current;
            const dx = drawPoint.x - lastPoint.x;
            const dy = drawPoint.y - lastPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const stepSize = 2;
            const steps = Math.max(1, Math.ceil(distance / stepSize));

            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const interpX = lastPoint.x + dx * t;
              const interpY = lastPoint.y + dy * t;

              const startGridX = Math.floor(interpX - halfWidth);
              const endGridX = Math.ceil(interpX + halfWidth);
              const startGridY = Math.floor(interpY - halfHeight);
              const endGridY = Math.ceil(interpY + halfHeight);

              for (let gridX = startGridX; gridX < endGridX; gridX++) {
                for (let gridY = startGridY; gridY < endGridY; gridY++) {
                  const pixelKey = `${gridX},${gridY}`;
                  if (!coloredPixelsRef.current.has(pixelKey)) {
                    const pixelCenterX = gridX + 0.5;
                    const pixelCenterY = gridY + 0.5;

                    const pdx = Math.abs(pixelCenterX - interpX);
                    const pdy = Math.abs(pixelCenterY - interpY);

                    if (pdx <= halfWidth && pdy <= halfHeight) {
                      coloredPixelsRef.current.add(pixelKey);
                      if (blendMode === 'color') {
                        drawPixelWithColorBlend(
                          ctx,
                          gridX,
                          gridY,
                          brush.color,
                          brush.opacity,
                          baseImageDataRef.current,
                          canvas.width
                        );
                      } else {
                        ctx.fillRect(gridX, gridY, 1, 1);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Record stroke for history
        onAddPointToStroke(drawPoint);
        lastPointRef.current = drawPoint;
        lastMarkerPointRef.current = drawPoint;
      } else if (tool === "area") {
        setCurrentPoint(canvasPoint);
      }
    },
    [
      isDrawing,
      startPoint,
      tool,
      ruler,
      isPanning,
      onRulerDrag,
      screenToCanvas,
      isClickOnRuler,
      getRulerSnapInfo,
      getSnappedPoint,
      zoom,
      onViewOffsetChange,
      viewOffset,
      brush.size,
      onAddPointToStroke,
    ],
  );

  // Mouse up handler - SIMPLIFIED: no blend modes
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
        return;
      }

      if (ruler.isDragging) {
        onRulerDragEnd();
        return;
      }

      if (!isDrawing || !startPoint) return;

      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const canvasPoint = screenToCanvas(e.clientX, e.clientY);

      if (tool === "area") {
        let endPoint = canvasPoint;

        // Snap area to ruler if near
        if (ruler.visible) {
          const rulerSnapInfo = getRulerSnapInfo(canvasPoint);
          if (rulerSnapInfo.inStickyZone) {
            endPoint = getSnappedPoint(
              canvasPoint,
              rulerSnapInfo.snapToFarSide,
              brush.size,
            );
          }
        }

        // Draw area rectangle with rounded corners and optional border
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        const borderRadius = brush.borderRadius || 0;
        const borderWidth = brush.borderWidth || 2;
        const borderEnabled = brush.borderEnabled !== false;
        
        ctx.globalAlpha = brush.opacity;
        ctx.fillStyle = brush.color;
        
        // Draw rounded rectangle fill
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, borderRadius);
        ctx.fill();
        
        // Draw border if enabled
        if (borderEnabled) {
          ctx.strokeStyle = brush.color;
          ctx.lineWidth = borderWidth;
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, borderRadius);
          ctx.stroke();
        }

        // Record area as a stroke with top-left and bottom-right corners
        onAddPointToStroke({ x: x, y: y });
        onAddPointToStroke({ x: x + width, y: y + height });
      }

      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      lastPointRef.current = null;
      lastMarkerPointRef.current = null;
      onEndStrokeGroup();
    },
    [
      isDrawing,
      startPoint,
      tool,
      brush,
      ruler,
      isPanning,
      ruler.isDragging,
      onRulerDragEnd,
      onEndStrokeGroup,
      screenToCanvas,
      getRulerSnapInfo,
      getSnappedPoint,
      zoom,
      onAddPointToStroke,
    ],
  );

  // Mouse leave handler
  const handleMouseLeave = useCallback(() => {
    setIsRulerHovered(false);
    setIsPanning(false);
    if (ruler.isDragging) {
      onRulerDragEnd();
    }
    if (isDrawing) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      lastPointRef.current = null;
      lastMarkerPointRef.current = null;
      if (tool !== "area") {
        onEndStrokeGroup();
      }
    }
  }, [ruler.isDragging, isDrawing, tool, onRulerDragEnd, onEndStrokeGroup]);

  // Window-level wheel handler for zoom and ruler rotation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWindowWheel = (e: WheelEvent) => {
      const rect = container.getBoundingClientRect();
      const isInContainer =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isInContainer) return;

      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const currentZoom = zoomRef.current;
        const newZoom = Math.max(0.1, Math.min(5, currentZoom * delta));

        onZoomChange(newZoom, e.clientX, e.clientY);
      } else if (ruler.visible && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? 3 : -3;
        onRulerRotate(delta);
      }
    };

    window.addEventListener("wheel", handleWindowWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", handleWindowWheel, { capture: true });
    };
  }, [ruler.visible, onZoomChange, onRulerRotate]);

  // React wheel handler (fallback)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, []);

  // Cursor style
  const getCursor = () => {
    if (isPanning) return "grabbing";
    if (ruler.isDragging) return "grabbing";
    if (isRulerHovered) return "grab";
    if (isDrawing) return "crosshair";
    if (tool === "pen" || tool === "highlighter" || tool === "area")
      return "crosshair";
    return "default";
  };

  if (!imageSrc) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center justify-center select-none bg-canvas-bg",
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
        <div className="text-center pointer-events-none">
          <p className="text-text-primary/90 text-lg mb-2 font-medium">
            OmniMark
          </p>
          <p className="text-text-primary/60 text-sm mb-1">
            Press Ctrl+O to open an image
          </p>
          <p className="text-text-primary/40 text-xs">
            Ctrl+Click to pan • Ctrl+Scroll to zoom
          </p>
        </div>

        <canvas ref={baseCanvasRef} style={{ display: "none" }} />
        <canvas ref={drawCanvasRef} style={{ display: "none" }} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-canvas-bg", className)}
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
      onWheel={handleWheel}
    >
      <canvas ref={baseCanvasRef} style={{ display: "none" }} />
      <canvas ref={drawCanvasRef} style={{ display: "none" }} />

      <canvas
        ref={displayCanvasRef}
        className="block"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Status indicator */}
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
    </div>
  );
}
