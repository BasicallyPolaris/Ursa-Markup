import type {
  Point,
  Size,
  ViewState,
  PreviewState,
  Stroke,
  StrokeHistoryState,
} from "../types";
import { BrushEngine } from "./BrushEngine";
import { Ruler } from "./Ruler";

/**
 * CanvasEngine manages the multi-layer canvas system:
 * - Base canvas: Original image
 * - Draw canvas: User strokes (normal blend mode only)
 * - Multiply canvas: Strokes with multiply blend mode (rendered against base)
 * - Composite canvas: Pre-composited base + multiply + draw (cached for fast pan/zoom)
 * - Display canvas: Final view with zoom/pan transform
 */
export class CanvasEngine {
  // Canvas elements
  baseCanvas: HTMLCanvasElement | null = null;
  drawCanvas: HTMLCanvasElement | null = null;
  multiplyCanvas: HTMLCanvasElement | null = null;
  compositeCanvas: HTMLCanvasElement | null = null; // Cached composite of all layers
  displayCanvas: HTMLCanvasElement | null = null;

  // Contexts
  baseCtx: CanvasRenderingContext2D | null = null;
  drawCtx: CanvasRenderingContext2D | null = null;
  multiplyCtx: CanvasRenderingContext2D | null = null;
  compositeCtx: CanvasRenderingContext2D | null = null;
  displayCtx: CanvasRenderingContext2D | null = null;

  // State
  baseImageData: ImageData | null = null;
  isImageLoading = false;
  canvasSize: Size = { width: 0, height: 0 };

  // Track last rendered state for incremental rendering
  private lastRenderedIndex = -1;
  private lastRenderedGroupCount = 0;

  // Dependencies
  private brushEngine: BrushEngine;

  // Container reference for coordinate calculations
  private container: HTMLElement | null = null;

  constructor(brushEngine?: BrushEngine) {
    this.brushEngine = brushEngine || new BrushEngine();
  }

  /**
   * Initialize canvas elements within a container
   */
  initialize(container: HTMLElement): void {
    this.container = container;

    // Create or get canvas elements
    this.baseCanvas = this.createCanvas("base-canvas");
    this.drawCanvas = this.createCanvas("draw-canvas");
    this.multiplyCanvas = this.createCanvas("multiply-canvas");
    this.compositeCanvas = this.createCanvas("composite-canvas");
    this.displayCanvas = this.createCanvas("display-canvas");

    // Set up display canvas style
    if (this.displayCanvas) {
      this.displayCanvas.style.width = "100%";
      this.displayCanvas.style.height = "100%";
      this.displayCanvas.style.display = "block";
    }

    // Append display canvas to container
    if (this.displayCanvas && this.container) {
      this.container.appendChild(this.displayCanvas);
    }

    // Get contexts
    this.baseCtx = this.baseCanvas?.getContext("2d") || null;
    this.drawCtx = this.drawCanvas?.getContext("2d") || null;
    this.multiplyCtx = this.multiplyCanvas?.getContext("2d") || null;
    this.compositeCtx = this.compositeCanvas?.getContext("2d") || null;
    this.displayCtx = this.displayCanvas?.getContext("2d") || null;

    // Set up context defaults
    this.setupContexts();
  }

  /**
   * Load an image into the base canvas
   */
  async loadImage(imageSrc: string): Promise<void> {
    if (this.isImageLoading) return;
    this.isImageLoading = true;

    // Reset incremental rendering state when loading a new image
    this.resetIncrementalState();

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.resizeCanvases(img.width, img.height);

        // Draw image to base canvas
        if (this.baseCtx && this.baseCanvas) {
          this.baseCtx.imageSmoothingEnabled = true;
          this.baseCtx.imageSmoothingQuality = "high";
          this.baseCtx.drawImage(img, 0, 0);

          // Capture base image data for color blend mode
          this.baseImageData = this.baseCtx.getImageData(
            0,
            0,
            this.baseCanvas.width,
            this.baseCanvas.height,
          );
        }

        // Clear draw canvas
        if (this.drawCtx && this.drawCanvas) {
          this.drawCtx.clearRect(
            0,
            0,
            this.drawCanvas.width,
            this.drawCanvas.height,
          );
        }

        // Clear multiply canvas
        if (this.multiplyCtx && this.multiplyCanvas) {
          this.multiplyCtx.clearRect(
            0,
            0,
            this.multiplyCanvas.width,
            this.multiplyCanvas.height,
          );
        }

        this.canvasSize = { width: img.width, height: img.height };
        this.isImageLoading = false;

        // Update the composite canvas with the loaded image
        this.updateComposite();

        resolve();
      };

      img.onerror = () => {
        this.isImageLoading = false;
        reject(new Error("Failed to load image"));
      };

      img.src = imageSrc;
    });
  }

  /**
   * Clear all canvases
   */
  clear(): void {
    if (this.baseCtx && this.baseCanvas) {
      this.baseCtx.clearRect(
        0,
        0,
        this.baseCanvas.width,
        this.baseCanvas.height,
      );
    }
    if (this.drawCtx && this.drawCanvas) {
      this.drawCtx.clearRect(
        0,
        0,
        this.drawCanvas.width,
        this.drawCanvas.height,
      );
    }
    if (this.multiplyCtx && this.multiplyCanvas) {
      this.multiplyCtx.clearRect(
        0,
        0,
        this.multiplyCanvas.width,
        this.multiplyCanvas.height,
      );
    }
    if (this.compositeCtx && this.compositeCanvas) {
      this.compositeCtx.clearRect(
        0,
        0,
        this.compositeCanvas.width,
        this.compositeCanvas.height,
      );
    }
    if (this.displayCtx && this.displayCanvas) {
      this.displayCtx.clearRect(
        0,
        0,
        this.displayCanvas.width,
        this.displayCanvas.height,
      );
    }

    this.baseImageData = null;
    this.canvasSize = { width: 0, height: 0 };
    this.resetIncrementalState();
  }

  /**
   * Update the composite canvas (combines base + multiply + draw)
   * This is called after strokes change, not on every render
   */
  updateComposite(): void {
    if (!this.compositeCtx || !this.compositeCanvas) return;
    if (!this.baseCanvas) return;

    // Clear composite
    this.compositeCtx.clearRect(
      0,
      0,
      this.compositeCanvas.width,
      this.compositeCanvas.height,
    );

    // Draw base canvas (image)
    this.compositeCtx.drawImage(this.baseCanvas, 0, 0);

    // Draw multiply canvas with multiply blend mode
    if (this.multiplyCanvas) {
      this.compositeCtx.globalCompositeOperation = "multiply";
      this.compositeCtx.drawImage(this.multiplyCanvas, 0, 0);
      this.compositeCtx.globalCompositeOperation = "source-over";
    }

    // Draw normal strokes canvas
    if (this.drawCanvas) {
      this.compositeCtx.drawImage(this.drawCanvas, 0, 0);
    }
  }

  /**
   * Render the display canvas with current view state
   * Uses the pre-composited canvas for fast pan/zoom
   */
  render(viewState: ViewState, ruler: Ruler, preview?: PreviewState): void {
    if (!this.displayCanvas || !this.displayCtx || !this.container) return;
    if (this.canvasSize.width === 0 || this.canvasSize.height === 0) return;

    // Validate view state
    if (
      !Number.isFinite(viewState.zoom) ||
      !Number.isFinite(viewState.viewOffset.x) ||
      !Number.isFinite(viewState.viewOffset.y)
    ) {
      console.error("Invalid view state:", viewState);
      return;
    }

    if (viewState.zoom <= 0 || viewState.zoom > 10) {
      console.error("Zoom out of range:", viewState.zoom);
      return;
    }

    // Resize display canvas to container
    const rect = this.container.getBoundingClientRect();
    if (
      this.displayCanvas.width !== rect.width ||
      this.displayCanvas.height !== rect.height
    ) {
      this.displayCanvas.width = rect.width;
      this.displayCanvas.height = rect.height;
    }

    // Clear display canvas
    this.displayCtx.clearRect(
      0,
      0,
      this.displayCanvas.width,
      this.displayCanvas.height,
    );

    // Set up high-quality rendering
    this.displayCtx.imageSmoothingEnabled = true;
    this.displayCtx.imageSmoothingQuality = "high";

    // Apply view transform
    this.displayCtx.save();
    this.displayCtx.translate(
      -viewState.viewOffset.x * viewState.zoom,
      -viewState.viewOffset.y * viewState.zoom,
    );
    this.displayCtx.scale(viewState.zoom, viewState.zoom);

    // Draw the pre-composited canvas (base + multiply + draw combined)
    // This is much faster than drawing 3 separate canvases
    if (this.compositeCanvas) {
      this.displayCtx.drawImage(this.compositeCanvas, 0, 0);
    }

    // Draw preview if active
    if (preview) {
      this.renderPreview(preview);
    }

    this.displayCtx.restore();

    // Draw ruler in screen space (not affected by view transform)
    // Pass display canvas size for ruler length calculation
    const screenSize = {
      width: this.displayCanvas.width,
      height: this.displayCanvas.height,
    };
    ruler.render(this.displayCtx, screenSize);
  }

  /**
   * Replay strokes to the appropriate canvases
   * Normal strokes go to drawCanvas, multiply strokes go to multiplyCanvas
   *
   * Supports incremental rendering:
   * - If this is a new stroke being added (index increased by 1, groups increased by 1), only draw the new stroke
   * - If this is undo/redo or other change, do a full replay
   */
  replayStrokes(strokeHistory: StrokeHistoryState): void {
    if (!this.drawCtx || !this.drawCanvas) {
      return;
    }
    if (!this.multiplyCtx || !this.multiplyCanvas) {
      return;
    }

    const { groups, currentIndex } = strokeHistory;

    // Detect if this is an incremental add (new stroke group added)
    // Conditions for incremental rendering:
    // 1. New index is exactly one more than last rendered
    // 2. Groups array length is one more than last count (ensures it's a new stroke, not redo)
    // 3. Last rendered index was valid (>= -1 to handle first stroke)
    const isIncrementalAdd =
      currentIndex === this.lastRenderedIndex + 1 &&
      groups.length === this.lastRenderedGroupCount + 1 &&
      this.lastRenderedIndex >= -1 &&
      currentIndex >= 0;

    if (isIncrementalAdd) {
      // Incremental: only draw the newest stroke group
      const newGroup = groups[currentIndex];
      if (newGroup) {
        for (const stroke of newGroup.strokes) {
          this.replayStroke(stroke);
        }
      }
    } else {
      // Full replay: clear canvases and redraw everything
      // This handles: undo, redo, tab switch, or any non-incremental change
      this.drawCtx.clearRect(
        0,
        0,
        this.drawCanvas.width,
        this.drawCanvas.height,
      );
      this.multiplyCtx.clearRect(
        0,
        0,
        this.multiplyCanvas.width,
        this.multiplyCanvas.height,
      );

      // Replay all strokes up to current index
      for (let i = 0; i <= currentIndex; i++) {
        const group = groups[i];
        if (!group) continue;

        for (const stroke of group.strokes) {
          this.replayStroke(stroke);
        }
      }
    }

    // Update tracking state
    this.lastRenderedIndex = currentIndex;
    this.lastRenderedGroupCount = groups.length;

    // Update the composite canvas after strokes change
    this.updateComposite();
  }

  /**
   * Reset the incremental rendering state
   * Call this when loading a new image or switching documents
   */
  resetIncrementalState(): void {
    this.lastRenderedIndex = -1;
    this.lastRenderedGroupCount = 0;
  }

  /**
   * Replay a single stroke to the appropriate canvas
   */
  private replayStroke(stroke: Stroke): void {
    // Route to multiply canvas if blend mode is multiply, otherwise to draw canvas
    // stroke.brush is canonical; allow stroke.blendMode for legacy data
    const brushSettings = stroke.brushSettings;
    const effectiveBlend = brushSettings?.blendMode ?? "normal";
    const isMultiply = effectiveBlend === "multiply";
    const ctx = isMultiply ? this.multiplyCtx : this.drawCtx;
    const canvas = isMultiply ? this.multiplyCanvas : this.drawCanvas;

    if (!ctx || !canvas) return;

    // For multiply strokes, we draw with normal composite operation
    // The multiply effect is applied when compositing in render()
    ctx.globalCompositeOperation = "source-over";

    switch (stroke.tool) {
      case "pen":
        this.brushEngine.drawPenStroke(
          ctx,
          stroke.points,
          stroke.brushSettings,
        );
        break;
      case "highlighter":
        this.brushEngine.drawHighlighterStroke(
          ctx,
          stroke.points,
          stroke.brushSettings,
        );
        break;
      case "area":
        if (stroke.points.length >= 2) {
          const start = stroke.points[0];
          const end = stroke.points[stroke.points.length - 1];
          this.brushEngine.drawArea(ctx, start, end, stroke.brushSettings);
        }
        break;
    }
  }

  /**
   * Render a preview of the current stroke
   * For multiply mode, we apply the multiply composite operation
   * For color mode, we use simplified semi-transparent preview (smooth, not pixel-by-pixel)
   * The final committed stroke will have accurate color blending
   */
  private renderPreview(preview: PreviewState): void {
    if (!this.displayCtx) return;

    const isMultiply = preview.blendMode === "multiply";

    // Apply multiply composite if needed
    if (isMultiply) {
      this.displayCtx.globalCompositeOperation = "multiply";
    }

    if (preview.tool === "area" && preview.startPoint && preview.currentPoint) {
      const x = Math.min(preview.startPoint.x, preview.currentPoint.x);
      const y = Math.min(preview.startPoint.y, preview.currentPoint.y);
      const width = Math.abs(preview.currentPoint.x - preview.startPoint.x);
      const height = Math.abs(preview.currentPoint.y - preview.startPoint.y);

      const borderRadius = preview.brush.borderRadius || 0;
      const borderWidth = preview.brush.borderWidth || 0;

      // Use full opacity for preview to match the final applied result
      this.displayCtx.globalAlpha = preview.brush.opacity;
      this.displayCtx.fillStyle = preview.brush.color;
      this.displayCtx.beginPath();
      this.displayCtx.roundRect(x, y, width, height, borderRadius);
      this.displayCtx.fill();

      // Draw border if borderWidth > 0
      // Border is drawn OUTSIDE the fill area (outset) - matching BrushEngine.drawArea()
      if (borderWidth > 0) {
        const halfBorder = borderWidth / 2;
        this.displayCtx.globalAlpha = preview.brush.opacity;
        this.displayCtx.strokeStyle = preview.brush.color;
        this.displayCtx.lineWidth = borderWidth;
        this.displayCtx.setLineDash([]);
        this.displayCtx.beginPath();
        // Offset outward by half the border width so the border is outside the fill
        this.displayCtx.roundRect(
          x - halfBorder,
          y - halfBorder,
          width + borderWidth,
          height + borderWidth,
          borderRadius + halfBorder,
        );
        this.displayCtx.stroke();
      }

      this.displayCtx.globalAlpha = 1;
    } else if (
      preview.tool === "pen" &&
      preview.points &&
      preview.points.length > 0
    ) {
      // Use full opacity for preview to match the final applied result
      this.displayCtx.save();
      this.displayCtx.lineCap = "round";
      this.displayCtx.lineJoin = "round";
      this.displayCtx.lineWidth = preview.brush.size;
      this.displayCtx.strokeStyle = preview.brush.color;
      this.displayCtx.globalAlpha = preview.brush.opacity;

      this.displayCtx.beginPath();
      this.displayCtx.moveTo(preview.points[0].x, preview.points[0].y);
      for (let i = 1; i < preview.points.length; i++) {
        this.displayCtx.lineTo(preview.points[i].x, preview.points[i].y);
      }
      this.displayCtx.stroke();
      this.displayCtx.restore();
    } else if (
      preview.tool === "highlighter" &&
      preview.points &&
      preview.points.length > 0
    ) {
      // Draw highlighter preview with smooth anti-aliased strokes
      // Uses square caps for flat ends, quadratic curves for smoothness
      this.displayCtx.save();

      this.displayCtx.lineCap = "square";
      this.displayCtx.lineJoin = "bevel";
      this.displayCtx.lineWidth = preview.brush.size;
      this.displayCtx.strokeStyle = preview.brush.color;
      this.displayCtx.globalAlpha = preview.brush.opacity;

      this.displayCtx.beginPath();
      this.displayCtx.moveTo(preview.points[0].x, preview.points[0].y);

      if (preview.points.length === 1) {
        // Single point - draw a short horizontal line
        this.displayCtx.lineTo(preview.points[0].x + 1, preview.points[0].y);
      } else if (preview.points.length === 2) {
        // Two points - draw a straight line
        this.displayCtx.lineTo(preview.points[1].x, preview.points[1].y);
      } else {
        // Multiple points - use quadratic curves for smoothness
        for (let i = 1; i < preview.points.length - 1; i++) {
          const curr = preview.points[i];
          const next = preview.points[i + 1];
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          this.displayCtx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        }
        // Last point - draw directly to it
        const last = preview.points[preview.points.length - 1];
        this.displayCtx.lineTo(last.x, last.y);
      }

      this.displayCtx.stroke();
      this.displayCtx.restore();
    }

    // Reset composite operation
    this.displayCtx.globalCompositeOperation = "source-over";
    this.displayCtx.globalAlpha = 1;
  }

  /**
   * Destroy engine and remove canvas elements
   */
  destroy(): void {
    this.clear();

    if (this.displayCanvas && this.displayCanvas.parentNode) {
      this.displayCanvas.parentNode.removeChild(this.displayCanvas);
    }

    this.baseCanvas = null;
    this.drawCanvas = null;
    this.multiplyCanvas = null;
    this.compositeCanvas = null;
    this.displayCanvas = null;
    this.baseCtx = null;
    this.drawCtx = null;
    this.multiplyCtx = null;
    this.compositeCtx = null;
    this.displayCtx = null;
    this.container = null;
  }

  /**
   * Get a combined canvas (base + multiply + draw) for saving/copying
   * Creates a fresh composition to ensure all strokes are included
   */
  getCombinedCanvas(): HTMLCanvasElement | null {
    return this.getFreshCombinedCanvas();
  }

  /**
   * Get a fresh combined canvas by recompositing all layers
   * Use this when you need a guaranteed fresh composition (e.g., after direct canvas manipulation)
   */
  getFreshCombinedCanvas(): HTMLCanvasElement | null {
    if (!this.baseCanvas || !this.drawCanvas) return null;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.baseCanvas.width;
    tempCanvas.height = this.baseCanvas.height;

    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return null;

    // Draw base canvas (the original image)
    tempCtx.drawImage(this.baseCanvas, 0, 0);

    // Draw multiply canvas with multiply blend mode
    if (this.multiplyCanvas) {
      tempCtx.globalCompositeOperation = "multiply";
      tempCtx.drawImage(this.multiplyCanvas, 0, 0);
      tempCtx.globalCompositeOperation = "source-over";
    }

    // Draw normal strokes canvas
    tempCtx.drawImage(this.drawCanvas, 0, 0);

    return tempCanvas;
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(
    screenX: number,
    screenY: number,
    viewState: ViewState,
  ): Point | null {
    if (!this.container) return null;

    const rect = this.container.getBoundingClientRect();

    return {
      x: (screenX - rect.left) / viewState.zoom + viewState.viewOffset.x,
      y: (screenY - rect.top) / viewState.zoom + viewState.viewOffset.y,
    };
  }

  /**
   * Resize all canvases to a new size
   */
  private resizeCanvases(width: number, height: number): void {
    if (this.baseCanvas) {
      this.baseCanvas.width = width;
      this.baseCanvas.height = height;
    }
    if (this.drawCanvas) {
      this.drawCanvas.width = width;
      this.drawCanvas.height = height;
    }
    if (this.multiplyCanvas) {
      this.multiplyCanvas.width = width;
      this.multiplyCanvas.height = height;
    }
    if (this.compositeCanvas) {
      this.compositeCanvas.width = width;
      this.compositeCanvas.height = height;
    }
  }

  /**
   * Create a canvas element
   */
  private createCanvas(className: string): HTMLCanvasElement {
    // Check if canvas already exists
    const existing = document.querySelector(
      `.${className}`,
    ) as HTMLCanvasElement;
    if (existing) {
      return existing;
    }

    // Create new canvas
    const canvas = document.createElement("canvas");
    canvas.className = className;
    // Only hide base and draw canvases (offscreen buffers), display canvas should be visible
    if (className !== "display-canvas") {
      canvas.style.display = "none";
    }
    return canvas;
  }

  /**
   * Set up canvas context defaults
   */
  private setupContexts(): void {
    if (this.baseCtx) {
      this.baseCtx.imageSmoothingEnabled = true;
      this.baseCtx.imageSmoothingQuality = "high";
    }
    if (this.drawCtx) {
      this.drawCtx.imageSmoothingEnabled = true;
      this.drawCtx.imageSmoothingQuality = "high";
    }
    if (this.multiplyCtx) {
      this.multiplyCtx.imageSmoothingEnabled = true;
      this.multiplyCtx.imageSmoothingQuality = "high";
    }
    if (this.compositeCtx) {
      this.compositeCtx.imageSmoothingEnabled = true;
      this.compositeCtx.imageSmoothingQuality = "high";
    }
    if (this.displayCtx) {
      this.displayCtx.imageSmoothingEnabled = true;
      this.displayCtx.imageSmoothingQuality = "high";
    }
  }
}
