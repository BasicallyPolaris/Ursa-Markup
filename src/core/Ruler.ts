import type { Point, Size, RulerState, RulerSnapInfo } from './types'

/**
 * Ruler height in pixels (used for geometry calculations)
 */
const RULER_HEIGHT = 60

/**
 * Distance in pixels for ruler snapping
 */
const SNAP_DISTANCE = 50

/**
 * Ruler manages ruler state, geometry, and interactions
 * Can be serialized/deserialized for persistence
 */
export class Ruler {
  visible = false
  x = 400
  y = 300
  angle = 0
  isDragging = false

  // Drag state (transient, not serialized)
  private dragStartPoint: Point | null = null
  private rulerStartPosition: Point | null = null

  /**
   * Toggle ruler visibility
   */
  toggle(): void {
    this.visible = !this.visible
  }

  /**
   * Show the ruler
   */
  show(): void {
    this.visible = true
  }

  /**
   * Hide the ruler
   */
  hide(): void {
    this.visible = false
  }

  /**
   * Rotate the ruler by a delta angle
   */
  rotate(delta: number): void {
    this.angle = (this.angle + delta) % 360
  }

  /**
   * Set the ruler angle directly
   */
  setAngle(angle: number): void {
    this.angle = angle % 360
  }

  /**
   * Start dragging the ruler
   */
  startDrag(point: Point): void {
    this.dragStartPoint = point
    this.rulerStartPosition = { x: this.x, y: this.y }
    this.isDragging = true
  }

  /**
   * Drag the ruler to a new point
   */
  dragTo(point: Point): void {
    if (!this.isDragging || !this.dragStartPoint || !this.rulerStartPosition) {
      return
    }

    const dx = point.x - this.dragStartPoint.x
    const dy = point.y - this.dragStartPoint.y

    this.x = this.rulerStartPosition.x + dx
    this.y = this.rulerStartPosition.y + dy
  }

  /**
   * End dragging the ruler
   */
  endDrag(): void {
    this.dragStartPoint = null
    this.rulerStartPosition = null
    this.isDragging = false
  }

  /**
   * Get snapping information for a point relative to the ruler
   */
  getSnapInfo(point: Point, canvasSize: Size): RulerSnapInfo {
    if (!this.visible) {
      return {
        distance: Infinity,
        snapToFarSide: false,
        inStickyZone: false,
        onRuler: false,
      }
    }

    const angleRad = (this.angle * Math.PI) / 180
    const dx = point.x - this.x
    const dy = point.y - this.y

    const perpDist = dx * Math.sin(angleRad) - dy * Math.cos(angleRad)
    const parallelDist = dx * Math.cos(angleRad) + dy * Math.sin(angleRad)
    const rulerLength = Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2) * 2
    const onRuler = Math.abs(parallelDist) <= rulerLength / 2

    const distToTopEdge = perpDist - -RULER_HEIGHT / 2
    const distToBottomEdge = perpDist - RULER_HEIGHT / 2

    const absDistToTop = Math.abs(distToTopEdge)
    const absDistToBottom = Math.abs(distToBottomEdge)

    if (absDistToTop < absDistToBottom) {
      const inStickyZone = absDistToTop < SNAP_DISTANCE
      return {
        distance: absDistToTop,
        snapToFarSide: true,
        inStickyZone,
        onRuler,
      }
    } else {
      const inStickyZone = absDistToBottom < SNAP_DISTANCE
      return {
        distance: absDistToBottom,
        snapToFarSide: false,
        inStickyZone,
        onRuler,
      }
    }
  }

  /**
   * Check if a point is on the ruler (for clicking to drag)
   */
  isPointOnRuler(point: Point, canvasSize: Size): boolean {
    if (!this.visible) return false

    const dx = point.x - this.x
    const dy = point.y - this.y

    // To check if point is in rotated ruler, we rotate the point by -angle 
    // to transform it into the ruler's local coordinate system
    const angleRad = (this.angle * Math.PI) / 180
    // Rotation by -angle: (cos(-a) = cos(a), sin(-a) = -sin(a))
    const rotatedX = dx * Math.cos(angleRad) + dy * Math.sin(angleRad)
    const rotatedY = -dx * Math.sin(angleRad) + dy * Math.cos(angleRad)

    const rulerLength = Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2) * 3

    return (
      Math.abs(rotatedX) <= rulerLength / 2 &&
      Math.abs(rotatedY) <= RULER_HEIGHT / 2
    )
  }

  /**
   * Snap a point to the ruler edge
   */
  snapPoint(point: Point, brushSize: number, snapToFarSide: boolean): Point {
    if (!this.visible) return point

    const angleRad = (this.angle * Math.PI) / 180
    const dx = point.x - this.x
    const dy = point.y - this.y

    const distAlong = dx * Math.cos(angleRad) + dy * Math.sin(angleRad)

    const markerHeight = brushSize
    const markerWidth = brushSize * 0.3
    const perpExtent =
      Math.abs(Math.cos(angleRad)) * (markerHeight / 2) +
      Math.abs(Math.sin(angleRad)) * (markerWidth / 2)

    const edgeOffset = snapToFarSide
      ? -RULER_HEIGHT / 2 - perpExtent
      : RULER_HEIGHT / 2 + perpExtent

    return {
      x:
        this.x +
        distAlong * Math.cos(angleRad) +
        edgeOffset * Math.sin(angleRad),
      y:
        this.y +
        distAlong * Math.sin(angleRad) -
        edgeOffset * Math.cos(angleRad),
    }
  }

  /**
   * Render the ruler to a canvas context
   */
  render(ctx: CanvasRenderingContext2D, canvasSize: Size, zoom: number): void {
    if (!this.visible) return

    // Safety check for valid position
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || !Number.isFinite(this.angle)) {
      console.error('Invalid ruler values:', this)
      return
    }

    // Safety check for valid canvas dimensions
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return

    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate((this.angle * Math.PI) / 180)

    const diagonal = Math.sqrt(canvasSize.width ** 2 + canvasSize.height ** 2)
    const rulerLength = diagonal * 3
    const rulerHeight = RULER_HEIGHT

    if (rulerLength <= 0 || rulerHeight <= 0) {
      ctx.restore()
      return
    }

    // Draw ruler background
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)'
    ctx.fillRect(-rulerLength / 2, -rulerHeight / 2, rulerLength, rulerHeight)

    // Draw border
    ctx.strokeStyle = 'rgba(100, 100, 100, 1)'
    ctx.lineWidth = 2 / zoom
    ctx.strokeRect(-rulerLength / 2, -rulerHeight / 2, rulerLength, rulerHeight)

    // Draw tick marks
    ctx.strokeStyle = 'rgba(50, 50, 50, 1)'
    ctx.lineWidth = 1.5 / zoom
    ctx.beginPath()

    const tickSpacing = 10
    const tickCount = Math.floor(rulerLength / tickSpacing)

    for (let i = -Math.floor(tickCount / 2); i <= Math.floor(tickCount / 2); i++) {
      const x = i * tickSpacing
      const absI = Math.abs(i)
      let height = 6
      if (absI % 10 === 0) height = 18
      else if (absI % 5 === 0) height = 12

      ctx.moveTo(x, -rulerHeight / 2)
      ctx.lineTo(x, -rulerHeight / 2 + height)
      ctx.moveTo(x, rulerHeight / 2)
      ctx.lineTo(x, rulerHeight / 2 - height)

      // Draw labels every 10 ticks
      if (absI % 10 === 0 && i !== 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 1)'
        ctx.font = `bold ${11 / zoom}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(absI / 10), x, 0)
      }
    }

    ctx.stroke()

    // Draw center circle with angle
    const centerRadius = 22
    ctx.beginPath()
    ctx.arc(0, 0, centerRadius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 1)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 100, 100, 1)'
    ctx.lineWidth = 2 / zoom
    ctx.stroke()

    // Draw angle text
    ctx.fillStyle = 'rgba(50, 50, 50, 1)'
    ctx.font = `bold ${13 / zoom}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(this.angle % 360)}°`, 0, 0)

    // Draw compass rose
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4
      const r1 = centerRadius + 2
      const r2 = i % 2 === 0 ? centerRadius + 8 : centerRadius + 5
      ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1)
      ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2)
    }
    ctx.strokeStyle = 'rgba(80, 80, 80, 1)'
    ctx.lineWidth = 1.5 / zoom
    ctx.stroke()

    ctx.restore()
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
    }
  }

  /**
   * Deserialize from plain object
   */
  static deserialize(state: RulerState): Ruler {
    const ruler = new Ruler()
    ruler.visible = state.visible
    ruler.x = state.x
    ruler.y = state.y
    ruler.angle = state.angle
    ruler.isDragging = false
    return ruler
  }
}
