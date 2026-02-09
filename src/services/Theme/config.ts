/**
 * Theme system for Ursa Markup
 *
 * Provides centralized color management with support for multiple color formats (HEX, RGB, HSL).
 * Colors are converted to HSL for CSS variable compatibility.
 */

// Import JSON defaults as the canonical theme data
import defaultConfigData from "./theme.json";
import { ThemeConfig, type Theme } from "~/types/theme";

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_THEME: ThemeConfig = defaultConfigData as ThemeConfig;

/** Get the default theme (dark) */
export function getDefaultTheme(): Theme {
  return DEFAULT_THEME.themes[0] || DEFAULT_THEME.themes[0];
}

/** Get a theme by name */
export function getThemeByName(name: string): Theme | undefined {
  return DEFAULT_THEME.themes.find((t) => t.name === name);
}
