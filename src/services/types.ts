/**
 * Service layer types
 */

export type CloseTabBehavior = 'prompt' | 'auto-save' | 'discard'

export interface AppSettings {
  autoCopyOnChange: boolean
  colorPresets: string[]
  defaultTool: 'pen' | 'highlighter' | 'area'
  defaultPenSize: number
  defaultMarkerSize: number
  defaultPenOpacity: number
  defaultMarkerOpacity: number
  defaultMarkerBorderRadius: number
  defaultMarkerMode: 'normal' | 'composition'
  defaultMarkerBlendMode: 'normal' | 'color' | 'multiply'
  defaultAreaOpacity: number
  defaultAreaBorderRadius: number
  defaultAreaBorderWidth: number
  defaultAreaBorderEnabled: boolean
  defaultAreaMode: 'normal' | 'composition'
  defaultAreaBlendMode: 'normal' | 'color' | 'multiply'
  blendMode: 'normal' | 'color' | 'multiply'
  closeTabBehavior: CloseTabBehavior
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoCopyOnChange: false,
  colorPresets: [
    '#FF6B6B',
    '#FF9F43',
    '#FFE066',
    '#6BCB77',
    '#4D96FF',
    '#9B59B6',
    '#FF6B9D',
  ],
  defaultTool: 'pen',
  defaultPenSize: 3,
  defaultMarkerSize: 20,
  defaultPenOpacity: 1,
  defaultMarkerOpacity: 1,
  defaultMarkerBorderRadius: 4,
  defaultMarkerMode: 'normal',
  defaultMarkerBlendMode: 'multiply',
  defaultAreaOpacity: 1,
  defaultAreaBorderRadius: 0,
  defaultAreaBorderWidth: 2,
  defaultAreaBorderEnabled: false,
  defaultAreaMode: 'normal',
  defaultAreaBlendMode: 'multiply',
  blendMode: 'normal',
  closeTabBehavior: 'prompt',
}

// Import theme types from their sources
import type { ColorPalette } from '../types'
import type { ThemeConfig, ThemeColors } from '../lib/theme'

// Re-export for convenience
export type { ColorPalette, ThemeConfig, ThemeColors }

// Event listener types
export type EventCallback<T = void> = (payload: T) => void

export interface ServiceEvents {
  'settingsChanged': AppSettings
  'settingsSaved': AppSettings
  'themeLoaded': ThemeConfig
  'documentChanged': { id: string }
  'activeDocumentChanged': { id: string | null }
  'documentClosed': { id: string }
  'documentAdded': { id: string }
}
