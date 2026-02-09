// ============================================================================
// THEME UTILITIES
// ============================================================================

import { DEFAULT_THEME } from "~/services/Theme";
import { Theme, ThemeConfig } from "~/types/theme";
import { toHslString } from "./colors";

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
    themes: partial.themes || DEFAULT_THEME.themes,
    palettes: partial.palettes || DEFAULT_THEME.palettes,
  };
}
