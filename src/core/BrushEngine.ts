import type { Point } from "~/types";
import {
  type AreaToolConfig,
  type HighlighterToolConfig,
  type PenToolConfig,
} from "~/types/tools";

export class BrushEngine {
  /**
   * Draw a standard Pen stroke
   * Uses quadratic curves for smoothness and round caps
   */
  drawPenStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    config: PenToolConfig,
    color: string,
  ): void {
    if (points.length === 0) return;

    // 1. Configure Context
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = "size" in config ? config.size : 1;
    ctx.strokeStyle = color;
    ctx.globalAlpha = config.opacity / 100;

    // 2. Begin Path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // 3. Draw Curves or
    if (points.length < 3) {
      if (
        points.length === 1 ||
        (points.length === 2 && points[0] === points[1])
      ) {
        // Draw a dot
        ctx.lineTo(points[0].x, points[0].y + 0.1);
      } else {
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }
    } else {
      // Quadratic Bezier smoothing
      // We draw from midpoint to midpoint to ensure smooth joins
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];

        // Calculate midpoint
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;

        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      // Connect to the very last point
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw a Highlighter stroke
   * Uses square caps and bevel joins to mimic a marker tip
   */
  drawHighlighterStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    config: HighlighterToolConfig,
    color: string,
  ): void {
    if (points.length === 0) return;

    // 1. Configure Context for Marker look
    ctx.lineCap = "square";
    ctx.lineJoin = "bevel";
    ctx.lineWidth = config.size;
    ctx.strokeStyle = color;
    ctx.globalAlpha = config.opacity / 100;

    // 2. Begin Path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // 3. Draw (Standard lines often look better for highlighter than curves,
    // but quadratic is safer for fast/jagged mouse movements)
    if (points.length < 3) {
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw an Area (Rectangle/Box)
   */
  drawArea(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    config: AreaToolConfig,
    color: string,
  ): void {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    ctx.fillStyle = color;
    ctx.globalAlpha = config.opacity / 100;

    let radius = config.borderRadius || 0;
    const maxRadius = Math.min(width, height) / 2;
    if (radius > maxRadius) radius = maxRadius;

    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      // Fallback for older browsers
      ctx.rect(x, y, width, height);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw the Eraser cursor preview (Circle with contrast outline)
   */
  drawEraserPreview(
    ctx: CanvasRenderingContext2D,
    point: Point,
    size: number,
    resolutionScale: number = 1,
  ): void {
    // 1. Black Outline
    ctx.beginPath();
    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1 / resolutionScale;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(point.x, point.y, size / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1 / resolutionScale;
    ctx.stroke();
  }
}
