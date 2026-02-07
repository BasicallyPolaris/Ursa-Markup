import {
  type BlendMode,
  type ColorPalette,
  type EraseMode,
  type Tool,
} from "../types";
import type { ThemeConfig, ThemeColors, Theme } from "../lib/theme";

/**
 * RE-EXPORTS
 */
export type { ColorPalette, ThemeConfig, ThemeColors, Theme };

/**
 * BEHAVIOR ENUMS & TYPES
 */
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
  ctrl?: boolean; // Maps to Ctrl on Windows/Linux and Cmd on macOS
  shift?: boolean;
  alt?: boolean;
};

export type HotkeySettings = Record<HotkeyAction, HotkeyBinding>;

/**
 * APP SETTINGS INTERFACE
 */
export type AppSettings = {
  autoCopyFormat: AutoCopyFormat;
  autoCopyJpegQuality: number;
  autoCopyOnChange: boolean;
  autoCopyShowToast: boolean;
  blendMode: BlendMode;
  closeTabBehavior: CloseTabBehavior;
  closeWindowBehavior?: "exit" | "minimize-to-tray";
  colorPresets: string[];
  defaultColor: string;
  defaultAreaBlendMode: BlendMode;
  defaultAreaBorderRadius: number;
  defaultAreaOpacity: number;
  defaultEraseMode?: EraseMode;
  defaultEraserSize?: number;
  defaultHighlighterBlendMode: BlendMode;
  defaultHighlighterBorderRadius: number;
  defaultHighlighterOpacity: number;
  defaultHighlighterSize: number;
  defaultPenBlendMode: BlendMode;
  defaultPenOpacity: number;
  defaultPenSize: number;
  defaultTool: Tool;
  hotkeys: HotkeySettings;
  imageOpenBehavior: ImageOpenBehavior;
  manualCopyFormat: AutoCopyFormat;
  manualCopyJpegQuality: number;
  selectedPalette: string;
  showDebugInfo: boolean;
  theme: string;
};

/**
 * UTILITY HELPERS
 */

/** Converts a HotkeyBinding into a human-readable string (e.g., "Ctrl+Shift+Z") */
export function formatHotkey(binding: HotkeyBinding | undefined): string {
  if (!binding || !binding.key || binding.key === "") return "Unbound";

  const parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");

  let keyDisplay = binding.key;
  const specialKeys: Record<string, string> = {
    " ": "Space",
    tab: "Tab",
    escape: "Esc",
    enter: "Enter",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    "=": "+",
  };

  keyDisplay =
    specialKeys[keyDisplay.toLowerCase()] || keyDisplay.toUpperCase();
  parts.push(keyDisplay);

  return parts.join("+");
}

/** Compares a KeyboardEvent against a HotkeyBinding */
export function matchesHotkey(
  event: KeyboardEvent,
  binding: HotkeyBinding,
): boolean {
  const key = event.key.toLowerCase();
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  return (
    key === binding.key.toLowerCase() &&
    ctrlOrMeta === !!binding.ctrl &&
    event.shiftKey === !!binding.shift &&
    event.altKey === !!binding.alt
  );
}

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
