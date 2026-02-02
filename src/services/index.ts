/**
 * Service layer exports
 * Application-wide state management and I/O operations
 */

export * from './types'

// Import and re-export classes
export { SettingsManager } from './SettingsManager'
export { ThemeManager } from './ThemeManager'
export { IOService } from './IOService'
export { TabManager } from './TabManager'

// Import singleton instances
import { settingsManager } from './SettingsManager'
import { themeManager } from './ThemeManager'
import { ioService } from './IOService'
import { tabManager } from './TabManager'

// Re-export singleton instances
export { settingsManager, themeManager, ioService, tabManager }

// Convenience object for accessing all services
export const services = {
  settingsManager,
  themeManager,
  ioService,
  tabManager,
} as const
