import {
  BlendModes,
  EraseModes,
  Tools,
  type AreaToolConfig,
  type EraserToolConfig,
  type HighlighterToolConfig,
  type PenToolConfig,
  type ToolConfigs,
} from "~/types/tools";

import {
  AutoCopyFormats,
  CloseTabBehaviors,
  CloseWindowBehaviors,
  ImageOpenBehaviors,
  type AppSettings,
  type HotkeySettings,
} from "~/types/settings";

/**
 * SUB-CONFIG: Tool Defaults
 */
const DEFAULT_PEN_CONFIG: PenToolConfig = {
  tool: Tools.PEN,
  size: 3,
  opacity: 100,
  blendMode: BlendModes.NORMAL,
};

const DEFAULT_HIGHLIGHTER_CONFIG: HighlighterToolConfig = {
  tool: Tools.HIGHLIGHTER,
  size: 20,
  opacity: 100,
  blendMode: BlendModes.MULTIPLY,
};

const DEFAULT_AREA_CONFIG: AreaToolConfig = {
  tool: Tools.AREA,
  opacity: 100,
  blendMode: BlendModes.MULTIPLY,
  borderRadius: 0,
};

const DEFAULT_ERASER_CONFIG: EraserToolConfig = {
  tool: Tools.ERASER,
  size: 20,
  eraserMode: EraseModes.FULL_STROKE,
};

/* Default tool configuration */
const DEFAULT_TOOL_CONFIGS: ToolConfigs = {
  [Tools.PEN]: DEFAULT_PEN_CONFIG,
  [Tools.HIGHLIGHTER]: DEFAULT_HIGHLIGHTER_CONFIG,
  [Tools.AREA]: DEFAULT_AREA_CONFIG,
  [Tools.ERASER]: DEFAULT_ERASER_CONFIG,
} as const;

/* Default values for the configuration of tools in Toolbar / Settings */
export const TOOL_SETTINGS_CONSTANTS = {
  [Tools.PEN]: {
    minSize: 1,
    maxSize: 40,
    sizeStep: 1,
    minOpacity: 10,
    maxOpacity: 100,
    opacityStep: 10,
  },
  [Tools.HIGHLIGHTER]: {
    minSize: 1,
    maxSize: 40,
    sizeStep: 1,
    minOpacity: 10,
    maxOpacity: 100,
    opacityStep: 10,
  },
  [Tools.AREA]: {
    minRadius: 0,
    maxRadius: 50,
    radiusStep: 1,
    minOpacity: 10,
    maxOpacity: 100,
    opacityStep: 10,
  },
  [Tools.ERASER]: {
    minSize: 10,
    maxSize: 100,
    sizeStep: 1,
  },
} as const;

export const APP_SETTINGS_CONSTANTS = {
  APP_NAME: "Ursa Markup",
  UNSAVED_INDICATOR: "●",
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 10,
  MAX_HISTORY: 100,
} as const;

/**
 * SUB-CONFIG: Hotkeys
 */
export const DEFAULT_HOTKEYS: HotkeySettings = {
  "color.1": { key: "1", ctrl: true, shift: false, alt: false },
  "color.2": { key: "2", ctrl: true, shift: false, alt: false },
  "color.3": { key: "3", ctrl: true, shift: false, alt: false },
  "color.4": { key: "4", ctrl: true, shift: false, alt: false },
  "color.5": { key: "5", ctrl: true, shift: false, alt: false },
  "color.6": { key: "6", ctrl: true, shift: false, alt: false },
  "color.7": { key: "7", ctrl: true, shift: false, alt: false },
  "edit.redo": { key: "z", ctrl: true, shift: true, alt: false },
  "edit.undo": { key: "z", ctrl: true, shift: false, alt: false },
  "file.copy": { key: "c", ctrl: true, shift: false, alt: false },
  "file.open": { key: "o", ctrl: true, shift: false, alt: false },
  "file.paste": { key: "v", ctrl: true, shift: false, alt: false },
  "file.save": { key: "s", ctrl: true, shift: false, alt: false },
  "nav.centerImage": { key: "c", ctrl: true, shift: false, alt: true },
  "nav.fitToWindow": { key: "f", ctrl: true, shift: false, alt: true },
  "nav.ruler": { key: "r", ctrl: true, shift: false, alt: false },
  "nav.stretchToFill": { key: "f", ctrl: true, shift: false, alt: false },
  "nav.zoomIn": { key: "=", ctrl: true, shift: false, alt: false },
  "nav.zoomOut": { key: "-", ctrl: true, shift: false, alt: false },
  "tab.close": { key: "w", ctrl: true, shift: false, alt: false },
  "tab.next": { key: "tab", ctrl: true, shift: false, alt: false },
  "tab.previous": { key: "tab", ctrl: true, shift: true, alt: false },
  "tool.area": { key: "3", ctrl: false, shift: false, alt: false },
  "tool.eraser": { key: "e", ctrl: false, shift: false, alt: false },
  "tool.highlighter": { key: "2", ctrl: false, shift: false, alt: false },
  "tool.pen": { key: "1", ctrl: false, shift: false, alt: false },
};

/**
 * MAIN DEFAULT SETTINGS
 */
export const DEFAULT_SETTINGS: AppSettings = {
  activeTheme: "dark",
  activePalette: "default",
  activePaletteColors: [
    "#FF6B6B",
    "#FF9F43",
    "#FFE066",
    "#6BCB77",
    "#4D96FF",
    "#9B59B6",
    "#FF6B9D",
  ],

  toolConfigs: DEFAULT_TOOL_CONFIGS,
  hotkeys: DEFAULT_HOTKEYS,

  copySettings: {
    autoCopyFormat: AutoCopyFormats.JPEG,
    autoCopyJpegQuality: 0.7,
    autoCopyOnChange: true,
    autoCopyShowToast: false,
    manualCopyFormat: AutoCopyFormats.JPEG,
    manualCopyJpegQuality: 0.9,
  },

  miscSettings: {
    imageOpenBehavior: ImageOpenBehaviors.FIT,
    closeTabBehavior: CloseTabBehaviors.PROMPT,
    closeWindowBehavior: CloseWindowBehaviors.EXIT,
    showDebugInfo: false,
    restoreFromTrayOnCliImage: true,
  },
};
