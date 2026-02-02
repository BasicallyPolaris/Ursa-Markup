import { Store } from '@tauri-apps/plugin-store'
import type { AppSettings, ServiceEvents } from './types'
import { DEFAULT_SETTINGS } from './types'

type EventCallback<T> = (payload: T) => void

/**
 * SettingsManager handles application settings persistence
 * Uses Tauri Store for saving/loading settings
 */
export class SettingsManager {
  private savedSettings: AppSettings = DEFAULT_SETTINGS
  private draftSettings: AppSettings = DEFAULT_SETTINGS
  private isLoaded = false
  private store: Store | null = null
  private listeners: { [K in keyof ServiceEvents]?: EventCallback<ServiceEvents[K]>[] } = {}

  /**
   * Get the current settings (returns draft settings)
   */
  get settings(): AppSettings {
    return this.draftSettings
  }

  /**
   * Get the saved settings
   */
  get saved(): AppSettings {
    return this.savedSettings
  }

  /**
   * Check if settings have been loaded from disk
   */
  get loaded(): boolean {
    return this.isLoaded
  }

  /**
   * Check if draft settings differ from saved settings
   */
  get hasChanges(): boolean {
    return JSON.stringify(this.savedSettings) !== JSON.stringify(this.draftSettings)
  }

  /**
   * Load settings from Tauri store
   */
  async load(): Promise<void> {
    try {
      this.store = await Store.load('settings.json')
      const saved = await this.store.get<AppSettings>('appSettings')

      if (saved) {
        const merged = { ...DEFAULT_SETTINGS, ...saved }
        this.savedSettings = merged
        this.draftSettings = { ...merged }
      }

      this.isLoaded = true
      this.emit('settingsChanged', this.draftSettings)
    } catch (error) {
      console.error('Failed to load settings:', error)
      this.isLoaded = true
    }
  }

  /**
   * Save draft settings to disk
   */
  async save(): Promise<boolean> {
    if (!this.store) return false

    try {
      await this.store.set('appSettings', this.draftSettings)
      await this.store.save()
      this.savedSettings = { ...this.draftSettings }
      this.emit('settingsSaved', this.draftSettings)
      return true
    } catch (error) {
      console.error('Failed to save settings:', error)
      return false
    }
  }

  /**
   * Cancel changes - revert draft to saved settings
   */
  cancel(): void {
    this.draftSettings = { ...this.savedSettings }
    this.emit('settingsChanged', this.draftSettings)
  }

  /**
   * Reset to default settings
   */
  async reset(): Promise<void> {
    this.draftSettings = { ...DEFAULT_SETTINGS }
    
    if (this.store) {
      try {
        await this.store.set('appSettings', DEFAULT_SETTINGS)
        await this.store.save()
        this.savedSettings = { ...DEFAULT_SETTINGS }
      } catch (error) {
        console.error('Failed to reset settings:', error)
      }
    }

    this.emit('settingsChanged', this.draftSettings)
    this.emit('settingsSaved', this.draftSettings)
  }

  /**
   * Update draft settings (doesn't save to disk)
   */
  updateDraft(updates: Partial<AppSettings>): void {
    this.draftSettings = { ...this.draftSettings, ...updates }
    this.emit('settingsChanged', this.draftSettings)
  }

  /**
   * Update a specific color preset
   */
  updateColorPreset(index: number, color: string): void {
    const newPresets = [...this.draftSettings.colorPresets]
    newPresets[index] = color
    this.draftSettings = { ...this.draftSettings, colorPresets: newPresets }
    this.emit('settingsChanged', this.draftSettings)
  }

  /**
   * Subscribe to settings changes
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
export const settingsManager = new SettingsManager()
