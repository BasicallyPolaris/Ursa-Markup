import {
  Point,
  type AnyPreviewState,
  type AnyStroke,
  type AnyStrokeGroup,
  type Size,
  type Stroke,
  type StrokeHistoryState,
  type ViewState,
} from "~/types";

import {
  BlendModes,
  Tools,
  type AreaToolConfig,
  type HighlighterToolConfig,
  type PenToolConfig,
} from "~/types/tools";

import { BrushEngine } from "./BrushEngine";
import { Ruler } from "./Ruler";

export class CanvasEngine {
  // Canvases
  private baseCanvas: HTMLCanvasElement | null = null; // Background Image (1x)
  private compositeCanvas: HTMLCanvasElement | null = null; // Final "Baked" Result (1x)
  private displayCanvas: HTMLCanvasElement | null = null; // Screen / Viewport (DPI Scaled)

  // Contexts
  private baseCtx: CanvasRenderingContext2D | null = null;
  private compositeCtx: CanvasRenderingContext2D | null = null;
  private displayCtx: CanvasRenderingContext2D | null = null;

  // State
  private isImageLoading = false;
  private _canvasSize: Size = { width: 0, height: 0 };

  // Optimization: Incremental Rendering State
  private lastRenderedIndex = -1;
  private lastRenderedGroupCount = 0;

  // NEW: Tracks strokes that should be temporarily invisible during the current drag (Instant Eraser)
  private previewHiddenStrokes: Set<AnyStroke> = new Set();

  // Dependencies
  private brushEngine: BrushEngine;
  private container: HTMLElement | null = null;

  private get dpr() {
    return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  }

  get canvasSize(): Size {
    return this._canvasSize;
  }

  constructor(brushEngine?: BrushEngine) {
    this.brushEngine = brushEngine || new BrushEngine();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  initialize(container: HTMLElement): void {
    this.container = container;

    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // 1. Internal Buffers (Match Image Resolution, 1x)
    this.baseCanvas = this.createCanvas("base-canvas", false);
    this.compositeCanvas = this.createCanvas("composite-canvas", false);

    // 2. Display Canvas (Match Screen Resolution via CSS/DPI)
    // We use absolute positioning to prevent flexbox stretching artifacts
    this.displayCanvas = document.createElement("canvas");
    this.displayCanvas.style.position = "absolute";
    this.displayCanvas.style.top = "0";
    this.displayCanvas.style.left = "0";
    this.displayCanvas.style.display = "block";
    this.displayCanvas.style.touchAction = "none"; // Disable browser gestures

    // 3. Contexts
    this.baseCtx = this.setupContext(this.baseCanvas);
    this.compositeCtx = this.setupContext(this.compositeCanvas);
    this.displayCtx = this.setupContext(this.displayCanvas);

    if (this.displayCanvas && this.container) {
      this.container.appendChild(this.displayCanvas);
    }
  }

  // ============================================================================
  // IMAGE LOADING
  // ============================================================================

  async loadImage(imageSrc: string): Promise<void> {
    if (this.isImageLoading) return;
    this.isImageLoading = true;
    this.resetIncrementalState();

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        // Resize internal buffers to match the image exactly
        this.resizeCanvases(img.width, img.height);
        this._canvasSize = { width: img.width, height: img.height };

        if (this.baseCtx && this.baseCanvas) {
          this.baseCtx.drawImage(img, 0, 0);
        }

        this.isImageLoading = false;

        // Initial composition (just the image)
        this.refreshComposite([]);
        resolve();
      };

      img.onerror = (err) => {
        this.isImageLoading = false;
        reject(err);
      };

      img.src = imageSrc;
    });
  }

  // ============================================================================
  // HISTORY REPLAY & RENDERING
  // ============================================================================

  replayStrokes(strokeHistory: StrokeHistoryState): void {
    if (!this.compositeCtx) return;

    const { groups, currentIndex } = strokeHistory;

    // 1. Detect Incremental Update (Appending 1 new group)
    const isStepForward = currentIndex === this.lastRenderedIndex + 1;
    // Sanity check: ensure history hasn't been rewritten behind our backs
    const isHistoryConsistent = groups.length >= this.lastRenderedGroupCount;

    // Note: If previewHiddenStrokes has items, we cannot use incremental rendering
    // because we might need to hide something from the past.
    const isInstantErasing = this.previewHiddenStrokes.size > 0;

    if (isStepForward && isHistoryConsistent && !isInstantErasing) {
      const newGroup = groups[currentIndex];
      // CRITICAL: We can ONLY increment if the new tool is NOT an Eraser.
      // Erasers modify the past, requiring a full redraw.
      const isEraser = newGroup?.strokes[0]?.tool === Tools.ERASER;

      if (newGroup && !isEraser) {
        // --- FAST PATH: INCREMENTAL RENDER ---
        for (const stroke of newGroup.strokes) {
          this.drawStrokeToContext(this.compositeCtx, stroke as AnyStroke);
        }

        this.lastRenderedIndex = currentIndex;
        this.lastRenderedGroupCount = groups.length;
        return;
      }
    }

    // --- SLOW PATH: FULL RENDER ---
    // Eraser, Undo, Redo, File Load, or Instant Preview -> Redraw everything
    const visibleStrokes = this.computeVisibleStrokes(groups, currentIndex);
    this.refreshComposite(visibleStrokes);

    this.lastRenderedIndex = currentIndex;
    this.lastRenderedGroupCount = groups.length;
  }

  /**
   * Clears the composite and redraws EVERYTHING from scratch.
   * Guarantees correct blending order.
   */
  private refreshComposite(strokes: AnyStroke[]): void {
    if (!this.compositeCtx || !this.compositeCanvas || !this.baseCanvas) return;

    // 1. Clear
    this.clearCanvas(this.compositeCtx);

    // 2. Draw Background Image
    this.compositeCtx.globalCompositeOperation = "source-over";
    this.compositeCtx.drawImage(this.baseCanvas, 0, 0);

    // 3. Draw Strokes Sequentially
    for (const stroke of strokes) {
      this.drawStrokeToContext(this.compositeCtx, stroke);
    }
  }

  /**
   * Helper to draw a single stroke with correct blending settings.
   */
  private drawStrokeToContext(
    ctx: CanvasRenderingContext2D,
    stroke: AnyStroke,
  ): void {
    // 1. Set Blend Mode
    // Type guard to check if config has blendMode (Eraser does not)
    if ("blendMode" in stroke.toolConfig) {
      ctx.globalCompositeOperation = stroke.toolConfig.blendMode;
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    // 2. Dispatch to Brush Engine
    switch (stroke.tool) {
      case Tools.PEN:
        this.brushEngine.drawPenStroke(
          ctx,
          stroke.points,
          stroke.toolConfig,
          stroke.color,
        );
        break;
      case Tools.HIGHLIGHTER:
        this.brushEngine.drawHighlighterStroke(
          ctx,
          stroke.points,
          stroke.toolConfig,
          stroke.color,
        );
        break;
      case Tools.AREA:
        if (stroke.points.length >= 2) {
          const start = stroke.points[0];
          const end = stroke.points[stroke.points.length - 1];
          this.brushEngine.drawArea(
            ctx,
            start,
            end,
            stroke.toolConfig,
            stroke.color,
          );
        }
        break;
    }
  }

  // ============================================================================
  // DISPLAY RENDER LOOP
  // ============================================================================

  render(
    viewState: ViewState,
    ruler: Ruler,
    containerSize: Size,
    preview?: AnyPreviewState,
  ): void {
    if (!this.displayCanvas || !this.displayCtx) return;
    if (containerSize.width === 0 || containerSize.height === 0) return;

    const dpr = this.dpr;
    const targetWidth = Math.floor(containerSize.width * dpr);
    const targetHeight = Math.floor(containerSize.height * dpr);

    // 1. Handle Resize
    // We check against physical pixels to avoid blurry upscaling
    if (
      this.displayCanvas.width !== targetWidth ||
      this.displayCanvas.height !== targetHeight
    ) {
      this.displayCanvas.width = targetWidth;
      this.displayCanvas.height = targetHeight;

      // Lock CSS size to logical pixels to prevent stretching
      this.displayCanvas.style.width = `${containerSize.width}px`;
      this.displayCanvas.style.height = `${containerSize.height}px`;

      this.setupContext(this.displayCanvas, this.displayCtx);
    }

    // 2. Clear Screen
    // Reset transform to identity before clearing to ensure full clear
    this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.displayCtx.clearRect(
      0,
      0,
      this.displayCanvas.width,
      this.displayCanvas.height,
    );

    this.displayCtx.save();
    this.displayCtx.scale(dpr, dpr);

    // 3. Viewport Transform (Pan/Zoom)
    this.displayCtx.translate(
      -viewState.viewOffset.x * viewState.zoom,
      -viewState.viewOffset.y * viewState.zoom,
    );
    this.displayCtx.scale(viewState.zoom, viewState.zoom);

    // 4. Draw Composite (The "Truth")
    if (this.compositeCanvas) {
      this.displayCtx.globalCompositeOperation = "source-over";
      // Browser handles interpolation from 1x image to Screen Resolution here
      this.displayCtx.drawImage(this.compositeCanvas, 0, 0);
    }

    // 5. Draw Preview (Active Stroke)
    if (preview) {
      this.renderPreview(preview);
    }

    this.displayCtx.restore();

    // 6. UI Overlays (Ruler)
    // Drawn in Screen Space (but scaled for DPI)
    this.displayCtx.save();
    this.displayCtx.scale(dpr, dpr);
    ruler.render(this.displayCtx, {
      width: containerSize.width,
      height: containerSize.height,
    });
    this.displayCtx.restore();
  }

  private renderPreview(preview: AnyPreviewState): void {
    if (!this.displayCtx) return;
    const ctx = this.displayCtx;

    ctx.save();

    // Ensure Preview uses same blending logic as main renderer
    if (
      "blendMode" in preview.toolConfig &&
      preview.toolConfig.blendMode === BlendModes.MULTIPLY
    ) {
      ctx.globalCompositeOperation = BlendModes.MULTIPLY;
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    if (preview.tool === Tools.AREA) {
      this.brushEngine.drawArea(
        ctx,
        preview.startPoint,
        preview.currentPoint,
        preview.toolConfig as AreaToolConfig,
        preview.color,
      );
    } else if (preview.points) {
      if (preview.tool === Tools.HIGHLIGHTER) {
        this.brushEngine.drawHighlighterStroke(
          ctx,
          preview.points,
          preview.toolConfig as HighlighterToolConfig,
          preview.color,
        );
      } else if (preview.tool === Tools.PEN) {
        this.brushEngine.drawPenStroke(
          ctx,
          preview.points,
          preview.toolConfig as PenToolConfig,
          preview.color,
        );
      }
    }

    ctx.restore();
  }

  // ============================================================================
  // ERASER LOGIC (Vector)
  // ============================================================================

  private computeVisibleStrokes(
    groups: AnyStrokeGroup[],
    maxIndex: number,
  ): AnyStroke[] {
    const activeStrokes: AnyStroke[] = [];
    for (let i = 0; i <= maxIndex; i++) {
      const group = groups[i];
      if (!group) continue;
      const firstStroke = group.strokes[0];
      if (!firstStroke) continue;

      if (firstStroke.tool === Tools.ERASER) {
        const eraserGroup = group as unknown as { strokes: Stroke<"eraser">[] };
        for (const eraserStroke of eraserGroup.strokes) {
          this.applyObjectEraser(eraserStroke, activeStrokes);
        }
      } else {
        // UPDATE: Check if this stroke is temporarily hidden by the live eraser
        for (const stroke of group.strokes) {
          if (!this.previewHiddenStrokes.has(stroke as AnyStroke)) {
            activeStrokes.push(stroke as AnyStroke);
          }
        }
      }
    }
    return activeStrokes;
  }

  private isStrokeHitByEraser(
    target: AnyStroke,
    eraserPoints: Point[],
    eraserSize: number,
  ): boolean {
    const eraserRadius = eraserSize / 2;
    // Add a tiny buffer (+1px) to make the eraser feel "forgiving"
    const hitThreshold = eraserRadius + 1;
    const hitThresholdSq = hitThreshold * hitThreshold;

    // --- CASE A: AREA TOOL (Box Check) ---
    if (target.tool === Tools.AREA && target.points.length >= 2) {
      const start = target.points[0];
      const end = target.points[target.points.length - 1];

      // Normalize bounds
      const left = Math.min(start.x, end.x);
      const right = Math.max(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const bottom = Math.max(start.y, end.y);

      // Expand box by eraser size so we hit it when touching the edge
      const p = eraserRadius;

      // Check if ANY eraser point is inside the expanded box
      for (const ep of eraserPoints) {
        if (
          ep.x >= left - p &&
          ep.x <= right + p &&
          ep.y >= top - p &&
          ep.y <= bottom + p
        ) {
          return true;
        }
      }
      return false;
    }

    // --- CASE B: STANDARD STROKES (Point Check) ---

    // 1. Fast Bounding Box Fail
    let tMinX = Infinity,
      tMaxX = -Infinity,
      tMinY = Infinity,
      tMaxY = -Infinity;
    for (const p of target.points) {
      if (p.x < tMinX) tMinX = p.x;
      if (p.x > tMaxX) tMaxX = p.x;
      if (p.y < tMinY) tMinY = p.y;
      if (p.y > tMaxY) tMaxY = p.y;
    }

    // Eraser Bounds
    let eMinX = Infinity,
      eMaxX = -Infinity,
      eMinY = Infinity,
      eMaxY = -Infinity;
    for (const p of eraserPoints) {
      if (p.x < eMinX) eMinX = p.x;
      if (p.x > eMaxX) eMaxX = p.x;
      if (p.y < eMinY) eMinY = p.y;
      if (p.y > eMaxY) eMaxY = p.y;
    }

    // Check overlap
    const padding =
      ("size" in target.toolConfig ? (target.toolConfig as any).size : 5) / 2 +
      eraserRadius;

    if (
      tMaxX + padding < eMinX ||
      tMinX - padding > eMaxX ||
      tMaxY + padding < eMinY ||
      tMinY - padding > eMaxY
    ) {
      return false;
    }

    // 2. Detailed Point-to-Point Check
    // We check stroke points against eraser points
    for (const tp of target.points) {
      for (const ep of eraserPoints) {
        const dx = tp.x - ep.x;
        const dy = tp.y - ep.y;
        if (dx * dx + dy * dy <= hitThresholdSq) {
          return true;
        }
      }
    }

    return false;
  }

  private applyObjectEraser(
    eraserStroke: Stroke<"eraser">,
    activeStrokes: AnyStroke[],
  ) {
    const eraserPoints = eraserStroke.points;
    const eraserSize = eraserStroke.toolConfig.size;

    for (let i = activeStrokes.length - 1; i >= 0; i--) {
      const target = activeStrokes[i];
      if (target.tool === Tools.ERASER) continue;

      if (this.isStrokeHitByEraser(target, eraserPoints, eraserSize)) {
        activeStrokes.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // INSTANT ERASER PREVIEW
  // ============================================================================

  /**
   * Called during PointerMove. Checks collisions against the current eraser position
   * and hides strokes instantly. Returns TRUE if something new was hidden (requires redraw).
   */
  updateEraserPreview(
    eraserPoint: Point,
    eraserSize: number,
    strokeHistory: StrokeHistoryState,
  ): boolean {
    const { groups, currentIndex } = strokeHistory;
    let didHideSomething = false;

    // We pass a single point as an array to reuse the function
    const currentEraserPoints = [eraserPoint];

    for (let i = 0; i <= currentIndex; i++) {
      const group = groups[i];
      if (!group) continue;
      if (group.strokes[0]?.tool === Tools.ERASER) continue;

      for (const stroke of group.strokes) {
        if (this.previewHiddenStrokes.has(stroke as AnyStroke)) continue;

        if (
          this.isStrokeHitByEraser(
            stroke as AnyStroke,
            currentEraserPoints,
            eraserSize,
          )
        ) {
          this.previewHiddenStrokes.add(stroke as AnyStroke);
          didHideSomething = true;
        }
      }
    }
    return didHideSomething;
  }

  clearEraserPreview(): void {
    this.previewHiddenStrokes.clear();
  }

  /**
   * Checks if an eraser path hits any existing strokes.
   * Optimized for "Early Exit" - returns true immediately on first hit.
   * Used for validating if an eraser stroke should be committed to history.
   */
  checkEraserHit(
    eraserPoints: Point[],
    eraserSize: number,
    strokeHistory: StrokeHistoryState,
  ): boolean {
    const { groups, currentIndex } = strokeHistory;

    for (let i = currentIndex; i >= 0; i--) {
      const group = groups[i];
      if (!group) continue;
      if (group.strokes[0]?.tool === Tools.ERASER) continue;

      for (const target of group.strokes) {
        // USE UNIFIED LOGIC
        if (this.isStrokeHitByEraser(target, eraserPoints, eraserSize)) {
          return true;
        }
      }
    }
    return false;
  }

  // ============================================================================
  // UTILITIES & LIFECYCLE
  // ============================================================================

  getFreshCombinedCanvas(): HTMLCanvasElement | null {
    // The composite canvas is always up to date.
    // Return a copy to ensure consumers don't dirty the internal buffer.
    if (!this.compositeCanvas) return null;

    const temp = document.createElement("canvas");
    temp.width = this.compositeCanvas.width;
    temp.height = this.compositeCanvas.height;
    const ctx = temp.getContext("2d");
    if (ctx) {
      ctx.drawImage(this.compositeCanvas, 0, 0);
    }
    return temp;
  }

  private resizeCanvases(width: number, height: number): void {
    if (this.baseCanvas) {
      this.baseCanvas.width = width;
      this.baseCanvas.height = height;
    }
    if (this.compositeCanvas) {
      this.compositeCanvas.width = width;
      this.compositeCanvas.height = height;
    }
  }

  private createCanvas(
    className: string,
    isVisible: boolean,
  ): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.className = className;
    canvas.style.display = isVisible ? "block" : "none";
    return canvas;
  }

  private setupContext(
    canvas: HTMLCanvasElement | null,
    existingCtx?: CanvasRenderingContext2D | null,
  ): CanvasRenderingContext2D | null {
    if (!canvas) return null;
    // Low Latency Optimization: desynchronized + alpha
    const ctx =
      existingCtx ||
      canvas.getContext("2d", {
        desynchronized: true,
        alpha: true,
      });

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    }
    return ctx;
  }

  private clearCanvas(ctx: CanvasRenderingContext2D | null): void {
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  private resetIncrementalState(): void {
    this.lastRenderedIndex = -1;
    this.lastRenderedGroupCount = 0;
  }

  clear(): void {
    this.clearCanvas(this.baseCtx);
    this.clearCanvas(this.compositeCtx);
    // Reset display with transform identity
    if (this.displayCtx) {
      this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.clearCanvas(this.displayCtx);
    }
    this._canvasSize = { width: 0, height: 0 };
    this.resetIncrementalState();
    this.previewHiddenStrokes.clear();
  }

  destroy(): void {
    this.clear();
    if (this.displayCanvas && this.displayCanvas.parentNode) {
      this.displayCanvas.parentNode.removeChild(this.displayCanvas);
    }
    this.baseCanvas = null;
    this.compositeCanvas = null;
    this.displayCanvas = null;
    this.container = null;
  }
}
