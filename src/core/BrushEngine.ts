import type { Point, BrushSettings, BlendMode, HSL, RGB } from './types'

/**
 * BrushEngine handles all brush rendering operations
 * Supports multiple tools (pen, highlighter, area) and blend modes (normal, multiply, color)
 * All drawing is pixel-based to avoid anti-aliasing artifacts with blend modes
 */
export class BrushEngine {
  /**
   * Draw a pen stroke (pixel-based for crisp edges, no anti-aliasing)
   * Supports normal, multiply, and color blend modes
   * For multiply: handled at composite time by the caller
   * For color: pixel-by-pixel HSL blending with base image
   */
  drawPenStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
    blendMode: BlendMode,
    baseImageData?: ImageData | null,
    canvasWidth?: number
  ): void {
    if (points.length === 0) return

    // Preserve caller's composite operation (important for multiply preview)
    const savedCompositeOp = ctx.globalCompositeOperation

    const radius = brush.size / 2
    
    // Track filled pixels to avoid over-drawing (prevents opacity stacking)
    const filledPixels = new Set<string>()
    
    // Check if color blend mode should be used
    const isColorBlend = blendMode === 'color' && baseImageData && canvasWidth

    if (!isColorBlend) {
      ctx.fillStyle = brush.color
      ctx.globalAlpha = brush.opacity
    }

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
              
              if (isColorBlend) {
                this.drawPixelWithColorBlend(
                  ctx,
                  gridX,
                  gridY,
                  brush.color,
                  brush.opacity,
                  baseImageData!,
                  canvasWidth!
                )
              } else {
                ctx.fillRect(gridX, gridY, 1, 1)
              }
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
   * Supports normal and color blend modes
   * Note: Multiply blend mode is handled at composite time by the caller
   * This method preserves the caller's globalCompositeOperation setting
   */
  drawHighlighterStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
    blendMode: BlendMode,
    baseImageData: ImageData | null,
    canvasWidth: number
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

              if (blendMode === 'color' && baseImageData) {
                this.drawPixelWithColorBlend(
                  ctx,
                  gridX,
                  gridY,
                  brush.color,
                  brush.opacity,
                  baseImageData,
                  canvasWidth
                )
              } else {
                // Draw exact 1x1 pixel - no overlap, no anti-aliasing artifacts
                ctx.fillRect(gridX, gridY, 1, 1)
              }
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

            if (blendMode === 'color' && baseImageData) {
              this.drawPixelWithColorBlend(
                ctx,
                gridX,
                gridY,
                brush.color,
                brush.opacity,
                baseImageData,
                canvasWidth
              )
            } else {
              ctx.fillRect(gridX, gridY, 1, 1)
            }
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
    blendMode: BlendMode,
    baseImageData?: ImageData | null,
    canvasWidth?: number
  ): void {
    // Preserve caller's composite operation (important for multiply preview)
    const savedCompositeOp = ctx.globalCompositeOperation

    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    const borderRadius = brush.borderRadius || 0
    const borderWidth = brush.borderWidth || 2
    const borderEnabled = brush.borderEnabled !== false

    if (blendMode === 'color' && baseImageData && canvasWidth) {
      // Color blend mode - pixel by pixel
      const startX = Math.floor(x)
      const endX = Math.ceil(x + width)
      const startY = Math.floor(y)
      const endY = Math.ceil(y + height)

      if (borderRadius > 0) {
        // Use clipping for rounded corners
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x, y, width, height, borderRadius)
        ctx.clip()
      }

      for (let gridX = startX; gridX < endX; gridX++) {
        for (let gridY = startY; gridY < endY; gridY++) {
          // For non-rounded, check if pixel is inside rectangle
          if (borderRadius === 0) {
            if (gridX < x || gridX >= x + width || gridY < y || gridY >= y + height) {
              continue
            }
          }
          this.drawPixelWithColorBlend(
            ctx,
            gridX,
            gridY,
            brush.color,
            brush.opacity,
            baseImageData,
            canvasWidth
          )
        }
      }

      if (borderRadius > 0) {
        ctx.restore()
      }
    } else if (borderRadius > 0) {
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

    // Draw border if enabled (border always uses source-over for visibility)
    if (borderEnabled) {
      ctx.globalCompositeOperation = 'source-over'
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

  /**
   * Public wrapper for drawPixelWithColorBlend for preview rendering
   */
  drawPixelWithColorBlendPublic(
    ctx: CanvasRenderingContext2D,
    gridX: number,
    gridY: number,
    brushColor: string,
    brushOpacity: number,
    baseImageData: ImageData,
    canvasWidth: number
  ): void {
    this.drawPixelWithColorBlend(ctx, gridX, gridY, brushColor, brushOpacity, baseImageData, canvasWidth)
  }

  /**
   * Draw a single pixel with Color blend mode (HSL-based)
   * Preserves pixel lightness, applies brush hue/saturation
   */
  private drawPixelWithColorBlend(
    ctx: CanvasRenderingContext2D,
    gridX: number,
    gridY: number,
    brushColor: string,
    brushOpacity: number,
    baseImageData: ImageData,
    canvasWidth: number
  ): void {
    const pixelIndex = (gridY * canvasWidth + gridX) * 4
    
    if (pixelIndex < 0 || pixelIndex >= baseImageData.data.length - 3) {
      // Fallback to normal drawing if out of bounds
      ctx.globalAlpha = brushOpacity
      ctx.fillStyle = brushColor
      ctx.fillRect(gridX, gridY, 1, 1)
      ctx.globalAlpha = 1
      return
    }

    const r = baseImageData.data[pixelIndex]
    const g = baseImageData.data[pixelIndex + 1]
    const b = baseImageData.data[pixelIndex + 2]

    // Convert brush color to HSL
    const brushHsl = this.hexToHsl(brushColor)
    // Convert pixel to HSL
    const pixelHsl = this.rgbToHsl(r, g, b)

    // Apply brush hue/saturation to pixel lightness
    const newColor = this.hslToRgb(brushHsl.h, brushHsl.s, pixelHsl.l)

    ctx.fillStyle = `rgba(${newColor.r}, ${newColor.g}, ${newColor.b}, ${brushOpacity})`
    ctx.fillRect(gridX, gridY, 1, 1)
  }

  /**
   * Convert hex color to HSL
   */
  private hexToHsl(hex: string): HSL {
    const cleanHex = hex.replace('#', '')
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  /**
   * Convert RGB to HSL
   */
  private rgbToHsl(r: number, g: number, b: number): HSL {
    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255

    const max = Math.max(rNorm, gNorm, bNorm)
    const min = Math.min(rNorm, gNorm, bNorm)
    let h = 0, s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break
        case gNorm: h = (bNorm - rNorm) / d + 2; break
        case bNorm: h = (rNorm - gNorm) / d + 4; break
      }
      h /= 6
    }

    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  /**
   * Convert HSL to RGB
   */
  private hslToRgb(h: number, s: number, l: number): RGB {
    const sNorm = s / 100
    const lNorm = l / 100
    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = lNorm - c / 2

    let r = 0, g = 0, b = 0

    if (h < 60) { r = c; g = x; b = 0 }
    else if (h < 120) { r = x; g = c; b = 0 }
    else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c }
    else if (h < 300) { r = x; g = 0; b = c }
    else { r = c; g = 0; b = x }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    }
  }
}
