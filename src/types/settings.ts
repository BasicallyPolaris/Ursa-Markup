// ============================================================================
// SETTINGS
// ============================================================================

import { ToolConfigs } from "./tools";
import { Theme } from "./theme";

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
export type HotkeyAction =
  | "color.1"
  | "color.2"
  | "color.3"
  | "color.4"
  | "color.5"
  | "color.6"
  | "color.7"
  | "edit.redo"
  | "edit.undo"
  | "file.copy"
  | "file.open"
  | "file.save"
  | "nav.centerImage"
  | "nav.fitToWindow"
  | "nav.ruler"
  | "nav.stretchToFill"
  | "nav.zoomIn"
  | "nav.zoomOut"
  | "tab.close"
  | "tab.new"
  | "tab.next"
  | "tab.previous"
  | "tool.area"
  | "tool.eraser"
  | "tool.highlighter"
  | "tool.pen";

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
