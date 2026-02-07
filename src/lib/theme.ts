/**
 * Theme system for OmniMark
 *
 * Provides centralized color management with support for multiple color formats (HEX, RGB, HSL).
 * Colors are converted to HSL for CSS variable compatibility.
 */

import type { ColorPalette } from "../types";
// Import JSON defaults as the canonical theme data
import defaultConfigData from "./default-config.json";

// ============================================================================
// TYPES
// ============================================================================

export type ColorFormat = "hex" | "rgb" | "hsl";

export interface ColorDefinition {
  /** Color value in any supported format */
  value: string;
  /** Optional format hint (auto-detected if not provided) */
  format?: ColorFormat;
}

export interface ThemeColors {
  // Application backgrounds
  app: {
    background: string;
    foreground: string;
  };
  // Toolbar styling
  toolbar: {
    background: string;
    backgroundSecondary: string;
    border: string;
  };
  // Panel/Dialog styling
  panel: {
    background: string;
    border: string;
  };
  // Surface elements (buttons, inputs)
  surface: {
    background: string;
    backgroundHover: string;
    backgroundActive: string;
  };
  // Text colors
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  // Interactive elements
  accent: {
    primary: string;
    primaryForeground: string;
    hover: string;
  };
  // Toggle states
  toggle: {
    checked: string;
    unchecked: string;
  };
  // Canvas area
  canvas: {
    background: string;
    pattern: string;
  };
  // Ruler styling
  ruler: {
    background: string;
    border: string;
    tick: string;
    tickMajor: string;
    text: string;
    centerBackground: string;
    centerBorder: string;
    compass: string;
  };
  // Status and feedback colors
  status: {
    success: string;
    successForeground: string;
    warning: string;
    warningForeground: string;
    unsaved: string;
  };
  // Overlay/Backdrop
  overlay: string;
  // Slider colors
  slider: {
    track: string;
    indicator: string;
    thumbBorder: string;
  };
  // Shadow color
  shadow: string;
  // Accent hover variations
  accentHover: {
    primary: string;
  };
}

/** A single theme definition */
export interface Theme {
  /** Unique identifier for the theme */
  name: string;
  /** Display label for the theme */
  label: string;
  /** Optional description */
  description?: string;
  /** Color definitions for the UI */
  colors: ThemeColors;
}

/** Complete theme configuration containing both themes and palettes */
export interface ThemeConfig {
  /** Available themes */
  themes: Theme[];
  /** Color palettes for drawing tools (independent of themes) */
  palettes: ColorPalette[];
}

// ============================================================================
// COLOR CONVERSION UTILITIES
// ============================================================================

/**
 * Detects the color format from a string
 */
export function detectColorFormat(color: string): ColorFormat {
  const trimmed = color.trim().toLowerCase();

  if (trimmed.startsWith("#")) return "hex";
  if (trimmed.startsWith("rgb")) return "rgb";
  if (trimmed.startsWith("hsl")) return "hsl";

  // Default to hex for 3, 4, 6, or 8 character strings without prefix
  if (/^[0-9a-f]{3,8}$/i.test(trimmed)) return "hex";

  // Check for space-separated HSL format: "h s% l%" or "h s% l% / alpha"
  // e.g., "0 0% 78%" or "0 70% 45% / 0.5"
  const hslParts = trimmed.split(/\s+/);
  if (hslParts.length >= 3) {
    const h = parseInt(hslParts[0], 10);
    const s = parseInt(hslParts[1].replace("%", ""), 10);
    const l = parseInt(hslParts[2].replace("%", ""), 10);
    if (
      !isNaN(h) &&
      !isNaN(s) &&
      !isNaN(l) &&
      s >= 0 &&
      s <= 100 &&
      l >= 0 &&
      l <= 100
    ) {
      return "hsl";
    }
  }

  throw new Error(`Unable to detect color format for: ${color}`);
}

/**
 * Parses a HEX color to RGB components
 * Supports: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let normalized = hex.trim().toLowerCase();

  // Remove # prefix
  if (normalized.startsWith("#")) {
    normalized = normalized.slice(1);
  }

  // Expand shorthand (e.g., #abc -> #aabbcc)
  if (normalized.length === 3 || normalized.length === 4) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }

  // Parse components
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`Invalid HEX color: ${hex}`);
  }

  return { r, g, b };
}

/**
 * Parses an RGB/RGBA color string
 * Supports: rgb(r, g, b), rgba(r, g, b, a)
 */
export function rgbToRgb(rgb: string): { r: number; g: number; b: number } {
  const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) {
    throw new Error(`Invalid RGB color: ${rgb}`);
  }

  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  };
}

/**
 * Parses an HSL/HSLA color string
 * Supports: hsl(h, s%, l%), hsla(h, s%, l%, a), and space-separated CSS format: "h s% l%"
 */
export function hslToHsl(hsl: string): { h: number; s: number; l: number } {
  // Try standard hsl() format first: hsl(0, 0%, 78%)
  const match = hsl.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/i);
  if (match) {
    return {
      h: parseInt(match[1], 10),
      s: parseInt(match[2], 10),
      l: parseInt(match[3], 10),
    };
  }

  // Try space-separated CSS variable format: "0 0% 78%" or "0 0% 78% / alpha"
  const parts = hsl.trim().split(/\s+/);
  if (parts.length >= 3) {
    const h = parseInt(parts[0], 10);
    const s = parseInt(parts[1].replace("%", ""), 10);
    const l = parseInt(parts[2].replace("%", ""), 10);
    if (!isNaN(h) && !isNaN(s) && !isNaN(l)) {
      return { h, s, l };
    }
  }

  throw new Error(`Invalid HSL color: ${hsl}`);
}

/**
 * Converts RGB to HSL
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / diff + 2) / 6;
        break;
      case b:
        h = ((r - g) / diff + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts any color format to HSL string for CSS
 */
export function toHslString(color: string): string {
  const format = detectColorFormat(color);
  let hsl: { h: number; s: number; l: number };

  switch (format) {
    case "hex": {
      const rgb = hexToRgb(color);
      hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      break;
    }
    case "rgb": {
      const rgb = rgbToRgb(color);
      hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      break;
    }
    case "hsl": {
      hsl = hslToHsl(color);
      break;
    }
    default:
      throw new Error(`Unsupported color format: ${format}`);
  }

  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

/**
 * Converts a color to RGBA string for canvas usage
 */
export function toRgbaString(color: string, alpha: number = 1): string {
  const format = detectColorFormat(color);
  let rgb: { r: number; g: number; b: number };

  switch (format) {
    case "hex":
      rgb = hexToRgb(color);
      break;
    case "rgb":
      rgb = rgbToRgb(color);
      break;
    case "hsl": {
      const hsl = hslToHsl(color);
      // Convert HSL to RGB for canvas
      const s = hsl.s / 100;
      const l = hsl.l / 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((hsl.h / 60) % 2) - 1));
      const m = l - c / 2;

      let r = 0,
        g = 0,
        b = 0;

      if (hsl.h < 60) {
        r = c;
        g = x;
      } else if (hsl.h < 120) {
        r = x;
        g = c;
      } else if (hsl.h < 180) {
        g = c;
        b = x;
      } else if (hsl.h < 240) {
        g = x;
        b = c;
      } else if (hsl.h < 300) {
        r = x;
        b = c;
      } else {
        r = c;
        b = x;
      }

      rgb = {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
      };
      break;
    }
    default:
      throw new Error(`Unsupported color format: ${format}`);
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_CONFIG: ThemeConfig = defaultConfigData as ThemeConfig;

/** Get the default theme (dark) */
export function getDefaultTheme(): Theme {
  return DEFAULT_CONFIG.themes[0] || DEFAULT_CONFIG.themes[0];
}

/** Get a theme by name */
export function getThemeByName(name: string): Theme | undefined {
  return DEFAULT_CONFIG.themes.find((t) => t.name === name);
}

// ============================================================================
// THEME APPLICATION
// ============================================================================

/**
 * Applies theme colors to CSS custom properties
 */
export function applyThemeToCss(theme: Theme): void {
  const root = document.documentElement;
  const { colors } = theme;

  // Helper to set CSS variable
  const setVar = (name: string, value: string) => {
    root.style.setProperty(name, toHslString(value));
  };

  // App colors
  setVar("--app-bg", colors.app.background);
  setVar("--app-fg", colors.app.foreground);

  // Toolbar colors
  setVar("--toolbar-bg", colors.toolbar.background);
  setVar("--toolbar-bg-secondary", colors.toolbar.backgroundSecondary);
  setVar("--toolbar-border", colors.toolbar.border);

  // Panel colors
  setVar("--panel-bg", colors.panel.background);
  setVar("--panel-border", colors.panel.border);

  // Surface colors
  setVar("--surface-bg", colors.surface.background);
  setVar("--surface-bg-hover", colors.surface.backgroundHover);
  setVar("--surface-bg-active", colors.surface.backgroundActive);

  // Text colors
  setVar("--text-primary", colors.text.primary);
  setVar("--text-secondary", colors.text.secondary);
  setVar("--text-muted", colors.text.muted);

  // Accent colors
  setVar("--accent-primary", colors.accent.primary);
  setVar("--accent-primary-fg", colors.accent.primaryForeground);
  setVar("--accent-hover", colors.accent.hover);

  // Toggle colors
  setVar("--toggle-checked", colors.toggle.checked);
  setVar("--toggle-unchecked", colors.toggle.unchecked);

  // Canvas colors
  setVar("--canvas-bg", colors.canvas.background);
  setVar("--canvas-pattern", colors.canvas.pattern);

  // Ruler colors
  setVar("--ruler-bg", colors.ruler.background);
  setVar("--ruler-border", colors.ruler.border);
  setVar("--ruler-tick", colors.ruler.tick);
  setVar("--ruler-tick-major", colors.ruler.tickMajor);
  setVar("--ruler-text", colors.ruler.text);
  setVar("--ruler-center-bg", colors.ruler.centerBackground);
  setVar("--ruler-center-border", colors.ruler.centerBorder);
  setVar("--ruler-compass", colors.ruler.compass);

  // Status colors
  if (colors.status) {
    setVar("--success", colors.status.success);
    setVar("--success-foreground", colors.status.successForeground);
    setVar("--warning", colors.status.warning);
    setVar("--warning-foreground", colors.status.warningForeground);
    setVar("--status-unsaved", colors.status.unsaved);
  }

  // Overlay
  if (colors.overlay) {
    setVar("--overlay", colors.overlay);
  }

  // Slider colors
  if (colors.slider) {
    setVar("--slider-track", colors.slider.track);
    setVar("--slider-indicator", colors.slider.indicator);
    setVar("--slider-thumb-border", colors.slider.thumbBorder);
  }

  // Shadow color
  if (colors.shadow) {
    setVar("--shadow-color", colors.shadow);
  }

  // Accent hover
  if (colors.accentHover) {
    setVar("--accent-primary-hover", colors.accentHover.primary);
  }

  // shadcn/ui base variables - map from our theme system
  setVar("--background", colors.app.background);
  setVar("--foreground", colors.app.foreground);
  setVar("--card", colors.panel.background);
  setVar("--card-foreground", colors.text.primary);
  setVar("--popover", colors.panel.background);
  setVar("--popover-foreground", colors.text.primary);
  setVar("--primary", colors.accent.primary);
  setVar("--primary-foreground", colors.accent.primaryForeground);
  setVar("--secondary", colors.surface.background);
  setVar("--secondary-foreground", colors.text.primary);
  setVar("--muted", colors.surface.background);
  setVar("--muted-foreground", colors.text.muted);
  setVar("--accent", colors.surface.background);
  setVar("--accent-foreground", colors.text.primary);
  setVar("--destructive", "#ef4444");
  setVar("--destructive-foreground", "#ffffff");
  setVar("--border", colors.toolbar.border);
  setVar("--input", colors.toolbar.border);
  setVar("--ring", colors.accent.primary);
}

/**
 * Validates theme structure and returns validation result
 */
export function validateTheme(partial: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!partial || typeof partial !== "object") {
    return { valid: false, errors: ["Theme must be an object"] };
  }

  const theme = partial as Record<string, unknown>;

  // Validate colors structure if present
  if (theme.colors) {
    if (typeof theme.colors !== "object" || Array.isArray(theme.colors)) {
      errors.push("colors must be an object");
    } else {
      const colors = theme.colors as Record<string, unknown>;
      const requiredColorSections = [
        "app",
        "toolbar",
        "panel",
        "surface",
        "text",
        "accent",
        "toggle",
        "canvas",
        "ruler",
      ];

      for (const section of requiredColorSections) {
        if (colors[section] && typeof colors[section] !== "object") {
          errors.push(`colors.${section} must be an object`);
        }
      }
    }
  }

  // Validate palettes if present
  if (theme.palettes) {
    if (!Array.isArray(theme.palettes)) {
      errors.push("palettes must be an array");
    } else {
      for (let i = 0; i < (theme.palettes as unknown[]).length; i++) {
        const palette = (theme.palettes as unknown[])[i];
        if (!palette || typeof palette !== "object") {
          errors.push(`palettes[${i}] must be an object`);
        } else {
          const p = palette as Record<string, unknown>;
          if (typeof p.name !== "string") {
            errors.push(`palettes[${i}].name must be a string`);
          }
          if (!Array.isArray(p.colors)) {
            errors.push(`palettes[${i}].colors must be an array`);
          }
        }
      }
    }
  }

  // Validate defaultPalette if present
  if (
    theme.defaultPalette !== undefined &&
    typeof theme.defaultPalette !== "string"
  ) {
    errors.push("defaultPalette must be a string");
  }

  // Validate tools if present
  if (theme.tools) {
    if (typeof theme.tools !== "object" || Array.isArray(theme.tools)) {
      errors.push("tools must be an object");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Merges a partial config with defaults using deep merge
 */
export function mergeConfigWithDefaults(
  partial: Partial<ThemeConfig>,
): ThemeConfig {
  // Validate the partial config
  const validation = validateTheme(partial);
  if (!validation.valid) {
    console.warn("Theme validation errors:", validation.errors);
  }

  return {
    themes: partial.themes || DEFAULT_CONFIG.themes,
    palettes: partial.palettes || DEFAULT_CONFIG.palettes,
  };
}
