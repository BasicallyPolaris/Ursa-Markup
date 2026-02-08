// ============================================================================
// SETTINGS
// ============================================================================

import { Theme } from "./theme";
import { ToolConfigs } from "./tools";

/**
 * BEHAVIOR ENUMS & TYPES
 */
export const CloseWindowBehaviors = {
  EXIT: "exit",
  MINIMIZE_TO_TRAY: "minimize-to-tray",
} as const;
export type CloseWindowBehavior =
  (typeof CloseWindowBehaviors)[keyof typeof CloseWindowBehaviors];

export const CloseTabBehaviors = {
  PROMPT: "prompt",
  AUTO_SAVE: "auto-save",
  DISCARD: "discard",
} as const;
export type CloseTabBehavior =
  (typeof CloseTabBehaviors)[keyof typeof CloseTabBehaviors];

export const ImageOpenBehaviors = {
  CENTER: "center",
  FIT: "fit",
} as const;
export type ImageOpenBehavior =
  (typeof ImageOpenBehaviors)[keyof typeof ImageOpenBehaviors];

export const AutoCopyFormats = {
  PNG: "png",
  JPEG: "jpeg",
} as const;
export type AutoCopyFormat =
  (typeof AutoCopyFormats)[keyof typeof AutoCopyFormats];

/**
 * HOTKEY DEFINITIONS
 */
export const HotkeyActions = {
  // Color Actions
  COLOR_1: "color.1",
  COLOR_2: "color.2",
  COLOR_3: "color.3",
  COLOR_4: "color.4",
  COLOR_5: "color.5",
  COLOR_6: "color.6",
  COLOR_7: "color.7",

  // Edit Actions
  EDIT_REDO: "edit.redo",
  EDIT_UNDO: "edit.undo",

  // File Actions
  FILE_COPY: "file.copy",
  FILE_OPEN: "file.open",
  FILE_SAVE: "file.save",

  // Navigation Actions
  NAV_CENTER_IMAGE: "nav.centerImage",
  NAV_FIT_TO_WINDOW: "nav.fitToWindow",
  NAV_RULER: "nav.ruler",
  NAV_STRETCH_TO_FILL: "nav.stretchToFill",
  NAV_ZOOM_IN: "nav.zoomIn",
  NAV_ZOOM_OUT: "nav.zoomOut",

  // Tab Actions
  TAB_CLOSE: "tab.close",
  TAB_NEW: "tab.new",
  TAB_NEXT: "tab.next",
  TAB_PREVIOUS: "tab.previous",

  // Tool Actions
  TOOL_AREA: "tool.area",
  TOOL_ERASER: "tool.eraser",
  TOOL_HIGHLIGHTER: "tool.highlighter",
  TOOL_PEN: "tool.pen",
} as const;

export type HotkeyAction = (typeof HotkeyActions)[keyof typeof HotkeyActions];

export type HotkeyBinding = {
  key: string;
  // Maps to Ctrl on Windows/Linux and Cmd on macOS
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type HotkeySettings = Record<HotkeyAction, HotkeyBinding>;

export type DrawingSettings = {};

export type CopySettings = {
  autoCopyFormat: AutoCopyFormat;
  autoCopyJpegQuality: number;
  autoCopyOnChange: boolean;
  autoCopyShowToast: boolean;
  manualCopyFormat: AutoCopyFormat;
  manualCopyJpegQuality: number;
};

export type MiscSettings = {
  imageOpenBehavior: ImageOpenBehavior;
  closeTabBehavior: CloseTabBehavior;
  closeWindowBehavior: CloseWindowBehavior;
  showDebugInfo: boolean;
};

/**
 * APP SETTINGS INTERFACE
 */
export type AppSettings = {
  activeTheme: string;
  activePalette: string;
  activePaletteColors: string[];
  toolConfigs: ToolConfigs;
  hotkeys: HotkeySettings;
  copySettings: CopySettings;
  miscSettings: MiscSettings;
};

/**
 * EVENT SYSTEM TYPES
 */
export type EventCallback<T = void> = (payload: T) => void;

export interface ServiceEvents {
  activeDocumentChanged: { id: string | null };
  documentAdded: { id: string };
  documentChanged: { id: string };
  documentClosed: { id: string };
  settingsChanged: AppSettings;
  settingsSaved: AppSettings;
  themeLoaded: Theme;
}
