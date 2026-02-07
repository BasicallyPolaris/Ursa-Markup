// ============================================================================
// THEME & COLOR
// ============================================================================

export type ColorFormat = "hex" | "rgb" | "hsl";

export interface ColorPalette {
  name: string;
  colors: string[];
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
