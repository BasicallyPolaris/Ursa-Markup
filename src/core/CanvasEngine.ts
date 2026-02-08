import {
  Point,
  StrokeGroup,
  type AnyPreviewState,
  type AnyStroke,
  type AnyStrokeGroup,
  type Size,
  type Stroke,
  type StrokeHistoryState,
  type ViewState,
} from "~/types";

import { Tools } from "~/types/tools";

import { distanceToSegmentSquared } from "~/utils/canvas";
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

  // Cache of strokes currently visible in the history (excluding previously erased ones)
  private _visibleStrokes: AnyStroke[] = [];

  // Tracks strokes temporarily hidden during an active eraser drag
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

    // 1. Internal Buffers (1x)
    this.baseCanvas = this.createCanvas("base-canvas", false);
    this.compositeCanvas = this.createCanvas("composite-canvas", false);

    // 2. Display Canvas (DPI Scaled)
    this.displayCanvas = document.createElement("canvas");
    this.displayCanvas.style.position = "absolute";
    this.displayCanvas.style.top = "0";
    this.displayCanvas.style.left = "0";
    this.displayCanvas.style.display = "block";
    this.displayCanvas.style.touchAction = "none";

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
        this.resizeCanvases(img.width, img.height);
        this._canvasSize = { width: img.width, height: img.height };

        if (this.baseCtx && this.baseCanvas) {
          this.baseCtx.drawImage(img, 0, 0);
        }

        this.isImageLoading = false;
        this._visibleStrokes = [];
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

    const isStepForward = currentIndex === this.lastRenderedIndex + 1;
    const isHistoryConsistent = groups.length >= this.lastRenderedGroupCount;
    // If we have hidden strokes, force full redraw to ensure state consistency
    const isInstantErasing = this.previewHiddenStrokes.size > 0;

    if (isStepForward && isHistoryConsistent && !isInstantErasing) {
      const newGroup = groups[currentIndex];
      const isEraser = newGroup?.strokes[0]?.tool === Tools.ERASER;

      if (newGroup && !isEraser) {
        // --- FAST PATH ---
        for (const stroke of newGroup.strokes) {
          this.drawStrokeToContext(this.compositeCtx, stroke as AnyStroke);
          this._visibleStrokes.push(stroke as AnyStroke);
        }

        this.lastRenderedIndex = currentIndex;
        this.lastRenderedGroupCount = groups.length;
        return;
      }
    }

    // --- SLOW PATH: FULL RENDER ---
    const visibleStrokes = this.computeVisibleStrokes(groups, currentIndex);
    this._visibleStrokes = visibleStrokes; // Update cache

    this.refreshComposite(visibleStrokes);

    this.lastRenderedIndex = currentIndex;
    this.lastRenderedGroupCount = groups.length;
  }

  /**
   * Clears the composite and redraws EVERYTHING from scratch.
   * Respects previewHiddenStrokes to visually remove items during erase drag.
   */
  private refreshComposite(strokes: AnyStroke[]): void {
    if (!this.compositeCtx || !this.compositeCanvas || !this.baseCanvas) return;

    this.clearCanvas(this.compositeCtx);

    this.compositeCtx.globalCompositeOperation = "source-over";
    this.compositeCtx.drawImage(this.baseCanvas, 0, 0);

    for (const stroke of strokes) {
      // VISUAL UPDATE FIX: Skip strokes that are currently "preview hidden"
      if (this.previewHiddenStrokes.has(stroke)) continue;

      this.drawStrokeToContext(this.compositeCtx, stroke);
    }
  }

  private drawStrokeToContext(
    ctx: CanvasRenderingContext2D,
    stroke: AnyStroke,
  ): void {
    if ("blendMode" in stroke.toolConfig) {
      ctx.globalCompositeOperation = stroke.toolConfig.blendMode;
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

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

    if (
      this.displayCanvas.width !== targetWidth ||
      this.displayCanvas.height !== targetHeight
    ) {
      this.displayCanvas.width = targetWidth;
      this.displayCanvas.height = targetHeight;
      this.displayCanvas.style.width = `${containerSize.width}px`;
      this.displayCanvas.style.height = `${containerSize.height}px`;
      this.setupContext(this.displayCanvas, this.displayCtx);
    }

    this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.displayCtx.clearRect(
      0,
      0,
      this.displayCanvas.width,
      this.displayCanvas.height,
    );

    this.displayCtx.save();
    this.displayCtx.scale(dpr, dpr);

    this.displayCtx.translate(
      -viewState.viewOffset.x * viewState.zoom,
      -viewState.viewOffset.y * viewState.zoom,
    );
    this.displayCtx.scale(viewState.zoom, viewState.zoom);

    if (this.compositeCanvas) {
      this.displayCtx.globalCompositeOperation = "source-over";
      this.displayCtx.drawImage(this.compositeCanvas, 0, 0);
    }

    if (preview) {
      this.renderPreview(preview);
    }

    this.displayCtx.restore();

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
    ctx.globalCompositeOperation = preview.toolConfig.blendMode;

    if (preview.tool === Tools.AREA) {
      this.brushEngine.drawArea(
        ctx,
        preview.startPoint,
        preview.currentPoint,
        preview.toolConfig,
        preview.color,
      );
    } else if (preview.points) {
      if (preview.tool === Tools.HIGHLIGHTER) {
        this.brushEngine.drawHighlighterStroke(
          ctx,
          preview.points,
          preview.toolConfig,
          preview.color,
        );
      } else if (preview.tool === Tools.PEN) {
        this.brushEngine.drawPenStroke(
          ctx,
          preview.points,
          preview.toolConfig,
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
        const eraserGroup = group as StrokeGroup<"eraser">;
        for (const eraserStroke of eraserGroup.strokes) {
          this.applyObjectEraser(eraserStroke, activeStrokes);
        }
      } else {
        // For history replay, we consider all strokes valid.
        // The render loop/refreshComposite handles temporary hiding.
        for (const stroke of group.strokes) {
          activeStrokes.push(stroke as AnyStroke);
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
    const hitThreshold = eraserRadius + 2;
    const hitThresholdSq = hitThreshold * hitThreshold;

    if (target.tool === Tools.AREA && target.points.length >= 2) {
      const start = target.points[0];
      const end = target.points[target.points.length - 1];
      const left = Math.min(start.x, end.x);
      const right = Math.max(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const bottom = Math.max(start.y, end.y);
      const p = eraserRadius;

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

    const padding =
      "size" in target.toolConfig
        ? target.toolConfig.size
        : 5 / 2 + eraserRadius;

    if (
      tMaxX + padding < eMinX ||
      tMinX - padding > eMaxX ||
      tMaxY + padding < eMinY ||
      tMinY - padding > eMaxY
    ) {
      return false;
    }

    const strokePoints = target.points;
    if (strokePoints.length < 2) {
      const p = strokePoints[0];
      for (const ep of eraserPoints) {
        const dx = p.x - ep.x;
        const dy = p.y - ep.y;
        if (dx * dx + dy * dy <= hitThresholdSq) return true;
      }
      return false;
    }

    for (let i = 0; i < strokePoints.length - 1; i++) {
      const p1 = strokePoints[i];
      const p2 = strokePoints[i + 1];
      for (const ep of eraserPoints) {
        if (distanceToSegmentSquared(ep, p1, p2) <= hitThresholdSq) {
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

  updateEraserPreview(eraserPoint: Point, eraserSize: number): boolean {
    let didHideSomething = false;
    const currentEraserPoints = [eraserPoint];

    // Check against currently visible strokes
    for (const stroke of this._visibleStrokes) {
      if (this.previewHiddenStrokes.has(stroke)) continue;

      if (this.isStrokeHitByEraser(stroke, currentEraserPoints, eraserSize)) {
        this.previewHiddenStrokes.add(stroke);
        didHideSomething = true;
      }
    }

    // VISUAL UPDATE FIX: If we hid something, we MUST update the composite canvas
    // immediately so the render loop draws the updated state.
    if (didHideSomething) {
      this.refreshComposite(this._visibleStrokes);
    }

    return didHideSomething;
  }

  clearEraserPreview(): void {
    const hadHiddenStrokes = this.previewHiddenStrokes.size > 0;
    this.previewHiddenStrokes.clear();

    // If we aborted the eraser (moved mouse up without commit), restore visual state.
    if (hadHiddenStrokes) {
      this.refreshComposite(this._visibleStrokes);
    }
  }

  hasEraserChangedAnything(): boolean {
    return this.previewHiddenStrokes.size > 0;
  }

  // ============================================================================
  // UTILITIES & LIFECYCLE
  // ============================================================================

  getFreshCombinedCanvas(): HTMLCanvasElement | null {
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
    if (this.displayCtx) {
      this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.clearCanvas(this.displayCtx);
    }
    this._canvasSize = { width: 0, height: 0 };
    this.resetIncrementalState();
    this.previewHiddenStrokes.clear();
    this._visibleStrokes = [];
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
