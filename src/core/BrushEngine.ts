import type { Point, BrushSettings } from "./types";

/**
 * BrushEngine handles all brush rendering operations
 * Supports multiple tools (pen, highlighter, area) and blend modes (normal, multiply)
 *
 * Rendering approach (inspired by KSnip):
 * - Use smooth Canvas API paths with anti-aliasing for high-quality strokes
 * - For multiply blend mode (highlighter): draw to temp canvas first, then composite
 *   with multiply blend mode to avoid anti-aliasing artifacts at edges
 */
export class BrushEngine {
  /**
   * Draw a pen stroke using smooth Canvas paths
   * Uses round caps and joins for natural-looking strokes
   */
  drawPenStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
  ): void {
    if (points.length === 0) return;

    ctx.save();

    // Set up stroke style
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brush.size;
    ctx.strokeStyle = brush.color;
    ctx.globalAlpha = brush.opacity;

    // Draw the path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
      // Single point - draw a dot
      ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
    } else {
      // Multiple points - use quadratic curves for smoothness
      for (let i = 1; i < points.length; i++) {
        const curr = points[i];

        // For smoother curves, use the midpoint between points
        if (i < points.length - 1) {
          const next = points[i + 1];
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        } else {
          // Last point - draw directly to it
          ctx.lineTo(curr.x, curr.y);
        }
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw a highlighter stroke using smooth Canvas paths
   * Uses square line caps for flat highlighter ends
   * Uses quadratic curves for smooth path interpolation
   */
  drawHighlighterStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
  ): void {
    if (points.length === 0) return;

    ctx.save();

    // Set up stroke style - square cap gives flat ends, bevel for smoother joints
    ctx.lineCap = "square";
    ctx.lineJoin = "bevel";
    ctx.lineWidth = brush.size;
    ctx.strokeStyle = brush.color;
    ctx.globalAlpha = brush.opacity;

    // Draw the path using quadratic curves for smoothness
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
      // Single point - draw a short horizontal line to create a visible mark
      ctx.lineTo(points[0].x + 1, points[0].y);
    } else if (points.length === 2) {
      // Two points - draw a straight line
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      // Multiple points - use quadratic curves for smoothness
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      // Last point - draw directly to it
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw an area rectangle with optional rounded corners
   * Uses smooth Canvas paths for high-quality rendering
   * Automatically clamps border radius to valid range based on dimensions
   */
  drawArea(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    brush: BrushSettings,
  ): void {
    ctx.save();

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    // Clamp border radius to half of the smaller dimension
    // This prevents invalid rendering when radius exceeds the rect bounds
    const maxRadius = Math.min(width, height) / 2;
    const borderRadius = Math.min(brush.borderRadius || 0, maxRadius);

    // Draw fill
    ctx.globalAlpha = brush.opacity;
    ctx.fillStyle = brush.color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, borderRadius);
    ctx.fill();

    ctx.restore();
  }
}
