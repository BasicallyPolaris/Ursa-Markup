import {
  type AnyPreviewState,
  type AnyStroke,
  type AnyStrokeGroup,
  type Size,
  type Stroke,
  type StrokeHistoryState,
  type ViewState,
} from "~/types";

import { BlendModes, Tools } from "~/types/tools";
import { BrushEngine } from "./BrushEngine";
import { Ruler } from "./Ruler";

/**
 * CanvasEngine manages the multi-layer canvas system.
 */
export class CanvasEngine {
  // Canvas elements
  private baseCanvas: HTMLCanvasElement | null = null;
  private drawCanvas: HTMLCanvasElement | null = null;
  private multiplyCanvas: HTMLCanvasElement | null = null;
  private compositeCanvas: HTMLCanvasElement | null = null;
  private displayCanvas: HTMLCanvasElement | null = null;

  // Contexts
  private baseCtx: CanvasRenderingContext2D | null = null;
  private drawCtx: CanvasRenderingContext2D | null = null;
  private multiplyCtx: CanvasRenderingContext2D | null = null;
  private compositeCtx: CanvasRenderingContext2D | null = null;
  private displayCtx: CanvasRenderingContext2D | null = null;

  // State
  private isImageLoading = false;
  private _canvasSize: Size = { width: 0, height: 0 };

  // Optimization: Incremental Rendering State
  private lastRenderedIndex = -1;
  private lastRenderedGroupCount = 0;

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

  // --- Initialization ---

  initialize(container: HTMLElement): void {
    this.container = container;

    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // Internal canvases (Buffer layers) - These match image resolution (1x)
    this.baseCanvas = this.createCanvas("base-canvas", false);
    this.drawCanvas = this.createCanvas("draw-canvas", false);
    this.multiplyCanvas = this.createCanvas("multiply-canvas", false);
    this.compositeCanvas = this.createCanvas("composite-canvas", false);

    // Display canvas - This matches Screen resolution (DPR scaled)
    this.displayCanvas = document.createElement("canvas");
    this.displayCanvas.style.position = "absolute";
    this.displayCanvas.style.top = "0";
    this.displayCanvas.style.left = "0";
    this.displayCanvas.style.display = "block";
    this.displayCanvas.style.touchAction = "none";

    this.baseCtx = this.setupContext(this.baseCanvas);
    this.drawCtx = this.setupContext(this.drawCanvas);
    this.multiplyCtx = this.setupContext(this.multiplyCanvas);
    this.compositeCtx = this.setupContext(this.compositeCanvas);
    this.displayCtx = this.setupContext(this.displayCanvas);

    if (this.displayCanvas && this.container) {
      this.container.appendChild(this.displayCanvas);
    }
  }

  // --- Image Loading ---

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

        this.clearCanvas(this.drawCtx);
        this.clearCanvas(this.multiplyCtx);
        this.isImageLoading = false;

        this.updateComposite();
        resolve();
      };

      img.onerror = (err) => {
        this.isImageLoading = false;
        reject(err);
      };

      img.src = imageSrc;
    });
  }

  // --- Rendering Lifecycle ---

  replayStrokes(strokeHistory: StrokeHistoryState): void {
    if (!this.drawCtx || !this.multiplyCtx) return;

    const { groups, currentIndex } = strokeHistory;

    const isIncrementalAdd =
      currentIndex === this.lastRenderedIndex + 1 &&
      groups.length === this.lastRenderedGroupCount + 1 &&
      this.lastRenderedIndex >= -1;

    if (isIncrementalAdd) {
      const newGroup = groups[currentIndex];
      const firstStroke = newGroup?.strokes[0];
      const isEraser = firstStroke?.tool === Tools.ERASER;

      if (newGroup && !isEraser) {
        for (const stroke of newGroup.strokes) {
          this.replayStroke(stroke as AnyStroke);
        }
        this.lastRenderedIndex = currentIndex;
        this.lastRenderedGroupCount = groups.length;
        this.updateComposite();
        return;
      }
    }

    // Full Replay
    this.clearCanvas(this.drawCtx);
    this.clearCanvas(this.multiplyCtx);

    const visibleStrokes = this.computeVisibleStrokes(groups, currentIndex);

    for (const stroke of visibleStrokes) {
      this.replayStroke(stroke);
    }

    this.lastRenderedIndex = currentIndex;
    this.lastRenderedGroupCount = groups.length;
    this.updateComposite();
  }

  private replayStroke(stroke: AnyStroke): void {
    const isMultiply =
      "blendMode" in stroke.toolConfig &&
      stroke.toolConfig.blendMode === BlendModes.MULTIPLY;

    const ctx = isMultiply ? this.multiplyCtx : this.drawCtx;
    if (!ctx) return;

    ctx.globalCompositeOperation = "source-over";

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
          try {
            this.applyObjectEraser(eraserStroke, activeStrokes);
          } catch (err) {
            console.error("Eraser calculation failed", err);
          }
        }
      } else {
        for (const stroke of group.strokes) {
          activeStrokes.push(stroke as AnyStroke);
        }
      }
    }
    return activeStrokes;
  }

  private applyObjectEraser(
    eraserStroke: Stroke<"eraser">,
    activeStrokes: AnyStroke[],
  ) {
    const eraserSize = eraserStroke.toolConfig.size;
    const eraserPoints = eraserStroke.points;

    // Simple bounding box check first for performance
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

    for (let i = activeStrokes.length - 1; i >= 0; i--) {
      const target = activeStrokes[i];
      if (target.tool === Tools.ERASER) continue;

      const tPoints = target.points;

      // Target bounding box
      let tMinX = Infinity,
        tMaxX = -Infinity,
        tMinY = Infinity,
        tMaxY = -Infinity;
      for (const p of tPoints) {
        if (p.x < tMinX) tMinX = p.x;
        if (p.x > tMaxX) tMaxX = p.x;
        if (p.y < tMinY) tMinY = p.y;
        if (p.y > tMaxY) tMaxY = p.y;
      }

      let targetSize = 0;
      if ("size" in target.toolConfig) {
        targetSize = target.toolConfig.size;
      }

      const padding = targetSize / 2 + eraserSize / 2;

      // Fast AABB Check
      if (
        tMaxX < eMinX - padding ||
        tMinX > eMaxX + padding ||
        tMaxY < eMinY - padding ||
        tMinY > eMaxY + padding
      ) {
        continue;
      }

      // Detailed intersection check
      let shouldRemove = false;
      const thresholdSq = padding * padding;

      outerLoop: for (const tp of tPoints) {
        for (const ep of eraserPoints) {
          const dx = tp.x - ep.x;
          const dy = tp.y - ep.y;
          if (dx * dx + dy * dy <= thresholdSq) {
            shouldRemove = true;
            break outerLoop;
          }
        }
      }

      if (shouldRemove) {
        activeStrokes.splice(i, 1);
      }
    }
  }

  // --- Compositing & View ---

  private updateComposite(): void {
    if (!this.compositeCtx || !this.compositeCanvas || !this.baseCanvas) return;

    this.clearCanvas(this.compositeCtx);
    // Draw Base Image
    this.compositeCtx.drawImage(this.baseCanvas, 0, 0);

    // Draw Multiply Layer
    if (this.multiplyCanvas) {
      this.compositeCtx.globalCompositeOperation = "multiply";
      this.compositeCtx.drawImage(this.multiplyCanvas, 0, 0);
      this.compositeCtx.globalCompositeOperation = "source-over";
    }

    // Draw Normal Layer
    if (this.drawCanvas) {
      this.compositeCtx.drawImage(this.drawCanvas, 0, 0);
    }
  }

  /**
   * Main Render Method - optimized to not touch DOM
   * @param containerSize The size of the container in CSS pixels
   */
  render(
    viewState: ViewState,
    ruler: Ruler,
    containerSize: Size,
    preview?: AnyPreviewState,
  ): void {
    if (!this.displayCanvas || !this.displayCtx) return;

    // Safety check: Don't render if container is collapsed
    if (containerSize.width === 0 || containerSize.height === 0) return;

    const dpr = this.dpr;
    const targetWidth = Math.floor(containerSize.width * dpr);
    const targetHeight = Math.floor(containerSize.height * dpr);

    // 1. Handle Canvas Resizing (Physical Pixels)
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

    // 2. Clear Screen
    // Reset transform before clearing to ensure full clear
    this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.displayCtx.clearRect(
      0,
      0,
      this.displayCanvas.width,
      this.displayCanvas.height,
    );

    this.displayCtx.save();

    // 3. Apply DPI Scaling
    this.displayCtx.scale(dpr, dpr);

    // 4. Apply Viewport Transform (Zoom/Pan)
    this.displayCtx.translate(
      -viewState.viewOffset.x * viewState.zoom,
      -viewState.viewOffset.y * viewState.zoom,
    );
    this.displayCtx.scale(viewState.zoom, viewState.zoom);

    // 5. Draw the "Paper" (Composite Canvas - 1x Resolution)
    if (this.compositeCanvas) {
      this.displayCtx.drawImage(this.compositeCanvas, 0, 0);
    }

    // 6. Draw Preview Stroke (Active)
    if (preview) {
      this.renderPreview(preview);
    }

    this.displayCtx.restore();

    // 7. Draw Ruler (Screen Space Overlay)
    // We scale by DPR so the Ruler drawing logic works in CSS pixels
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

    if ("blendMode" in preview.toolConfig) {
      ctx.globalCompositeOperation = preview.toolConfig.blendMode;
    }

    switch (preview.tool) {
      case Tools.PEN:
        if (!preview.points) break;
        this.brushEngine.drawPenStroke(
          ctx,
          preview.points,
          preview.toolConfig,
          preview.color,
        );
        break;
      case Tools.HIGHLIGHTER:
        if (!preview.points) break;
        this.brushEngine.drawHighlighterStroke(
          ctx,
          preview.points,
          preview.toolConfig,
          preview.color,
        );
        break;
      case Tools.AREA:
        const { startPoint, currentPoint } = preview;
        this.brushEngine.drawArea(
          ctx,
          startPoint,
          currentPoint,
          preview.toolConfig,
          preview.color,
        );
        break;
      default:
        break;
    }

    ctx.restore();
  }

  // --- Utilities ---

  clear(): void {
    this.clearCanvas(this.baseCtx);
    this.clearCanvas(this.drawCtx);
    this.clearCanvas(this.multiplyCtx);
    this.clearCanvas(this.compositeCtx);

    // Clear display with reset transform
    if (this.displayCtx) {
      this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.clearCanvas(this.displayCtx);
    }

    this._canvasSize = { width: 0, height: 0 };
    this.resetIncrementalState();
  }

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
    this.container = null;
  }

  getFreshCombinedCanvas(): HTMLCanvasElement | null {
    if (!this.baseCanvas || !this.drawCanvas || !this.multiplyCanvas)
      return null;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.baseCanvas.width;
    tempCanvas.height = this.baseCanvas.height;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(this.baseCanvas, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(this.multiplyCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.drawCanvas, 0, 0);

    return tempCanvas;
  }

  private resizeCanvases(width: number, height: number): void {
    const canvases = [
      this.baseCanvas,
      this.drawCanvas,
      this.multiplyCanvas,
      this.compositeCanvas,
    ];

    canvases.forEach((canvas) => {
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
    });
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
    const ctx = existingCtx || canvas.getContext("2d");
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
}
