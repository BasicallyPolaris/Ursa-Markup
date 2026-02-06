import type {
  Point,
  Size,
  RulerState,
  RulerSnapInfo,
  ViewState,
} from "../types";
import { toRgbaString } from "../lib/theme";

/**
 * Ruler height in pixels (constant screen size)
 */
const RULER_HEIGHT = 60;

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
 * Convert CSS variable color to rgba string for canvas
 */
function getRulerColor(varName: string, alpha: number = 1): string {
  const colorValue = getCssVar(varName);
  try {
    return toRgbaString(colorValue, alpha);
  } catch {
    return `rgba(128, 128, 128, ${alpha})`;
  }
}

/**
 * Distance in pixels for ruler snapping (in canvas coords)
 */
const SNAP_DISTANCE = 50;

/**
 * Ruler manages ruler state, geometry, and interactions
 * Position (x, y) is stored in SCREEN coordinates (relative to canvas container)
 * This ensures the ruler maintains constant screen size regardless of zoom/pan
 */
export class Ruler {
  visible = false;
  // Position in screen coordinates (relative to canvas container)
  x = 400;
  y = 300;
  angle = 0;
  isDragging = false;

  // Drag state (transient, not serialized)
  private dragStartPoint: Point | null = null;
  private rulerStartPosition: Point | null = null;

  /**
   * Toggle ruler visibility
   */
  toggle(): void {
    this.visible = !this.visible;
  }

  /**
   * Show the ruler at a specific screen position
   */
  show(screenX?: number, screenY?: number): void {
    this.visible = true;
    if (screenX !== undefined && screenY !== undefined) {
      this.x = screenX;
      this.y = screenY;
    }
  }

  /**
   * Hide the ruler
   */
  hide(): void {
    this.visible = false;
  }

  /**
   * Center the ruler on a given screen size
   */
  centerOnScreen(screenWidth: number, screenHeight: number): void {
    this.x = screenWidth / 2;
    this.y = screenHeight / 2;
  }

  /**
   * Rotate the ruler by a delta angle
   */
  rotate(delta: number): void {
    this.angle = (this.angle + delta) % 360;
  }

  /**
   * Set the ruler angle directly
   */
  setAngle(angle: number): void {
    this.angle = angle % 360;
  }

  /**
   * Start dragging the ruler (screenPoint is in screen coordinates)
   */
  startDrag(screenPoint: Point): void {
    this.dragStartPoint = screenPoint;
    this.rulerStartPosition = { x: this.x, y: this.y };
    this.isDragging = true;
  }

  /**
   * Drag the ruler to a new screen point
   */
  dragTo(screenPoint: Point): void {
    if (!this.isDragging || !this.dragStartPoint || !this.rulerStartPosition) {
      return;
    }

    const dx = screenPoint.x - this.dragStartPoint.x;
    const dy = screenPoint.y - this.dragStartPoint.y;

    this.x = this.rulerStartPosition.x + dx;
    this.y = this.rulerStartPosition.y + dy;
  }

  /**
   * End dragging the ruler
   */
  endDrag(): void {
    this.dragStartPoint = null;
    this.rulerStartPosition = null;
    this.isDragging = false;
  }

  /**
   * Convert a screen point to canvas coordinates
   */
  private screenToCanvas(screenPoint: Point, viewState: ViewState): Point {
    return {
      x: screenPoint.x / viewState.zoom + viewState.viewOffset.x,
      y: screenPoint.y / viewState.zoom + viewState.viewOffset.y,
    };
  }

  /**
   * Get the ruler's center position in canvas coordinates
   */
  getCanvasPosition(viewState: ViewState): Point {
    return this.screenToCanvas({ x: this.x, y: this.y }, viewState);
  }

  /**
   * Get snapping information for a point relative to the ruler
   * @param canvasPoint - Point in canvas coordinates (where the stroke is)
   * @param viewState - Current view state for coordinate conversion
   */
  getSnapInfo(canvasPoint: Point, viewState: ViewState): RulerSnapInfo {
    if (!this.visible) {
      return {
        distance: Infinity,
        snapToFarSide: false,
        inStickyZone: false,
        onRuler: false,
      };
    }

    // Get ruler position in canvas coordinates
    const rulerCanvasPos = this.getCanvasPosition(viewState);

    // Calculate ruler height in canvas coordinates (it's constant in screen space)
    const rulerHeightCanvas = RULER_HEIGHT / viewState.zoom;

    const angleRad = (this.angle * Math.PI) / 180;
    const dx = canvasPoint.x - rulerCanvasPos.x;
    const dy = canvasPoint.y - rulerCanvasPos.y;

    const perpDist = dx * Math.sin(angleRad) - dy * Math.cos(angleRad);
    const parallelDist = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);

    // Use a very large ruler length for "infinite" ruler
    const rulerLength = 100000;
    const onRuler = Math.abs(parallelDist) <= rulerLength / 2;

    const distToTopEdge = perpDist - -rulerHeightCanvas / 2;
    const distToBottomEdge = perpDist - rulerHeightCanvas / 2;

    const absDistToTop = Math.abs(distToTopEdge);
    const absDistToBottom = Math.abs(distToBottomEdge);

    // Snap distance in canvas coordinates
    const snapDistanceCanvas = SNAP_DISTANCE / viewState.zoom;

    if (absDistToTop < absDistToBottom) {
      const inStickyZone = absDistToTop < snapDistanceCanvas;
      return {
        distance: absDistToTop,
        snapToFarSide: true,
        inStickyZone,
        onRuler,
      };
    } else {
      const inStickyZone = absDistToBottom < snapDistanceCanvas;
      return {
        distance: absDistToBottom,
        snapToFarSide: false,
        inStickyZone,
        onRuler,
      };
    }
  }

  /**
   * Check if a screen point is on the ruler (for clicking to drag)
   * @param screenPoint - Point in screen coordinates
   * @param screenSize - Size of the screen/container
   */
  isPointOnRuler(screenPoint: Point, screenSize: Size): boolean {
    if (!this.visible) return false;

    const dx = screenPoint.x - this.x;
    const dy = screenPoint.y - this.y;

    // Rotate the point by -angle to transform into ruler's local coordinate system
    const angleRad = (this.angle * Math.PI) / 180;
    const rotatedX = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);
    const rotatedY = -dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    // Use a very long ruler (extends to screen edges and beyond)
    const rulerLength =
      Math.sqrt(screenSize.width ** 2 + screenSize.height ** 2) * 3;

    return (
      Math.abs(rotatedX) <= rulerLength / 2 &&
      Math.abs(rotatedY) <= RULER_HEIGHT / 2
    );
  }

  /**
   * Snap a canvas point to the ruler edge
   * @param canvasPoint - Point in canvas coordinates
   * @param brushSize - Brush size for offset calculation
   * @param snapToFarSide - Which side of the ruler to snap to
   * @param viewState - Current view state for coordinate conversion
   */
  snapPoint(
    canvasPoint: Point,
    brushSize: number,
    snapToFarSide: boolean,
    viewState: ViewState,
  ): Point {
    if (!this.visible) return canvasPoint;

    // Get ruler position in canvas coordinates
    const rulerCanvasPos = this.getCanvasPosition(viewState);

    // Calculate ruler height in canvas coordinates
    const rulerHeightCanvas = RULER_HEIGHT / viewState.zoom;

    const angleRad = (this.angle * Math.PI) / 180;
    const dx = canvasPoint.x - rulerCanvasPos.x;
    const dy = canvasPoint.y - rulerCanvasPos.y;

    const distAlong = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);

    const highlighterHeight = brushSize;
    const highlighterWidth = brushSize * 0.3;
    const perpExtent =
      Math.abs(Math.cos(angleRad)) * (highlighterHeight / 2) +
      Math.abs(Math.sin(angleRad)) * (highlighterWidth / 2);

    const edgeOffset = snapToFarSide
      ? -rulerHeightCanvas / 2 - perpExtent
      : rulerHeightCanvas / 2 + perpExtent;

    return {
      x:
        rulerCanvasPos.x +
        distAlong * Math.cos(angleRad) +
        edgeOffset * Math.sin(angleRad),
      y:
        rulerCanvasPos.y +
        distAlong * Math.sin(angleRad) -
        edgeOffset * Math.cos(angleRad),
    };
  }

  /**
   * Snap a point directly to the ruler edge (for area tool rectangles)
   * Unlike snapPoint(), this doesn't apply brush size offset - it snaps the point itself to the edge
   * @param canvasPoint - Point in canvas coordinates
   * @param snapToFarSide - Which side of the ruler to snap to
   * @param viewState - Current view state for coordinate conversion
   */
  snapPointToEdge(
    canvasPoint: Point,
    snapToFarSide: boolean,
    viewState: ViewState,
  ): Point {
    if (!this.visible) return canvasPoint;

    // Get ruler position in canvas coordinates
    const rulerCanvasPos = this.getCanvasPosition(viewState);

    // Calculate ruler height in canvas coordinates
    const rulerHeightCanvas = RULER_HEIGHT / viewState.zoom;

    const angleRad = (this.angle * Math.PI) / 180;
    const dx = canvasPoint.x - rulerCanvasPos.x;
    const dy = canvasPoint.y - rulerCanvasPos.y;

    // Distance along the ruler (parallel to ruler)
    const distAlong = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);

    // Snap directly to the ruler edge (no brush offset)
    const edgeOffset = snapToFarSide
      ? -rulerHeightCanvas / 2
      : rulerHeightCanvas / 2;

    return {
      x:
        rulerCanvasPos.x +
        distAlong * Math.cos(angleRad) +
        edgeOffset * Math.sin(angleRad),
      y:
        rulerCanvasPos.y +
        distAlong * Math.sin(angleRad) -
        edgeOffset * Math.cos(angleRad),
    };
  }

  /**
   * Render the ruler to a canvas context
   * Ruler is rendered in screen space (constant size regardless of zoom)
   * @param ctx - Display canvas context (after view transform is removed)
   * @param screenSize - Size of the screen/container for ruler length calculation
   */
  render(ctx: CanvasRenderingContext2D, screenSize: Size): void {
    if (!this.visible) return;

    // Safety check for valid position
    if (
      !Number.isFinite(this.x) ||
      !Number.isFinite(this.y) ||
      !Number.isFinite(this.angle)
    ) {
      console.error("Invalid ruler values:", this);
      return;
    }

    // Safety check for valid screen dimensions
    if (screenSize.width <= 0 || screenSize.height <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.angle * Math.PI) / 180);

    // Ruler length based on screen diagonal (extends beyond edges)
    const diagonal = Math.sqrt(screenSize.width ** 2 + screenSize.height ** 2);
    const rulerLength = diagonal * 3;
    const rulerHeight = RULER_HEIGHT;

    if (rulerLength <= 0 || rulerHeight <= 0) {
      ctx.restore();
      return;
    }

    // Draw ruler background
    ctx.fillStyle = getRulerColor("--ruler-bg", 0.9);
    ctx.fillRect(-rulerLength / 2, -rulerHeight / 2, rulerLength, rulerHeight);

    // Draw border (constant 2px width)
    ctx.strokeStyle = getRulerColor("--ruler-border", 1);
    ctx.lineWidth = 2;
    ctx.strokeRect(
      -rulerLength / 2,
      -rulerHeight / 2,
      rulerLength,
      rulerHeight,
    );

    // Draw tick marks
    ctx.strokeStyle = getRulerColor("--ruler-tick", 1);
    ctx.lineWidth = 1.5;
    ctx.beginPath();

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

      ctx.moveTo(x, -rulerHeight / 2);
      ctx.lineTo(x, -rulerHeight / 2 + height);
      ctx.moveTo(x, rulerHeight / 2);
      ctx.lineTo(x, rulerHeight / 2 - height);

      // Draw labels every 10 ticks
      if (absI % 10 === 0 && i !== 0) {
        ctx.fillStyle = getRulerColor("--ruler-text", 1);
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(absI / 10), x, 0);
      }
    }

    ctx.stroke();

    // Draw center circle with angle
    const centerRadius = 22;
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
    ctx.fillStyle = getRulerColor("--ruler-center-bg", 1);
    ctx.fill();
    ctx.strokeStyle = getRulerColor("--ruler-center-border", 1);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw angle text
    ctx.fillStyle = getRulerColor("--ruler-text", 1);
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(this.angle % 360)}°`, 0, 0);

    // Draw compass rose
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const r1 = centerRadius + 2;
      const r2 = i % 2 === 0 ? centerRadius + 8 : centerRadius + 5;
      ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
      ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
    }
    ctx.strokeStyle = getRulerColor("--ruler-compass", 1);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Serialize to plain object for storage
   */
  serialize(): RulerState {
    return {
      visible: this.visible,
      x: this.x,
      y: this.y,
      angle: this.angle,
      isDragging: false, // Don't serialize dragging state
    };
  }

  /**
   * Deserialize from plain object
   */
  static deserialize(state: RulerState): Ruler {
    const ruler = new Ruler();
    ruler.visible = state.visible;
    ruler.x = state.x;
    ruler.y = state.y;
    ruler.angle = state.angle;
    ruler.isDragging = false;
    return ruler;
  }
}
