import type { Point, BrushSettings, BlendMode, HSL, RGB } from './types'

/**
 * BrushEngine handles all brush rendering operations
 * Supports multiple tools (pen, highlighter, area) and blend modes (normal, multiply, color)
 */
export class BrushEngine {
  /**
   * Draw a pen stroke (line-based)
   * Note: Multiply blend mode is handled at composite time, not here
   */
  drawPenStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    brush: BrushSettings,
    _blendMode: BlendMode
  ): void {
    if (points.length === 0) return

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brush.size
    ctx.globalAlpha = brush.opacity
    ctx.strokeStyle = brush.color
    ctx.globalCompositeOperation = 'source-over'

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    
    ctx.stroke()

    // Reset
    ctx.globalAlpha = 1
  }

  /**
   * Draw a highlighter stroke (pixel-based rectangular marker)
   * Supports normal and color blend modes
   * Note: Multiply blend mode is handled at composite time
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

    const height = brush.size
    const width = brush.size * 0.3
    const halfWidth = width / 2
    const halfHeight = height / 2

    // Track filled pixels to avoid over-drawing (prevents opacity stacking)
    const filledPixels = new Set<string>()

    // Set up context for drawing
    ctx.globalCompositeOperation = 'source-over'
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

    // Reset context
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  /**
   * Draw an area rectangle with optional border and rounded corners
   * Note: Multiply blend mode is handled at composite time
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
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    const borderRadius = brush.borderRadius || 0
    const borderWidth = brush.borderWidth || 2
    const borderEnabled = brush.borderEnabled !== false

    if (blendMode === 'color' && baseImageData && canvasWidth) {
      const startX = Math.floor(x)
      const endX = Math.ceil(x + width)
      const startY = Math.floor(y)
      const endY = Math.ceil(y + height)

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.clip()

      for (let gridX = startX; gridX < endX; gridX++) {
        for (let gridY = startY; gridY < endY; gridY++) {
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

      ctx.restore()
    } else {
      // Normal drawing (multiply is applied at composite time)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = brush.opacity
      ctx.fillStyle = brush.color

      // Draw rounded rectangle fill
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.fill()
    }

    // Draw border if enabled
    if (borderEnabled) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = brush.opacity
      ctx.strokeStyle = brush.color
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.stroke()
    }

    // Reset
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
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
