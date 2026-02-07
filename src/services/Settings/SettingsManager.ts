import { appConfigDir } from "@tauri-apps/api/path";
import { mkdir } from "@tauri-apps/plugin-fs";
import { Store } from "@tauri-apps/plugin-store";
import { themeManager } from "~/services";
import { DeepPartial } from "~/types";
import type { AppSettings, ServiceEvents } from "~/types/settings";
import { deepMerge } from "~/utils/settings";
import { DEFAULT_SETTINGS } from "./config";

type EventCallback<T> = (payload: T) => void;

/**
 * SettingsManager handles application settings persistence
 * Uses Tauri Store for saving/loading settings
 */
export class SettingsManager {
  private savedSettings: AppSettings = DEFAULT_SETTINGS;
  private draftSettings: AppSettings = DEFAULT_SETTINGS;
  private isLoaded = false;
  private store: Store | null = null;
  private listeners: {
    [K in keyof ServiceEvents]?: EventCallback<ServiceEvents[K]>[];
  } = {};

  /**
   * Get the current settings (returns draft settings)
   */
  get settings(): AppSettings {
    return this.draftSettings;
  }

  /**
   * Get the saved settings
   */
  get saved(): AppSettings {
    return this.savedSettings;
  }

  /**
   * Check if settings have been loaded from disk
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Check if draft settings differ from saved settings
   */
  get hasChanges(): boolean {
    return (
      JSON.stringify(this.savedSettings) !== JSON.stringify(this.draftSettings)
    );
  }

  /**
   * Load settings from Tauri store
   */
  async load(): Promise<void> {
    try {
      // Ensure the config directory exists before loading store
      const configDir = await appConfigDir();
      try {
        await mkdir(configDir, { recursive: true });
      } catch (mkdirError) {
        // Directory may already exist or other error - log but continue
        console.log(
          "Config directory creation (may already exist):",
          mkdirError,
        );
      }

      this.store = await Store.load("settings.json");
      const saved = await this.store.get<AppSettings>("appSettings");

      if (saved) {
        const merged = deepMerge(DEFAULT_SETTINGS, saved);

        this.savedSettings = merged;
        this.draftSettings = { ...merged };
      }

      this.isLoaded = true;
      this.emit("settingsChanged", this.draftSettings);
    } catch (error) {
      console.error("Failed to load settings:", error);
      this.isLoaded = true;
    }
  }

  /**
   * Save draft settings to disk
   */
  async save(): Promise<boolean> {
    if (!this.store) return false;

    try {
      // If a palette is selected, apply its colors to colorPresets before saving
      if (this.draftSettings.activePalette) {
        const palette = themeManager.getActivePalette(
          this.draftSettings.activePalette,
        );
        if (palette) {
          // Take up to 7 colors from the palette
          const newPresets = palette.colors.slice(0, 7);
          // Pad with default colors if palette has fewer than 7
          while (newPresets.length < 7) {
            newPresets.push(
              DEFAULT_SETTINGS.activePaletteColors[newPresets.length],
            );
          }
          this.draftSettings = {
            ...this.draftSettings,
            activePaletteColors: newPresets,
          };
        }
      }

      await this.store.set("appSettings", this.draftSettings);
      await this.store.save();
      this.savedSettings = { ...this.draftSettings };
      this.emit("settingsSaved", this.draftSettings);
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  }

  /**
   * Cancel changes - revert draft to saved settings
   */
  cancel(): void {
    this.draftSettings = { ...this.savedSettings };
    this.emit("settingsChanged", this.draftSettings);
  }

  /**
   * Reset draft to default settings (doesn't save to disk - user must press Save)
   */
  resetToDefaults(): void {
    this.draftSettings = { ...DEFAULT_SETTINGS };

    this.emit("settingsChanged", this.draftSettings);
  }

  /**
   * Update draft settings (doesn't save to disk)
   */
  updateDraft(updates: DeepPartial<AppSettings>): void {
    this.draftSettings = deepMerge(this.draftSettings, updates);
    this.emit("settingsChanged", this.draftSettings);
  }

  /**
   * Subscribe to settings changes
   */
  on<K extends keyof ServiceEvents>(
    event: K,
    callback: EventCallback<ServiceEvents[K]>,
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners[event]?.indexOf(callback);
      if (index !== undefined && index > -1) {
        this.listeners[event]!.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event to listeners
   */
  private emit<K extends keyof ServiceEvents>(
    event: K,
    payload: ServiceEvents[K],
  ): void {
    this.listeners[event]?.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
}

// Singleton instance
export const settingsManager = new SettingsManager();
