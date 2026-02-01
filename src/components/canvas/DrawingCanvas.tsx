import { useEffect, useRef, useCallback, useState } from 'react';
import type { Tool, BrushSettings, RulerState, Point } from '../../types';
import { cn } from '../../lib/utils';

interface DrawingCanvasProps {
  imageSrc: string | null;
  tool: Tool;
  brush: BrushSettings;
  ruler: RulerState;
  zoom: number;
  viewOffset: { x: number; y: number };
  canvasSize: { width: number; height: number };
  onZoomChange: (zoom: number, mouseX?: number, mouseY?: number) => void;
  onViewOffsetChange: (offset: { x: number; y: number }) => void;
  onCanvasSizeChange: (size: { width: number; height: number }) => void;
  onRulerDragStart: (point: Point) => void;
  onRulerDrag: (point: Point) => void;
  onRulerDragEnd: () => void;
  onRulerRotate: (delta: number) => void;
  // Stroke-based history methods
  onStartStrokeGroup: () => void;
  onStartStroke: (tool: Tool, brush: BrushSettings, point: Point) => void;
  onAddPointToStroke: (point: Point) => void;
  onEndStrokeGroup: () => void;
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

  // Initialize canvas with image
  useEffect(() => {
    if (!imageSrc) {
      // Clear canvases when image is removed to free memory
      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      
      if (baseCanvas) {
        const baseCtx = baseCanvas.getContext('2d');
        if (baseCtx) {
          baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
        }
        baseCanvas.width = 0;
        baseCanvas.height = 0;
      }
      
      if (drawCanvas) {
        const drawCtx = drawCanvas.getContext('2d');
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

    const img = new Image();
    img.onload = () => {
      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!baseCanvas || !drawCanvas) return;

      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      drawCanvas.width = img.width;
      drawCanvas.height = img.height;

      const baseCtx = baseCanvas.getContext('2d');
      if (baseCtx) {
        baseCtx.imageSmoothingEnabled = true;
        baseCtx.imageSmoothingQuality = 'high';
        baseCtx.drawImage(img, 0, 0);
      }

      const drawCtx = drawCanvas.getContext('2d');
      if (drawCtx) {
        drawCtx.imageSmoothingEnabled = true;
        drawCtx.imageSmoothingQuality = 'high';
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      }
      
      // Clear colored pixels tracking for new image
      coloredPixelsRef.current.clear();

      onCanvasSizeChange({ width: img.width, height: img.height });
      // Don't reset viewOffset here - let App.tsx handle it once on open
    };
    img.src = imageSrc;
    
    // Cleanup: clear canvases and coloredPixels when unmounting or switching images
    return () => {
      coloredPixelsRef.current.clear();
    };
  }, [imageSrc, onCanvasSizeChange, onViewOffsetChange]);

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
    
    const baseCanvas = baseCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    const displayCanvas = displayCanvasRef.current;
    const container = containerRef.current;
    if (!baseCanvas || !drawCanvas || !displayCanvas || !container) return;

    // Safety check for valid canvas dimensions
    if (baseCanvas.width <= 0 || baseCanvas.height <= 0) return;
    if (drawCanvas.width <= 0 || drawCanvas.height <= 0) return;

    // Safety check for valid numeric values
    if (!Number.isFinite(currentZoom) || !Number.isFinite(currentViewOffset.x) || !Number.isFinite(currentViewOffset.y)) {
      console.error('Invalid zoom or viewOffset values:', { zoom: currentZoom, viewOffset: currentViewOffset });
      return;
    }
    if (currentZoom <= 0 || currentZoom > 10) {
      console.error('Zoom out of range:', currentZoom);
      return;
    }

    const displayCtx = displayCanvas.getContext('2d');
    if (!displayCtx) return;

    displayCtx.imageSmoothingEnabled = true;
    displayCtx.imageSmoothingQuality = 'high';

    const rect = container.getBoundingClientRect();
    displayCanvas.width = rect.width;
    displayCanvas.height = rect.height;

    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    // Simple viewOffset-based rendering
    // Canvas to screen: (canvasX - viewOffset.x) * zoom
    displayCtx.save();
    displayCtx.translate(-currentViewOffset.x * currentZoom, -currentViewOffset.y * currentZoom);
    displayCtx.scale(currentZoom, currentZoom);
    displayCtx.drawImage(baseCanvas, 0, 0);
    displayCtx.drawImage(drawCanvas, 0, 0);
    
    // Draw area tool preview
    if (isDrawing && tool === 'area' && startPoint && currentPoint) {
      displayCtx.save();
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(currentPoint.x - startPoint.x);
      const height = Math.abs(currentPoint.y - startPoint.y);
      displayCtx.globalAlpha = brush.opacity * 0.7;
      displayCtx.fillStyle = brush.color;
      displayCtx.fillRect(x, y, width, height);
      // Draw border for visibility
      displayCtx.globalAlpha = brush.opacity;
      displayCtx.strokeStyle = brush.color;
      displayCtx.lineWidth = 2 / currentZoom;
      displayCtx.strokeRect(x, y, width, height);
      displayCtx.restore();
    }
    
    // Draw ruler
    if (ruler.visible) {
      try {
      displayCtx.save();
      
      // Safety check for valid ruler position
      if (!Number.isFinite(ruler.x) || !Number.isFinite(ruler.y) || !Number.isFinite(ruler.angle)) {
        console.error('Invalid ruler values:', ruler);
        displayCtx.restore();
        return;
      }
      
      displayCtx.translate(ruler.x, ruler.y);
      displayCtx.rotate((ruler.angle * Math.PI) / 180);
      
      // Safety check for valid canvas dimensions
      if (canvasSize.width > 0 && canvasSize.height > 0) {
        const diagonal = Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2);
        const rulerLength = diagonal * 3;
        const rulerHeight = 60;
        
        // Ensure ruler dimensions are valid
        if (rulerLength > 0 && rulerHeight > 0) {
          displayCtx.fillStyle = 'rgba(200, 200, 200, 0.9)';
          displayCtx.fillRect(-rulerLength / 2, -rulerHeight / 2, rulerLength, rulerHeight);
          
          displayCtx.strokeStyle = 'rgba(100, 100, 100, 1)';
          displayCtx.lineWidth = 2 / currentZoom;
          displayCtx.strokeRect(-rulerLength / 2, -rulerHeight / 2, rulerLength, rulerHeight);
          
          displayCtx.strokeStyle = 'rgba(40, 40, 40, 1)';
          displayCtx.lineWidth = 1.5 / currentZoom;
          displayCtx.beginPath();
          
          const tickSpacing = 10;
          const tickCount = Math.floor(rulerLength / tickSpacing);
          
          for (let i = -Math.floor(tickCount / 2); i <= Math.floor(tickCount / 2); i++) {
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
              displayCtx.fillStyle = 'rgba(40, 40, 40, 1)';
              displayCtx.font = `bold ${11 / currentZoom}px sans-serif`;
              displayCtx.textAlign = 'center';
              displayCtx.textBaseline = 'middle';
              displayCtx.fillText(String(absI / 10), x, 0);
            }
          }
          
          displayCtx.stroke();
          
          const centerRadius = 22;
          displayCtx.beginPath();
          displayCtx.arc(0, 0, centerRadius, 0, Math.PI * 2);
          displayCtx.fillStyle = 'rgba(220, 220, 220, 1)';
          displayCtx.fill();
          displayCtx.strokeStyle = 'rgba(80, 80, 80, 1)';
          displayCtx.lineWidth = 2 / currentZoom;
          displayCtx.stroke();
          
          displayCtx.fillStyle = 'rgba(0, 0, 0, 1)';
          displayCtx.font = `bold ${13 / currentZoom}px sans-serif`;
          displayCtx.textAlign = 'center';
          displayCtx.textBaseline = 'middle';
          displayCtx.fillText(`${Math.round(ruler.angle % 360)}°`, 0, 0);
          
          displayCtx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const r1 = centerRadius + 2;
            const r2 = i % 2 === 0 ? centerRadius + 8 : centerRadius + 5;
            displayCtx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
            displayCtx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
          }
          displayCtx.strokeStyle = 'rgba(180, 50, 50, 1)';
          displayCtx.lineWidth = 1.5 / currentZoom;
          displayCtx.stroke();
        }
      }
      
      displayCtx.restore();
      } catch (error) {
        console.error('Error drawing ruler:', error);
        displayCtx.restore();
      }
    }
    
    displayCtx.restore();
    } catch (error) {
      console.error('Error in renderDisplay:', error);
    }
  }, [canvasSize, ruler, isDrawing, tool, startPoint, currentPoint, brush.color, brush.opacity]);

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
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();

    return {
      x: (screenX - rect.left) / zoom + viewOffset.x,
      y: (screenY - rect.top) / zoom + viewOffset.y,
    };
  }, [zoom, viewOffset]);

  const RULER_HEIGHT = 60;
  const SNAP_DISTANCE = 50; // pixels

  // Get perpendicular distance from point to ruler center line
  // Returns: distance to closest edge, which edge (true=top/far side, false=bottom/near side), and if on ruler length
  const getRulerSnapInfo = useCallback((point: Point): { 
    distance: number;      // Distance to closest edge in perpendicular direction
    snapToFarSide: boolean; // true = snap to top edge (far side), false = snap to bottom edge (near side)
    inStickyZone: boolean;  // true if within SNAP_DISTANCE of an edge
    onRuler: boolean;       // true if within ruler length bounds
  } => {
    if (!ruler.visible) return { distance: Infinity, snapToFarSide: false, inStickyZone: false, onRuler: false };

    const angleRad = (ruler.angle * Math.PI) / 180;
    const dx = point.x - ruler.x;
    const dy = point.y - ruler.y;
    
    // Perpendicular distance to ruler center (0 = on center line)
    // Positive = "below" ruler in screen space, negative = "above" ruler
    const perpDist = dx * Math.sin(angleRad) - dy * Math.cos(angleRad);
    
    // Check if within ruler length bounds
    const parallelDist = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);
    const rulerLength = Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2) * 2;
    const onRuler = Math.abs(parallelDist) <= rulerLength / 2;
    
    // Top edge is at perpDist = -RULER_HEIGHT/2
    // Bottom edge is at perpDist = +RULER_HEIGHT/2
    const distToTopEdge = perpDist - (-RULER_HEIGHT / 2);    // Distance from top edge (positive = below top edge)
    const distToBottomEdge = perpDist - (RULER_HEIGHT / 2);  // Distance from bottom edge (positive = below bottom edge)
    
    // Determine which edge we're closer to and if we're in the sticky zone
    const absDistToTop = Math.abs(distToTopEdge);
    const absDistToBottom = Math.abs(distToBottomEdge);
    
    if (absDistToTop < absDistToBottom) {
      // Closer to top edge
      const inStickyZone = absDistToTop < SNAP_DISTANCE;
      // snapToFarSide = true means we're snapping to the top edge (the "far" side from ruler center)
      return { distance: absDistToTop, snapToFarSide: true, inStickyZone, onRuler };
    } else {
      // Closer to bottom edge
      const inStickyZone = absDistToBottom < SNAP_DISTANCE;
      return { distance: absDistToBottom, snapToFarSide: false, inStickyZone, onRuler };
    }
  }, [ruler, canvasSize]);

  // Check if point is on the ruler (for dragging the ruler itself)
  const isClickOnRuler = useCallback((point: Point): boolean => {
    if (!ruler.visible) return false;

    const dx = point.x - ruler.x;
    const dy = point.y - ruler.y;

    const angleRad = (-ruler.angle * Math.PI) / 180;
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    const rulerLength = Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2) * 3;

    return Math.abs(rotatedX) <= rulerLength / 2 && Math.abs(rotatedY) <= RULER_HEIGHT / 2;
  }, [ruler, canvasSize]);

  // Snap point to ruler edge
  // Places the drawing position outside the ruler, offset by marker's perpendicular extent
  // The marker is axis-aligned (width x height), so its perpendicular extent depends on ruler angle
  // snapToFarSide: true = top edge, false = bottom edge
  const getSnappedPoint = useCallback((point: Point, snapToFarSide: boolean, brushSize: number): Point => {
    if (!ruler.visible) return point;

    const angleRad = (ruler.angle * Math.PI) / 180;
    const dx = point.x - ruler.x;
    const dy = point.y - ruler.y;
    
    // Distance along ruler direction (parallel)
    const distAlong = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);
    
    // Calculate marker's perpendicular extent based on ruler angle
    // Marker is axis-aligned: height = brushSize (slider controls height), width = height * 0.3
    // Perpendicular extent = |cos(angle)| * height/2 + |sin(angle)| * width/2
    const markerHeight = brushSize;
    const markerWidth = brushSize * 0.3;
    const perpExtent = Math.abs(Math.cos(angleRad)) * (markerHeight / 2) + 
                       Math.abs(Math.sin(angleRad)) * (markerWidth / 2);
    
    // Snap to edge with perpendicular extent offset to place stroke entirely outside ruler
    // Top edge at -RULER_HEIGHT/2, subtract perpExtent to place above ruler
    // Bottom edge at +RULER_HEIGHT/2, add perpExtent to place below ruler
    const edgeOffset = snapToFarSide 
      ? -RULER_HEIGHT / 2 - perpExtent  // Above ruler
      : RULER_HEIGHT / 2 + perpExtent;  // Below ruler
    
    return {
      x: ruler.x + distAlong * Math.cos(angleRad) + edgeOffset * Math.sin(angleRad),
      y: ruler.y + distAlong * Math.sin(angleRad) - edgeOffset * Math.cos(angleRad),
    };
  }, [ruler]);

  // Mouse down handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const canvasPoint = screenToCanvas(e.clientX, e.clientY);

    // Pan with middle mouse or Ctrl+left click
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      setIsPanning(true);
      panStartRef.current = { 
        x: canvasPoint.x,
        y: canvasPoint.y
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush.size;

    if (tool === 'pen') {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brush.color;
      ctx.beginPath();
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else if (tool === 'highlighter') {
      ctx.globalAlpha = brush.opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = brush.color;
      coloredPixelsRef.current.clear();
      
      const height = brush.size;
      const width = brush.size * 0.3;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      
      // Draw initial marker - check all pixels under the marker
      const startGridX = Math.floor(canvasPoint.x - halfWidth);
      const endGridX = Math.ceil(canvasPoint.x + halfWidth);
      const startGridY = Math.floor(canvasPoint.y - halfHeight);
      const endGridY = Math.ceil(canvasPoint.y + halfHeight);
      
      for (let gridX = startGridX; gridX < endGridX; gridX++) {
        for (let gridY = startGridY; gridY < endGridY; gridY++) {
          const pixelCenterX = gridX + 0.5;
          const pixelCenterY = gridY + 0.5;
          
          const dx = Math.abs(pixelCenterX - canvasPoint.x);
          const dy = Math.abs(pixelCenterY - canvasPoint.y);
          
          if (dx <= halfWidth && dy <= halfHeight) {
            const pixelKey = `${gridX},${gridY}`;
            coloredPixelsRef.current.add(pixelKey);
            // Draw smooth pixel with anti-aliasing (slightly larger than 1x1 for smooth edges)
            ctx.fillRect(gridX - 0.5, gridY - 0.5, 2, 2);
          }
        }
      }
    } else if (tool === 'area') {
      ctx.globalAlpha = brush.opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = brush.color;
    }

    // Start stroke-based recording
    onStartStrokeGroup();
    onStartStroke(tool, brush, canvasPoint);
  }, [tool, brush, isClickOnRuler, onRulerDragStart, screenToCanvas, onStartStrokeGroup, onStartStroke]);

  // Mouse move handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasPoint = screenToCanvas(e.clientX, e.clientY);
    
    if (isPanning) {
      // Pan by adjusting viewOffset
      // The canvas point under the mouse should remain the same
      const deltaX = panStartRef.current.x - canvasPoint.x;
      const deltaY = panStartRef.current.y - canvasPoint.y;
      const newViewOffset = {
        x: viewOffset.x + deltaX,
        y: viewOffset.y + deltaY
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tool === 'pen' || tool === 'highlighter') {
      // Always snap to ruler when ruler is visible and near it
      let drawPoint = canvasPoint;
      
      if (ruler.visible) {
        const rulerSnapInfo = getRulerSnapInfo(canvasPoint);
        // Snap when in sticky zone (within SNAP_DISTANCE of an edge)
        if (rulerSnapInfo.inStickyZone) {
          drawPoint = getSnappedPoint(canvasPoint, rulerSnapInfo.snapToFarSide, brush.size);
        }
      }

      if (tool === 'pen') {
        // Draw pen stroke immediately for feedback
        ctx.lineTo(drawPoint.x, drawPoint.y);
        ctx.stroke();
      } else if (tool === 'highlighter') {
        // Draw marker stroke - check all pixels along the path
        if (lastMarkerPointRef.current) {
          const height = brush.size;
          const width = brush.size * 0.3;
          const halfWidth = width / 2;
          const halfHeight = height / 2;
          
          const lastPoint = lastMarkerPointRef.current;
          const dx = drawPoint.x - lastPoint.x;
          const dy = drawPoint.y - lastPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Step size for interpolation
          const stepSize = 2;
          const steps = Math.max(1, Math.ceil(distance / stepSize));
          
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const interpX = lastPoint.x + dx * t;
            const interpY = lastPoint.y + dy * t;
            
            // Check all pixels under the marker at this position
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
                    // Draw smooth pixel with anti-aliasing (slightly larger than 1x1)
                    ctx.fillRect(gridX - 0.5, gridY - 0.5, 2, 2);
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
    } else if (tool === 'area') {
      // Update current point for live preview
      setCurrentPoint(canvasPoint);
    }
  }, [isDrawing, startPoint, tool, ruler, isPanning, onRulerDrag, screenToCanvas, isClickOnRuler, getRulerSnapInfo, getSnappedPoint, zoom, onViewOffsetChange, viewOffset, brush.size, onAddPointToStroke]);

  // Mouse up handler
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasPoint = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'area') {
      let endPoint = canvasPoint;
      
      // Snap area to ruler if near
      if (ruler.visible) {
        const rulerSnapInfo = getRulerSnapInfo(canvasPoint);
        if (rulerSnapInfo.inStickyZone) {
          endPoint = getSnappedPoint(canvasPoint, rulerSnapInfo.snapToFarSide, brush.size);
        }
      }

      // Draw area rectangle
      const x = Math.min(startPoint.x, endPoint.x);
      const y = Math.min(startPoint.y, endPoint.y);
      const width = Math.abs(endPoint.x - startPoint.x);
      const height = Math.abs(endPoint.y - startPoint.y);
      ctx.fillRect(x, y, width, height);

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
  }, [isDrawing, startPoint, tool, brush, ruler, isPanning, ruler.isDragging, onRulerDragEnd, onEndStrokeGroup, screenToCanvas, getRulerSnapInfo, getSnappedPoint, zoom, onAddPointToStroke]);

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
      // End stroke group for pen/highlighter tools
      if (tool !== 'area') {
        onEndStrokeGroup();
      }
    }
  }, [ruler.isDragging, isDrawing, tool, onRulerDragEnd, onEndStrokeGroup]);

  // Window-level wheel handler for zoom and ruler rotation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWindowWheel = (e: WheelEvent) => {
      // Check if event is within our container
      const rect = container.getBoundingClientRect();
      const isInContainer = e.clientX >= rect.left && e.clientX <= rect.right && 
                            e.clientY >= rect.top && e.clientY <= rect.bottom;
      
      if (!isInContainer) return;
      
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const currentZoom = zoomRef.current; // Use ref to avoid stale closure
        const newZoom = Math.max(0.1, Math.min(5, currentZoom * delta));
        
        // Zoom towards mouse position
        onZoomChange(newZoom, e.clientX, e.clientY);
      } else if (ruler.visible && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? 3 : -3;
        onRulerRotate(delta);
      }
    };
    
    // Attach to window to capture all wheel events
    window.addEventListener('wheel', handleWindowWheel, { passive: false, capture: true });
    
    return () => {
      window.removeEventListener('wheel', handleWindowWheel, { capture: true });
    };
  }, [ruler.visible, onZoomChange, onRulerRotate]); // Note: zoom removed - using zoomRef instead

  // React wheel handler (fallback, should not be needed now)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Window-level handler should catch this, but keep for safety
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, []);

  // Cursor style
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (ruler.isDragging) return 'grabbing';
    if (isRulerHovered) return 'grab';
    if (isDrawing) return 'crosshair';
    if (tool === 'pen' || tool === 'highlighter' || tool === 'area') return 'crosshair';
    return 'default';
  };

  if (!imageSrc) {
    return (
      <div
        ref={containerRef}
        className={cn('flex items-center justify-center', className)}
        style={{ 
          width: '100%', 
          height: '100%',
          background: 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          backgroundColor: '#1a1a1a'
        }}
      >
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">OmniSnip</p>
          <p className="text-gray-500 text-sm">Press Ctrl+O to open an image</p>
          <p className="text-gray-600 text-xs mt-2">Ctrl+Click to pan • Ctrl+Scroll to zoom</p>
        </div>
        
        <canvas ref={baseCanvasRef} style={{ display: 'none' }} />
        <canvas ref={drawCanvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      style={{
        width: '100%',
        height: '100%',
        cursor: getCursor(),
        background: 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        backgroundColor: '#1a1a1a'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      <canvas ref={baseCanvasRef} style={{ display: 'none' }} />
      <canvas ref={drawCanvasRef} style={{ display: 'none' }} />
      
      <canvas
        ref={displayCanvasRef}
        className="block"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Status indicator */}
      <div className="absolute bottom-4 right-4 bg-black/80 text-white px-3 py-2 rounded-lg text-xs font-mono pointer-events-none select-none flex flex-col gap-1">
        <div>Zoom: {Math.round(zoom * 100)}%</div>
        {(viewOffset.x !== 0 || viewOffset.y !== 0) && <div className="text-gray-400">Panned</div>}
        {ruler.visible && <div className="text-blue-400">Ruler: {Math.round(ruler.angle % 360)}°</div>}
      </div>
    </div>
  );
}
