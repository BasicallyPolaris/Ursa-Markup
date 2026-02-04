import { useState, useEffect, useCallback } from 'react';
import { readTextFile, writeTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appConfigDir } from '@tauri-apps/api/path';
import type { ThemeConfig } from '../lib/theme';
import type { ColorPalette } from '../types';
import { 
  DEFAULT_THEME, 
  applyThemeToCss, 
  mergeThemeWithDefaults,
  toRgbaString 
} from '../lib/theme';

export interface ThemeState {
  theme: ThemeConfig;
  isLoading: boolean;
  error: string | null;
}

export interface UseThemeReturn extends ThemeState {
  /** Get the active color palette */
  getActivePalette: () => ColorPalette;
  /** Get a color for canvas rendering (returns RGBA string) */
  getCanvasColor: (colorPath: string, alpha?: number) => string;
  /** Reload the theme from file */
  reloadTheme: () => Promise<void>;
}

/**
 * Hook for managing the application theme
 * Loads theme from public/config/theme.json and applies it to CSS variables
 */
export function useTheme(): UseThemeReturn {
  const [state, setState] = useState<ThemeState>({
    theme: DEFAULT_THEME,
    isLoading: true,
    error: null,
  });

  /**
   * Load theme from the config file
   * Option B implementation: Check user config directory first, fall back to bundled
   */
  const loadTheme = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      let themeConfig: ThemeConfig;
      let loadedFrom: string = 'defaults';

      try {
        // In Tauri environment
        if (typeof window !== 'undefined' && '__TAURI__' in window) {
          // 1. Check user config directory first
          const configDir = await appConfigDir();
          const userThemePath = `${configDir}/theme.json`;
          
          const userThemeExists = await exists(userThemePath);
          
          if (userThemeExists) {
            // Load from user config
            const content = await readTextFile(userThemePath);
            const parsed = JSON.parse(content);
            themeConfig = mergeThemeWithDefaults(parsed);
            loadedFrom = 'user config';
          } else {
            // 2. Initialize user config with bundled defaults (from DEFAULT_THEME)
            const content = JSON.stringify(DEFAULT_THEME, null, 2);

            // Write to user config dir
            await writeTextFile('theme.json', content, {
              baseDir: BaseDirectory.AppConfig,
            });

            themeConfig = DEFAULT_THEME;
            loadedFrom = 'bundled (initialized user config)';
          }
        } else {
          // Web/browser environment - use bundled defaults
          themeConfig = DEFAULT_THEME;
          loadedFrom = 'bundled';
        }
      } catch (loadError) {
        console.warn('Failed to load theme.json, using defaults:', loadError);
        themeConfig = DEFAULT_THEME;
        loadedFrom = 'defaults (error fallback)';
      }

      // Apply theme to CSS
      applyThemeToCss(themeConfig);
      
      console.log(`Theme loaded from: ${loadedFrom}`);

      setState({
        theme: themeConfig,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Theme initialization error:', err);
      // Apply default theme as fallback
      applyThemeToCss(DEFAULT_THEME);
      setState({
        theme: DEFAULT_THEME,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load theme',
      });
    }
  }, []);

  // Load theme on mount
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  /**
   * Get the active color palette
   */
  const getActivePalette = useCallback((): ColorPalette => {
    const { theme } = state;
    const palette = theme.palettes.find(p => p.name === theme.defaultPalette);
    return palette || theme.palettes[0] || DEFAULT_THEME.palettes[0];
  }, [state]);

  /**
   * Get a canvas-ready color (RGBA string)
   * colorPath: dot-notation path like 'ruler.background' or 'canvas.pattern'
   */
  const getCanvasColor = useCallback((colorPath: string, alpha: number = 1): string => {
    const parts = colorPath.split('.');
    let value: unknown = state.theme.colors;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        // Return fallback color
        console.warn(`Color path not found: ${colorPath}, using fallback`);
        return alpha < 1 ? `rgba(200, 200, 200, ${alpha})` : '#c8c8c8';
      }
    }

    if (typeof value !== 'string') {
      return alpha < 1 ? `rgba(200, 200, 200, ${alpha})` : '#c8c8c8';
    }

    return toRgbaString(value, alpha);
  }, [state.theme]);

  return {
    ...state,
    getActivePalette,
    getCanvasColor,
    reloadTheme: loadTheme,
  };
}
