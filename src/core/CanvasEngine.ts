import {
  type AnyPreviewState,
  type AnyStroke,
  type AnyStrokeGroup,
  type Point,
  type Size,
  type Stroke,
  type StrokeHistoryState,
  type ViewState,
} from "~/types";

import { BlendModes, EraseModes, Tools } from "~/types/tools";
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

    this.baseCanvas = this.createCanvas("base-canvas", false);
    this.drawCanvas = this.createCanvas("draw-canvas", false);
    this.multiplyCanvas = this.createCanvas("multiply-canvas", false);
    this.compositeCanvas = this.createCanvas("composite-canvas", false);
    this.displayCanvas = this.createCanvas("display-canvas", true);

    this.baseCtx = this.setupContext(this.baseCanvas);
    this.drawCtx = this.setupContext(this.drawCanvas);
    this.multiplyCtx = this.setupContext(this.multiplyCanvas);
    this.compositeCtx = this.setupContext(this.compositeCanvas);
    this.displayCtx = this.setupContext(this.displayCanvas);

    if (this.displayCanvas && this.container) {
      this.displayCanvas.style.width = "100%";
      this.displayCanvas.style.height = "100%";
      this.displayCanvas.style.display = "block";
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
    const mode = eraserStroke.toolConfig.eraserMode;
    const eraserPoints = eraserStroke.points;

    const eXs = eraserPoints.map((p) => p.x);
    const eYs = eraserPoints.map((p) => p.y);
    const eMinX = Math.min(...eXs);
    const eMaxX = Math.max(...eXs);
    const eMinY = Math.min(...eYs);
    const eMaxY = Math.max(...eYs);

    for (let i = activeStrokes.length - 1; i >= 0; i--) {
      const target = activeStrokes[i];
      if (target.tool === Tools.ERASER) continue;

      const tPoints = target.points;
      const tXs = tPoints.map((p) => p.x);
      const tYs = tPoints.map((p) => p.y);
      const tMinX = Math.min(...tXs);
      const tMaxX = Math.max(...tXs);
      const tMinY = Math.min(...tYs);
      const tMaxY = Math.max(...tYs);

      let targetSize = 0;
      if ("size" in target.toolConfig) {
        targetSize = target.toolConfig.size;
      }

      const padding = targetSize / 2 + eraserSize / 2;

      if (
        tMaxX < eMinX - padding ||
        tMinX > eMaxX + padding ||
        tMaxY < eMinY - padding ||
        tMinY > eMaxY + padding
      ) {
        continue;
      }

      let shouldRemove = false;

      if (mode === EraseModes.CONTAINED) {
        if (
          tMinX >= eMinX &&
          tMaxX <= eMaxX &&
          tMinY >= eMinY &&
          tMaxY <= eMaxY
        ) {
          shouldRemove = true;
        }
      } else {
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
    this.compositeCtx.drawImage(this.baseCanvas, 0, 0);

    if (this.multiplyCanvas) {
      this.compositeCtx.globalCompositeOperation = "multiply";
      this.compositeCtx.drawImage(this.multiplyCanvas, 0, 0);
      this.compositeCtx.globalCompositeOperation = "source-over";
    }

    if (this.drawCanvas) {
      this.compositeCtx.drawImage(this.drawCanvas, 0, 0);
    }
  }

  render(viewState: ViewState, ruler: Ruler, preview?: AnyPreviewState): void {
    if (!this.displayCanvas || !this.displayCtx || !this.container) return;
    if (this._canvasSize.width === 0) return;

    const rect = this.container.getBoundingClientRect();
    if (
      this.displayCanvas.width !== rect.width ||
      this.displayCanvas.height !== rect.height
    ) {
      this.displayCanvas.width = rect.width;
      this.displayCanvas.height = rect.height;
      this.setupContext(this.displayCanvas, this.displayCtx);
    }

    this.clearCanvas(this.displayCtx);

    this.displayCtx.save();
    this.displayCtx.translate(
      -viewState.viewOffset.x * viewState.zoom,
      -viewState.viewOffset.y * viewState.zoom,
    );
    this.displayCtx.scale(viewState.zoom, viewState.zoom);

    if (this.compositeCanvas) {
      this.displayCtx.drawImage(this.compositeCanvas, 0, 0);
    }

    if (preview) {
      this.renderPreview(preview);
    }

    this.displayCtx.restore();

    ruler.render(this.displayCtx, {
      width: this.displayCanvas.width,
      height: this.displayCanvas.height,
    });
  }

  /**
   * Render a preview of the current stroke
   */
  private renderPreview(preview: AnyPreviewState): void {
    if (!this.displayCtx) return;
    const ctx = this.displayCtx;

    ctx.save();

    if (
      "blendMode" in preview.toolConfig &&
      preview.toolConfig.blendMode === BlendModes.MULTIPLY
    ) {
      ctx.globalCompositeOperation = BlendModes.MULTIPLY;
    }

    if (preview.tool === Tools.AREA) {
      const { startPoint, currentPoint } = preview;
      this.brushEngine.drawArea(
        ctx,
        startPoint,
        currentPoint,
        preview.toolConfig,
        preview.color,
      );
    } else if (
      (preview.tool === Tools.PEN || preview.tool === Tools.HIGHLIGHTER) &&
      preview.points
    ) {
      if (preview.tool === Tools.HIGHLIGHTER) {
        this.brushEngine.drawHighlighterStroke(
          ctx,
          preview.points,
          preview.toolConfig,
          preview.color,
        );
      } else {
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

  // --- Utilities ---

  clear(): void {
    this.clearCanvas(this.baseCtx);
    this.clearCanvas(this.drawCtx);
    this.clearCanvas(this.multiplyCtx);
    this.clearCanvas(this.compositeCtx);
    this.clearCanvas(this.displayCtx);

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
}
