import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { appConfigDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import type { ThemeConfig, Theme, ColorPalette } from "~/types/theme";
import type { ServiceEvents } from "~/types/settings";
import { isTauri } from "@tauri-apps/api/core";
import { DEFAULT_THEME, getDefaultTheme } from "./config";
import { applyThemeToCss, validateTheme } from "~/utils/theme";
import { toRgbaString } from "~/utils/colors";

type EventCallback<T> = (payload: T) => void;

/**
 * ThemeManager handles loading and applying themes
 * User config file (~/.config/omnimark/theme.json) is the source of truth
 * Bundled defaults are only used as fallback on errors
 */
export class ThemeManager {
  private config: ThemeConfig = DEFAULT_THEME;
  private activeTheme: Theme = getDefaultTheme();
  private selectedPaletteName: string = "default";
  private configFileName: string = "theme.json";
  private isLoading = true;
  private error: string | null = null;
  private listeners: {
    [K in keyof ServiceEvents]?: EventCallback<ServiceEvents[K]>[];
  } = {};

  /**
   * Get the full theme config (all themes and palettes from user config)
   */
  get configData(): ThemeConfig {
    return this.config;
  }

  /**
   * Get the currently active theme
   */
  get currentTheme(): Theme {
    return this.activeTheme;
  }

  /**
   * Get all available themes from user config
   */
  get availableThemes(): Theme[] {
    return this.config.themes;
  }

  /**
   * Get all available palettes from user config
   */
  get availablePalettes(): ColorPalette[] {
    return this.config.palettes;
  }

  /**
   * Check if theme is loading
   */
  get loading(): boolean {
    return this.isLoading;
  }

  /**
   * Get any loading error
   */
  get loadError(): string | null {
    return this.error;
  }

  /**
   * Get the path to the user theme config file
   */
  async getConfigPath(): Promise<string> {
    const configDir = await appConfigDir();
    return `${configDir}/${this.configFileName}`;
  }

  /**
   * Open the theme config file in the default editor
   */
  async openConfigFile(): Promise<void> {
    try {
      const configPath = await this.getConfigPath();
      const configExists = await exists(configPath);

      if (!configExists) {
        // Create config file with defaults if it doesn't exist
        await this.initializeUserConfig();
      }

      // Open the file
      await openPath(configPath);
    } catch (err) {
      console.error("Failed to open theme config:", err);
      throw err;
    }
  }

  /**
   * Ensure the user config exists and is populated with defaults.
   * Public method so UI can create/populate the file before opening it.
   */
  async ensureUserConfig(): Promise<void> {
    try {
      const configPath = await this.getConfigPath();
      const configExists = await exists(configPath);
      if (!configExists) {
        await this.initializeUserConfig();
      }
    } catch (err) {
      console.error("Failed to ensure user config:", err);
      throw err;
    }
  }

  /**
   * Initialize user config with default themes and palettes
   */
  private async initializeUserConfig(): Promise<void> {
    console.log("Initializing User Config");
    try {
      // Ensure the config directory exists before writing
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

      const content = JSON.stringify(DEFAULT_THEME, null, 2);
      const configPath = await this.getConfigPath();
      await writeTextFile(configPath, content);
      console.log(
        "Initialized user theme config with defaults at:",
        configPath,
      );
    } catch (error) {
      console.error("Failed to initialize user config:", error);
      throw error;
    }
  }

  /**
   * Load theme config from user config file
   * Creates the file with defaults if it doesn't exist
   */
  async load(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;

      let themeConfig: ThemeConfig;
      let loadedFrom: string = "defaults";

      try {
        // In Tauri environment
        if (isTauri()) {
          const configPath = await this.getConfigPath();
          const userConfigExists = await exists(configPath);
          // Inside ThemeManager.load()
          if (userConfigExists) {
            // Load from user config
            const content = await readTextFile(configPath);
            const parsed = JSON.parse(content);

            // Validate the config
            const validation = validateTheme(parsed);
            if (!validation.valid) {
              console.warn("User config validation errors:", validation.errors);
              this.error = `Config validation failed: ${validation.errors.join(", ")}`;
              // Use defaults but keep error state
              themeConfig = DEFAULT_THEME;
              loadedFrom = "defaults (validation error)";
            } else {
              themeConfig = parsed as ThemeConfig;
              loadedFrom = "user config";
            }
          } else {
            // Initialize user config with bundled defaults
            await this.initializeUserConfig();
            themeConfig = DEFAULT_THEME;
            loadedFrom = "bundled (initialized user config)";
          }
        } else {
          // Web/browser environment - use bundled defaults
          themeConfig = DEFAULT_THEME;
          loadedFrom = "bundled";
        }
      } catch (loadError) {
        console.warn("Failed to load theme.json, using defaults:", loadError);
        this.error =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load theme config";
        themeConfig = DEFAULT_THEME;
        loadedFrom = "defaults (error fallback)";
      }

      this.config = themeConfig;

      this.activeTheme = themeConfig.themes[0] || getDefaultTheme();

      // Apply theme CSS variables immediately after loading
      applyThemeToCss(this.activeTheme);

      console.log(`Theme config loaded from: ${loadedFrom}`);
      console.log(`Default theme: ${this.activeTheme.label}`);
      console.log(`Available themes: ${themeConfig.themes.length}`);
      console.log(`Available palettes: ${themeConfig.palettes.length}`);

      this.isLoading = false;

      this.emit("themeLoaded", this.activeTheme);
    } catch (err) {
      console.error("Theme initialization error:", err);
      // Apply default theme as fallback
      this.config = DEFAULT_THEME;
      this.activeTheme = getDefaultTheme();
      applyThemeToCss(this.activeTheme);
      this.isLoading = false;
      this.error = err instanceof Error ? err.message : "Failed to load theme";
    }
  }

  /**
   * Set the active theme by name
   */
  setTheme(themeName: string): boolean {
    const theme = this.config.themes.find((t) => t.name === themeName);
    if (!theme) {
      console.warn(`Theme not found: ${themeName}`);
      const fallbackTheme = this.config.themes[0] || getDefaultTheme();
      this.activeTheme = fallbackTheme;
      applyThemeToCss(fallbackTheme);
      this.emit("themeLoaded", fallbackTheme);
      return false;
    }

    this.activeTheme = theme;
    applyThemeToCss(theme);
    this.emit("themeLoaded", theme);
    return true;
  }

  /**
   * Reload theme from file
   */
  async reload(): Promise<void> {
    await this.load();
  }

  /**
   * Get the active color palette
   * @param paletteName - Optional palette name
   */
  getActivePalette(paletteName?: string): ColorPalette {
    const name = paletteName || this.selectedPaletteName;
    const palette = this.config.palettes.find((p) => p.name === name);
    return palette || this.config.palettes[0] || DEFAULT_THEME.palettes[0];
  }

  /**
   * Set the selected palette
   */
  setPalette(paletteName: string): boolean {
    const palette = this.config.palettes.find((p) => p.name === paletteName);
    if (!palette) {
      console.warn(`Palette not found: ${paletteName}`);
      return false;
    }
    this.selectedPaletteName = paletteName;
    return true;
  }

  /**
   * Get a color for canvas rendering (returns RGBA string)
   * colorPath: dot-notation path like 'ruler.background' or 'canvas.pattern'
   */
  getCanvasColor(colorPath: string, alpha: number = 1): string {
    const parts = colorPath.split(".");
    let value: unknown = this.activeTheme.colors;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        // Return fallback color
        console.warn(`Color path not found: ${colorPath}, using fallback`);
        return alpha < 1 ? `rgba(200, 200, 200, ${alpha})` : "#c8c8c8";
      }
    }

    if (typeof value !== "string") {
      return alpha < 1 ? `rgba(200, 200, 200, ${alpha})` : "#c8c8c8";
    }

    return toRgbaString(value, alpha);
  }

  /**
   * Subscribe to theme changes
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
export const themeManager = new ThemeManager();
