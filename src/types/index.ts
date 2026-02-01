export type Tool = 'pen' | 'highlighter' | 'area'

export interface Point {
  x: number
  y: number
}

export interface RulerState {
  visible: boolean
  x: number
  y: number
  angle: number
  isDragging: boolean
}

export interface BrushSettings {
  size: number
  color: string
  opacity: number
  borderRadius?: number  // For marker tool square corners
}

export interface CanvasState {
  tool: Tool
  brush: BrushSettings
  ruler: RulerState
  canUndo: boolean
  canRedo: boolean
  hasImage: boolean
}

export interface ColorPalette {
  name: string
  colors: string[]
}

export const PASTEL_PALETTE: ColorPalette = {
  name: 'pastel',
  colors: [
    '#FFB3BA', // Pastel Red
    '#FFDFBA', // Pastel Orange
    '#FFFFBA', // Pastel Yellow
    '#BAFFC9', // Pastel Green
    '#BAE1FF', // Pastel Blue
    '#E2BAFF', // Pastel Purple
    '#FFB3E6', // Pastel Pink
    '#C4C4C4', // Gray
    '#333333', // Dark
  ]
}

export const DEFAULT_CONFIG = {
  palettes: [PASTEL_PALETTE],
  defaultPalette: 'pastel',
  tools: {
    pen: { minSize: 1, maxSize: 20, defaultSize: 3 },
    highlighter: { opacity: 0.4, minSize: 5, maxSize: 50, defaultSize: 20 },
    area: { opacity: 0.3, defaultSize: 2 }
  }
}
