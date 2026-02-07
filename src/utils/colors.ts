// ============================================================================
// COLOR UTILITIES
// ============================================================================

import { ColorFormat } from "~/types/theme";

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
