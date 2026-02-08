/**
 * Service layer exports
 * Application-wide state management and I/O operations
 */
// Import and re-export classes
export { IOService } from "./IOService";
export { SettingsManager } from "./Settings/SettingsManager";
export { TabManager } from "./TabManager";
export { ThemeManager } from "./Theme/ThemeManager";
export { WindowManager } from "./WindowManager";

// Import singleton instances
import { ioService } from "./IOService";
import { settingsManager } from "./Settings/SettingsManager";
import { tabManager } from "./TabManager";
import { themeManager } from "./Theme/ThemeManager";
import { windowManager } from "./WindowManager";

// Re-export singleton instances
export { ioService, settingsManager, tabManager, themeManager, windowManager };

// Convenience object for accessing all services
export const services = {
  settingsManager,
  themeManager,
  ioService,
  tabManager,
  windowManager,
} as const;
