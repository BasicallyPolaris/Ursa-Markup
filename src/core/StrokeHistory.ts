import type { Stroke, StrokeGroup, Point, Tool, BrushSettings, BlendMode, StrokeHistoryState } from './types'
import { BrushEngine } from './BrushEngine'

/**
 * Maximum number of stroke groups in history
 */
const MAX_HISTORY = 100

/**
 * StrokeHistory manages stroke recording, undo/redo, and replay
 * This is a pure class that can be used independently of React
 */
export class StrokeHistory {
  groups: StrokeGroup[] = []
  currentIndex = -1
  maxHistory = MAX_HISTORY

  // Current stroke tracking (not yet committed to history)
  private currentGroup: StrokeGroup | null = null
  private currentStroke: Stroke | null = null
  private isRecording = false

  private brushEngine: BrushEngine

  constructor(brushEngine?: BrushEngine) {
    this.brushEngine = brushEngine || new BrushEngine()
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.groups.length - 1 && this.currentIndex >= -1
  }

  /**
   * Start a new stroke group (typically on mouse down)
   */
  startGroup(): void {
    this.isRecording = true
    this.currentGroup = {
      id: this.generateId(),
      strokes: [],
      timestamp: Date.now(),
    }
    this.currentStroke = null
  }

  /**
   * Start a new stroke within the current group
   */
  startStroke(tool: Tool, brush: BrushSettings, point: Point, blendMode: BlendMode = 'normal'): void {
    if (!this.isRecording || !this.currentGroup) {
      return
    }

    const stroke: Stroke = {
      id: this.generateId(),
      tool,
      points: [point],
      brush: { ...brush },
      blendMode,
      timestamp: Date.now(),
    }

    this.currentStroke = stroke
    this.currentGroup.strokes.push(stroke)
  }

  /**
   * Add a point to the current stroke
   */
  addPoint(point: Point): void {
    if (!this.isRecording || !this.currentStroke) {
      return
    }
    this.currentStroke.points.push(point)
  }

  /**
   * End the current stroke group (typically on mouse up)
   * Commits the group to history if it has strokes
   */
  endGroup(): void {
    if (!this.isRecording || !this.currentGroup) {
      return
    }

    this.isRecording = false
    this.currentStroke = null

    // Only save if there are strokes
    if (this.currentGroup.strokes.length === 0) {
      this.currentGroup = null
      return
    }

    // Remove redo states and add new group
    const newGroups = this.groups.slice(0, this.currentIndex + 1)
    newGroups.push(this.currentGroup)

    // Keep only last maxHistory groups
    if (newGroups.length > this.maxHistory) {
      newGroups.shift()
    }

    this.groups = newGroups
    this.currentIndex = newGroups.length - 1
    this.currentGroup = null
  }

  /**
   * Undo the last stroke group
   * Returns the new index after undo
   */
  undo(): number {
    if (this.currentIndex < 0) return this.currentIndex

    this.currentIndex--
    return this.currentIndex
  }

  /**
   * Redo the previously undone stroke group
   * Returns the new index after redo
   */
  redo(): number {
    if (this.currentIndex >= this.groups.length - 1) return this.currentIndex

    this.currentIndex++
    return this.currentIndex
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.groups = []
    this.currentIndex = -1
    this.currentGroup = null
    this.currentStroke = null
    this.isRecording = false
  }

  /**
   * Replay strokes up to the current index onto a canvas
   */
  replayToCanvas(
    canvas: HTMLCanvasElement,
    baseImageData: ImageData | null
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Replay all stroke groups up to current index
    for (let i = 0; i <= this.currentIndex; i++) {
      const group = this.groups[i]
      if (!group) continue

      for (const stroke of group.strokes) {
        this.replayStroke(ctx, stroke, baseImageData, canvas.width)
      }
    }
  }

  /**
   * Replay a single stroke onto a canvas context
   */
  replayStroke(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    _baseImageData: ImageData | null,
    _canvasWidth: number
  ): void {
    if (stroke.points.length === 0) return

    switch (stroke.tool) {
      case 'pen':
        this.brushEngine.drawPenStroke(ctx, stroke.points, stroke.brush, stroke.blendMode)
        break
      case 'highlighter':
        this.brushEngine.drawHighlighterStroke(
          ctx,
          stroke.points,
          stroke.brush,
          stroke.blendMode
        )
        break
      case 'area':
        if (stroke.points.length >= 2) {
          const start = stroke.points[0]
          const end = stroke.points[stroke.points.length - 1]
          this.brushEngine.drawArea(
            ctx,
            start,
            end,
            stroke.brush,
            stroke.blendMode
          )
        }
        break
    }
  }

  /**
   * Check if currently recording a stroke group
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording
  }

  /**
   * Get the current stroke group being recorded (if any)
   */
  getCurrentGroup(): StrokeGroup | null {
    return this.currentGroup
  }

  /**
   * Serialize to plain object for storage
   */
  serialize(): StrokeHistoryState {
    return {
      groups: this.groups,
      currentIndex: this.currentIndex,
    }
  }

  /**
   * Deserialize from plain object
   */
  static deserialize(state: StrokeHistoryState, brushEngine?: BrushEngine): StrokeHistory {
    const history = new StrokeHistory(brushEngine)
    history.groups = state.groups
    history.currentIndex = state.currentIndex
    return history
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
