/**
 * Core domain types for OmniMark
 * These are the fundamental types used throughout the application
 */

export type Tool = 'pen' | 'highlighter' | 'area'
export type BlendMode = 'normal' | 'color' | 'multiply'

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface BrushSettings {
  size: number
  color: string
  opacity: number
  borderRadius?: number
  borderWidth?: number
  borderEnabled?: boolean
  blendMode?: BlendMode  // Per-brush blend mode for future extensibility
  penMode?: 'line' | 'marker'  // For pen tool variations
}

export interface Stroke {
  id: string
  tool: Tool
  points: Point[]
  brush: BrushSettings
  blendMode: BlendMode
  timestamp: number
}

export interface StrokeGroup {
  id: string
  strokes: Stroke[]
  timestamp: number
}

export interface RulerState {
  visible: boolean
  x: number
  y: number
  angle: number
  isDragging: boolean
}

export interface RulerSnapInfo {
  distance: number
  snapToFarSide: boolean
  inStickyZone: boolean
  onRuler: boolean
}

export interface DocumentState {
  id: string
  filePath: string | null
  fileName: string | null
  imageSrc: string | null
  canvasSize: Size
  zoom: number
  viewOffset: Point
  rulerPosition: { x: number; y: number; angle: number }
  hasChanges: boolean
  recentDir: string | null
  strokeHistory: StrokeGroup[]
  strokeHistoryIndex: number
}

export interface StrokeHistoryState {
  groups: StrokeGroup[]
  currentIndex: number
}

export interface ViewState {
  zoom: number
  viewOffset: Point
  canvasSize: Size
}

export interface PreviewState {
  tool: Tool
  startPoint: Point
  currentPoint: Point
  brush: BrushSettings
  points?: Point[]
  blendMode?: BlendMode
}

// Color types for blend modes
export interface HSL {
  h: number
  s: number
  l: number
}

export interface RGB {
  r: number
  g: number
  b: number
}
