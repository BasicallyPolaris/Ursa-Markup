import type { Point, BrushSettings, BlendMode } from './types'

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
    _blendMode: BlendMode
  ): void {
    if (points.length === 0) return

    ctx.save()
    
    // Set up stroke style
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brush.size
    ctx.strokeStyle = brush.color
    ctx.globalAlpha = brush.opacity

    // Draw the path
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    
    if (points.length === 1) {
      // Single point - draw a dot
      ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1)
    } else {
      // Multiple points - use quadratic curves for smoothness
      for (let i = 1; i < points.length; i++) {
        const curr = points[i]
        
        // For smoother curves, use the midpoint between points
        if (i < points.length - 1) {
          const next = points[i + 1]
          const midX = (curr.x + next.x) / 2
          const midY = (curr.y + next.y) / 2
          ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
        } else {
          // Last point - draw directly to it
          ctx.lineTo(curr.x, curr.y)
        }
      }
    }
    
    ctx.stroke()
    ctx.restore()
  }

  /**
   * Draw a highlighter stroke with upright rectangular marks
   * Uses temp canvas approach for multiply blend mode to avoid edge artifacts
   * 
   * The highlighter maintains an upright orientation (doesn't rotate with cursor direction)
   */
  drawHighlighterStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
    _blendMode: BlendMode,
    canvas?: HTMLCanvasElement
  ): void {
    if (points.length === 0) return

    const height = brush.size
    const width = brush.size * 0.3  // Rectangular tip: 30% of height
    const halfWidth = width / 2
    const halfHeight = height / 2

    // For multiply mode with a canvas provided, use temp canvas approach
    // This prevents anti-aliasing artifacts when using multiply blend mode
    if (canvas) {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      
      if (tempCtx) {
        // Draw to temp canvas with source-over (normal blend)
        this.drawHighlighterToContext(tempCtx, points, brush, halfWidth, halfHeight, width, height)
        
        // Composite temp canvas to main context
        // The caller's globalCompositeOperation is preserved (multiply is applied at composition time)
        ctx.drawImage(tempCanvas, 0, 0)
        return
      }
    }

    // Fallback: draw directly to context
    this.drawHighlighterToContext(ctx, points, brush, halfWidth, halfHeight, width, height)
  }

  /**
   * Internal helper to draw highlighter rectangles to a context
   */
  private drawHighlighterToContext(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
    halfWidth: number,
    halfHeight: number,
    width: number,
    height: number
  ): void {
    ctx.save()
    ctx.fillStyle = brush.color
    ctx.globalAlpha = brush.opacity

    // Track filled positions to avoid overdraw (prevents opacity stacking)
    const filledPositions = new Set<string>()

    // Draw upright rectangles along the path
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i]
      const p2 = points[i + 1] || p1

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const stepSize = Math.max(1, width / 2)  // Step based on marker width
      const steps = Math.max(1, Math.ceil(distance / stepSize))

      for (let j = 0; j <= steps; j++) {
        const t = steps > 0 ? j / steps : 0
        const interpX = p1.x + dx * t
        const interpY = p1.y + dy * t

        // Round to create consistent grid positions
        const gridX = Math.round(interpX)
        const gridY = Math.round(interpY)
        const posKey = `${gridX},${gridY}`

        if (filledPositions.has(posKey)) continue
        filledPositions.add(posKey)

        // Draw upright rectangle centered at this position
        ctx.fillRect(
          interpX - halfWidth,
          interpY - halfHeight,
          width,
          height
        )
      }
    }

    // Handle single point (click without drag)
    if (points.length === 1) {
      const point = points[0]
      ctx.fillRect(
        point.x - halfWidth,
        point.y - halfHeight,
        width,
        height
      )
    }

    ctx.restore()
  }

  /**
   * Draw an area rectangle with optional border and rounded corners
   * Uses smooth Canvas paths for high-quality rendering
   */
  drawArea(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    brush: BrushSettings,
    _blendMode: BlendMode
  ): void {
    ctx.save()

    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    const borderRadius = brush.borderRadius || 0
    const borderWidth = brush.borderWidth || 0

    // Draw fill
    ctx.globalAlpha = brush.opacity
    ctx.fillStyle = brush.color
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, borderRadius)
    ctx.fill()

    // Draw border if width > 0
    if (borderWidth > 0) {
      ctx.strokeStyle = brush.color
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.stroke()
    }

    ctx.restore()
  }
}
