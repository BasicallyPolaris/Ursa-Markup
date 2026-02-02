import type { Point, BrushSettings, BlendMode } from './types'

/**
 * BrushEngine handles all brush rendering operations
 * Supports multiple tools (pen, highlighter, area) and blend modes (normal, multiply)
 * All drawing is pixel-based to avoid anti-aliasing artifacts with blend modes
 */
export class BrushEngine {
  /**
   * Draw a pen stroke (pixel-based for crisp edges, no anti-aliasing)
   * Supports normal and multiply blend modes
   * For multiply: handled at composite time by the caller
   */
  drawPenStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
    _blendMode: BlendMode
  ): void {
    if (points.length === 0) return

    // Preserve caller's composite operation (important for multiply preview)
    const savedCompositeOp = ctx.globalCompositeOperation

    const radius = brush.size / 2
    
    // Track filled pixels to avoid over-drawing (prevents opacity stacking)
    const filledPixels = new Set<string>()
    
    ctx.fillStyle = brush.color
    ctx.globalAlpha = brush.opacity

    // Draw circular brush at each point, interpolating between points
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i]
      const p2 = points[i + 1] || p1
      
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const stepSize = 1 // Small steps for smooth lines
      const steps = Math.max(1, Math.ceil(distance / stepSize))

      for (let j = 0; j <= steps; j++) {
        const t = steps > 0 ? j / steps : 0
        const interpX = p1.x + dx * t
        const interpY = p1.y + dy * t

        // Fill circular area around this point
        const startGridX = Math.floor(interpX - radius)
        const endGridX = Math.ceil(interpX + radius)
        const startGridY = Math.floor(interpY - radius)
        const endGridY = Math.ceil(interpY + radius)

        for (let gridX = startGridX; gridX < endGridX; gridX++) {
          for (let gridY = startGridY; gridY < endGridY; gridY++) {
            const pixelCenterX = gridX + 0.5
            const pixelCenterY = gridY + 0.5
            const distSq = (pixelCenterX - interpX) ** 2 + (pixelCenterY - interpY) ** 2
            
            // Check if pixel center is within brush radius
            if (distSq <= radius * radius) {
              const pixelKey = `${gridX},${gridY}`
              if (filledPixels.has(pixelKey)) continue
              filledPixels.add(pixelKey)
              ctx.fillRect(gridX, gridY, 1, 1)
            }
          }
        }
      }
    }

    // Reset alpha but restore composite operation
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = savedCompositeOp
  }

  /**
   * Draw a highlighter stroke (pixel-based rectangular marker)
   * Supports normal and multiply blend modes
   * Note: Multiply blend mode is handled at composite time by the caller
   * This method preserves the caller's globalCompositeOperation setting
   */
  drawHighlighterStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
    _blendMode: BlendMode
  ): void {
    if (points.length === 0) return

    // Preserve caller's composite operation (important for multiply preview)
    const savedCompositeOp = ctx.globalCompositeOperation

    const height = brush.size
    const width = brush.size * 0.3
    const halfWidth = width / 2
    const halfHeight = height / 2

    // Track filled pixels to avoid over-drawing (prevents opacity stacking)
    const filledPixels = new Set<string>()

    // Set up context for drawing - don't override globalCompositeOperation
    ctx.fillStyle = brush.color
    ctx.globalAlpha = brush.opacity

    // Interpolate points along the path
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const stepSize = 2
      const steps = Math.max(1, Math.ceil(distance / stepSize))

      for (let j = 0; j <= steps; j++) {
        const t = j / steps
        const interpX = p1.x + dx * t
        const interpY = p1.y + dy * t

        // Check all pixels under the marker at this position
        const startGridX = Math.floor(interpX - halfWidth)
        const endGridX = Math.ceil(interpX + halfWidth)
        const startGridY = Math.floor(interpY - halfHeight)
        const endGridY = Math.ceil(interpY + halfHeight)

        for (let gridX = startGridX; gridX < endGridX; gridX++) {
          for (let gridY = startGridY; gridY < endGridY; gridY++) {
            const pixelCenterX = gridX + 0.5
            const pixelCenterY = gridY + 0.5
            const pdx = Math.abs(pixelCenterX - interpX)
            const pdy = Math.abs(pixelCenterY - interpY)

            if (pdx <= halfWidth && pdy <= halfHeight) {
              const pixelKey = `${gridX},${gridY}`
              if (filledPixels.has(pixelKey)) continue
              filledPixels.add(pixelKey)
              // Draw exact 1x1 pixel - no overlap, no anti-aliasing artifacts
              ctx.fillRect(gridX, gridY, 1, 1)
            }
          }
        }
      }
    }

    // Handle single point (click without drag)
    if (points.length === 1) {
      const point = points[0]
      const startGridX = Math.floor(point.x - halfWidth)
      const endGridX = Math.ceil(point.x + halfWidth)
      const startGridY = Math.floor(point.y - halfHeight)
      const endGridY = Math.ceil(point.y + halfHeight)

      for (let gridX = startGridX; gridX < endGridX; gridX++) {
        for (let gridY = startGridY; gridY < endGridY; gridY++) {
          const pixelCenterX = gridX + 0.5
          const pixelCenterY = gridY + 0.5
          const pdx = Math.abs(pixelCenterX - point.x)
          const pdy = Math.abs(pixelCenterY - point.y)

          if (pdx <= halfWidth && pdy <= halfHeight) {
            const pixelKey = `${gridX},${gridY}`
            if (filledPixels.has(pixelKey)) continue
            filledPixels.add(pixelKey)
            ctx.fillRect(gridX, gridY, 1, 1)
          }
        }
      }
    }

    // Reset alpha and restore composite operation
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = savedCompositeOp
  }

  /**
   * Draw an area rectangle with optional border and rounded corners
   * Fill is pixel-based (no anti-aliasing) unless border radius is used
   * Note: Multiply blend mode is handled at composite time by the caller
   * This method preserves the caller's globalCompositeOperation setting
   */
  drawArea(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    brush: BrushSettings,
    _blendMode: BlendMode
  ): void {
    // Preserve caller's composite operation (important for multiply preview)
    const savedCompositeOp = ctx.globalCompositeOperation

    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    const borderRadius = brush.borderRadius || 0
    const borderWidth = brush.borderWidth || 0

    if (borderRadius > 0) {
      // Rounded corners - use canvas path (allows anti-aliasing on curves only)
      ctx.globalAlpha = brush.opacity
      ctx.fillStyle = brush.color

      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.fill()
    } else {
      // No border radius - pixel-based fill (no anti-aliasing)
      ctx.globalAlpha = brush.opacity
      ctx.fillStyle = brush.color

      const startX = Math.floor(x)
      const endX = Math.ceil(x + width)
      const startY = Math.floor(y)
      const endY = Math.ceil(y + height)

      for (let gridX = startX; gridX < endX; gridX++) {
        for (let gridY = startY; gridY < endY; gridY++) {
          ctx.fillRect(gridX, gridY, 1, 1)
        }
      }
    }

    // Draw border if width > 0 (keeps the same composite operation for proper blending)
    if (borderWidth > 0) {
      ctx.globalAlpha = brush.opacity
      ctx.strokeStyle = brush.color
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.stroke()
    }

    // Reset alpha and restore composite operation
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = savedCompositeOp
  }
}
