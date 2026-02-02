import { readTextFile, writeTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { resolveResource, appConfigDir } from '@tauri-apps/api/path'
import type { ThemeConfig } from '../lib/theme'
import type { ColorPalette } from '../types'
import { 
  DEFAULT_THEME, 
  applyThemeToCss, 
  mergeThemeWithDefaults,
  toRgbaString 
} from '../lib/theme'
import type { ServiceEvents } from './types'

type EventCallback<T> = (payload: T) => void

/**
 * ThemeManager handles loading and applying themes
 * Loads from user config directory or bundled resources
 */
export class ThemeManager {
  private theme: ThemeConfig = DEFAULT_THEME
  private isLoading = true
  private error: string | null = null
  private listeners: { [K in keyof ServiceEvents]?: EventCallback<ServiceEvents[K]>[] } = {}

  /**
   * Get the current theme
   */
  get current(): ThemeConfig {
    return this.theme
  }

  /**
   * Check if theme is loading
   */
  get loading(): boolean {
    return this.isLoading
  }

  /**
   * Get any loading error
   */
  get loadError(): string | null {
    return this.error
  }

  /**
   * Load theme from config file
   */
  async load(): Promise<void> {
    try {
      this.isLoading = true
      this.error = null

      let themeConfig: ThemeConfig
      let loadedFrom: string = 'defaults'

      try {
        // In Tauri environment
        if (typeof window !== 'undefined' && '__TAURI__' in window) {
          // 1. Check user config directory first
          const configDir = await appConfigDir()
          const userThemePath = `${configDir}/theme.json`
          
          const userThemeExists = await exists(userThemePath)
          
          if (userThemeExists) {
            // Load from user config
            const content = await readTextFile(userThemePath)
            const parsed = JSON.parse(content)
            themeConfig = mergeThemeWithDefaults(parsed)
            loadedFrom = 'user config'
          } else {
            // 2. Copy bundled theme to user config for future customization
            const bundledPath = await resolveResource('config/theme.json')
            const bundledContent = await readTextFile(bundledPath)
            
            // Write to user config dir
            await writeTextFile('theme.json', bundledContent, { 
              baseDir: BaseDirectory.AppConfig 
            })
            
            const parsed = JSON.parse(bundledContent)
            themeConfig = mergeThemeWithDefaults(parsed)
            loadedFrom = 'bundled (copied to user config)'
          }
        } else {
          // Fallback for web/browser environment (development)
          const response = await fetch('/config/theme.json')
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const parsed = await response.json()
          themeConfig = mergeThemeWithDefaults(parsed)
          loadedFrom = 'bundled'
        }
      } catch (loadError) {
        console.warn('Failed to load theme.json, using defaults:', loadError)
        themeConfig = DEFAULT_THEME
        loadedFrom = 'defaults (error fallback)'
      }

      // Apply theme to CSS
      applyThemeToCss(themeConfig)
      
      console.log(`Theme loaded from: ${loadedFrom}`)

      this.theme = themeConfig
      this.isLoading = false
      this.error = null

      this.emit('themeLoaded', themeConfig)
    } catch (err) {
      console.error('Theme initialization error:', err)
      // Apply default theme as fallback
      applyThemeToCss(DEFAULT_THEME)
      this.theme = DEFAULT_THEME
      this.isLoading = false
      this.error = err instanceof Error ? err.message : 'Failed to load theme'
    }
  }

  /**
   * Reload theme from file
   */
  async reload(): Promise<void> {
    await this.load()
  }

  /**
   * Get the active color palette
   */
  getActivePalette(): ColorPalette {
    const palette = this.theme.palettes.find(p => p.name === this.theme.defaultPalette)
    return palette || this.theme.palettes[0] || DEFAULT_THEME.palettes[0]
  }

  /**
   * Get a color for canvas rendering (returns RGBA string)
   * colorPath: dot-notation path like 'ruler.background' or 'canvas.pattern'
   */
  getCanvasColor(colorPath: string, alpha: number = 1): string {
    const parts = colorPath.split('.')
    let value: unknown = this.theme.colors
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part]
      } else {
        // Return fallback color
        console.warn(`Color path not found: ${colorPath}, using fallback`)
        return alpha < 1 ? `rgba(200, 200, 200, ${alpha})` : '#c8c8c8'
      }
    }

    if (typeof value !== 'string') {
      return alpha < 1 ? `rgba(200, 200, 200, ${alpha})` : '#c8c8c8'
    }

    return toRgbaString(value, alpha)
  }

  /**
   * Subscribe to theme changes
   */
  on<K extends keyof ServiceEvents>(
    event: K,
    callback: EventCallback<ServiceEvents[K]>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event]!.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.listeners[event]?.indexOf(callback)
      if (index !== undefined && index > -1) {
        this.listeners[event]!.splice(index, 1)
      }
    }
  }

  /**
   * Emit an event to listeners
   */
  private emit<K extends keyof ServiceEvents>(
    event: K,
    payload: ServiceEvents[K]
  ): void {
    this.listeners[event]?.forEach(callback => {
      try {
        callback(payload)
      } catch (error) {
        console.error(`Error in ${event} listener:`, error)
      }
    })
  }
}

// Singleton instance
export const themeManager = new ThemeManager()
