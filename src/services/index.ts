/**
 * Service layer exports
 * Application-wide state management and I/O operations
 */
// Import and re-export classes
export { SettingsManager } from "./Settings/SettingsManager";
export { ThemeManager } from "./Theme/ThemeManager";
export { IOService } from "./IOService";
export { TabManager } from "./TabManager";
export { WindowManager } from "./WindowManager";

// Import singleton instances
import { settingsManager } from "./Settings/SettingsManager";
import { themeManager } from "./Theme/ThemeManager";
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
