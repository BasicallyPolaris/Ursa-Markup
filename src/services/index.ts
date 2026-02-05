/**
 * Service layer exports
 * Application-wide state management and I/O operations
 */

export * from "./types";

// Re-export types from lib/theme
export type { Theme, ThemeConfig, ThemeColors } from "../lib/theme";

// Import and re-export classes
export { SettingsManager } from "./SettingsManager";
export { ThemeManager } from "./ThemeManager";
export { IOService } from "./IOService";
export { TabManager } from "./TabManager";
export { WindowManager } from "./WindowManager";

// Import singleton instances
import { settingsManager } from "./SettingsManager";
import { themeManager } from "./ThemeManager";
import { ioService } from "./IOService";
import { tabManager } from "./TabManager";
import { windowManager } from "./WindowManager";

// Re-export singleton instances
export { settingsManager, themeManager, ioService, tabManager, windowManager };

// Convenience object for accessing all services
export const services = {
  settingsManager,
  themeManager,
  ioService,
  tabManager,
  windowManager,
} as const;
