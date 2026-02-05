/**
 * Service layer types
 */

export type CloseTabBehavior = "prompt" | "auto-save" | "discard";
export type ImageOpenBehavior = "center" | "fit";

// Hotkey action identifiers
export type HotkeyAction =
  // File operations
  | "file.open"
  | "file.save"
  | "file.copy"
  // Edit operations
  | "edit.undo"
  | "edit.redo"
  // Tool selection
  | "tool.pen"
  | "tool.marker"
  | "tool.area"
  // Quick colors
  | "color.1"
  | "color.2"
  | "color.3"
  | "color.4"
  | "color.5"
  | "color.6"
  | "color.7"
  // Navigation
  | "nav.ruler"
  | "nav.zoomIn"
  | "nav.zoomOut"
  | "nav.fitToWindow"
  | "nav.stretchToFill"
  | "nav.centerImage"
  // Tabs
  | "tab.new"
  | "tab.close"
  | "tab.next"
  | "tab.previous";

// Hotkey definition
export interface HotkeyBinding {
  key: string; // The main key (lowercase)
  ctrl?: boolean; // Ctrl/Cmd modifier
  shift?: boolean; // Shift modifier
  alt?: boolean; // Alt modifier
}

// Serialized format for storage
export type HotkeySettings = Record<HotkeyAction, HotkeyBinding>;

// Default hotkey bindings
export const DEFAULT_HOTKEYS: HotkeySettings = {
  // File operations
  "file.open": { key: "o", ctrl: true },
  "file.save": { key: "s", ctrl: true },
  "file.copy": { key: "c", ctrl: true },
  // Edit operations
  "edit.undo": { key: "z", ctrl: true },
  "edit.redo": { key: "z", ctrl: true, shift: true },
  // Tool selection (no modifiers)
  "tool.pen": { key: "1" },
  "tool.marker": { key: "2" },
  "tool.area": { key: "3" },
  // Quick colors (Ctrl + number)
  "color.1": { key: "1", ctrl: true },
  "color.2": { key: "2", ctrl: true },
  "color.3": { key: "3", ctrl: true },
  "color.4": { key: "4", ctrl: true },
  "color.5": { key: "5", ctrl: true },
  "color.6": { key: "6", ctrl: true },
  "color.7": { key: "7", ctrl: true },
  // Navigation
  "nav.ruler": { key: "r", ctrl: true },
  "nav.zoomIn": { key: "=", ctrl: true },
  "nav.zoomOut": { key: "-", ctrl: true },
  "nav.fitToWindow": { key: "f", ctrl: true, alt: true },
  "nav.stretchToFill": { key: "f", ctrl: true },
  "nav.centerImage": { key: "c", ctrl: true, alt: true },
  // Tabs
  "tab.new": { key: "t", ctrl: true },
  "tab.close": { key: "w", ctrl: true },
  "tab.next": { key: "tab", ctrl: true },
  "tab.previous": { key: "tab", ctrl: true, shift: true },
};

// Helper to format a hotkey for display
export function formatHotkey(binding: HotkeyBinding | undefined): string {
  // Handle undefined or unbound hotkeys
  if (!binding || !binding.key || binding.key === "") {
    return "Unbound";
  }

  const parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");

  // Format the key nicely
  let keyDisplay = binding.key;
  if (keyDisplay === " ") keyDisplay = "Space";
  else if (keyDisplay === "tab") keyDisplay = "Tab";
  else if (keyDisplay === "escape") keyDisplay = "Esc";
  else if (keyDisplay === "enter") keyDisplay = "Enter";
  else if (keyDisplay === "arrowup") keyDisplay = "↑";
  else if (keyDisplay === "arrowdown") keyDisplay = "↓";
  else if (keyDisplay === "arrowleft") keyDisplay = "←";
  else if (keyDisplay === "arrowright") keyDisplay = "→";
  else if (keyDisplay === "=") keyDisplay = "+";
  else keyDisplay = keyDisplay.toUpperCase();

  parts.push(keyDisplay);
  return parts.join("+");
}

// Helper to check if a keyboard event matches a hotkey binding
export function matchesHotkey(
  event: KeyboardEvent,
  binding: HotkeyBinding,
): boolean {
  const key = event.key.toLowerCase();
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  return (
    key === binding.key &&
    ctrlOrMeta === !!binding.ctrl &&
    event.shiftKey === !!binding.shift &&
    event.altKey === !!binding.alt
  );
}

export type AutoCopyFormat = "png" | "jpeg";

export interface AppSettings {
  theme: string;
  selectedPalette: string;
  autoCopyOnChange: boolean;
  autoCopyFormat: AutoCopyFormat;
  autoCopyJpegQuality: number;
  autoCopyShowToast: boolean;
  manualCopyFormat: AutoCopyFormat;
  manualCopyJpegQuality: number;
  colorPresets: string[];
  defaultTool: "pen" | "highlighter" | "area";
  defaultPenSize: number;
  defaultMarkerSize: number;
  defaultPenOpacity: number;
  defaultMarkerOpacity: number;
  defaultMarkerBorderRadius: number;
  defaultMarkerBlendMode: "normal" | "multiply";
  defaultPenBlendMode: "normal" | "multiply";
  defaultAreaOpacity: number;
  defaultAreaBorderRadius: number;
  defaultAreaBorderWidth: number;
  defaultAreaBlendMode: "normal" | "multiply";
  blendMode: "normal" | "multiply";
  closeTabBehavior: CloseTabBehavior;
  imageOpenBehavior: ImageOpenBehavior;
  showDebugInfo: boolean;
  hotkeys: HotkeySettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  selectedPalette: "default",
  autoCopyOnChange: true,
  autoCopyFormat: "jpeg",
  autoCopyJpegQuality: 0.85,
  autoCopyShowToast: false,
  manualCopyFormat: "png",
  manualCopyJpegQuality: 0.95,
  colorPresets: [
    "#FF6B6B",
    "#FF9F43",
    "#FFE066",
    "#6BCB77",
    "#4D96FF",
    "#9B59B6",
    "#FF6B9D",
  ],
  defaultTool: "pen",
  defaultPenSize: 3,
  defaultMarkerSize: 20,
  defaultPenOpacity: 1,
  defaultMarkerOpacity: 1,
  defaultMarkerBorderRadius: 4,
  defaultMarkerBlendMode: "multiply",
  defaultPenBlendMode: "normal",
  defaultAreaOpacity: 1,
  defaultAreaBorderRadius: 0,
  defaultAreaBorderWidth: 0,
  defaultAreaBlendMode: "multiply",
  blendMode: "normal",
  closeTabBehavior: "prompt",
  imageOpenBehavior: "fit",
  showDebugInfo: false,
  hotkeys: DEFAULT_HOTKEYS,
};

// Import theme types from their sources
import type { ColorPalette } from "../types";
import type { ThemeConfig, ThemeColors, Theme } from "../lib/theme";

// Re-export for convenience
export type { ColorPalette, ThemeConfig, ThemeColors, Theme };

// Event listener types
export type EventCallback<T = void> = (payload: T) => void;

export interface ServiceEvents {
  settingsChanged: AppSettings;
  settingsSaved: AppSettings;
  themeLoaded: Theme;
  documentChanged: { id: string };
  activeDocumentChanged: { id: string | null };
  documentClosed: { id: string };
  documentAdded: { id: string };
}
