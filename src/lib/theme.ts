/**
 * Theme system for OmniMark
 *
 * Provides centralized color management with support for multiple color formats (HEX, RGB, HSL).
 * Colors are converted to HSL for CSS variable compatibility.
 */

import type { ColorPalette, ToolConfig } from "../types";
// Import JSON defaults as the canonical theme data
import defaultThemeData from "./default-theme.json";

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
}

export interface ThemeConfig {
  /** Color definitions for the UI */
  colors: ThemeColors;
  /** Color palettes for drawing tools */
  palettes: ColorPalette[];
  /** Default palette name */
  defaultPalette: string;
  /** Tool configuration */
  tools: ToolConfig;
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
 * Supports: hsl(h, s%, l%), hsla(h, s%, l%, a)
 */
export function hslToHsl(hsl: string): { h: number; s: number; l: number } {
  const match = hsl.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/i);
  if (!match) {
    throw new Error(`Invalid HSL color: ${hsl}`);
  }

  return {
    h: parseInt(match[1], 10),
    s: parseInt(match[2], 10),
    l: parseInt(match[3], 10),
  };
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
// DEFAULT THEME
// ============================================================================

export const DEFAULT_THEME: ThemeConfig = defaultThemeData as ThemeConfig;

// ============================================================================
// THEME APPLICATION
// ============================================================================

/**
 * Applies theme colors to CSS custom properties
 */
export function applyThemeToCss(theme: ThemeConfig): void {
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
}

/**
 * Merges a partial theme with defaults
 */
export function mergeThemeWithDefaults(
  partial: Partial<ThemeConfig>,
): ThemeConfig {
  return {
    colors: {
      ...DEFAULT_THEME.colors,
      ...(partial.colors || {}),
    },
    palettes: partial.palettes || DEFAULT_THEME.palettes,
    defaultPalette: partial.defaultPalette || DEFAULT_THEME.defaultPalette,
    tools: {
      ...DEFAULT_THEME.tools,
      ...(partial.tools || {}),
    },
  };
}
