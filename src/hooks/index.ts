/**
 * Hooks exports
 * React hooks for the application
 */

// New context-based hooks
export { useKeyboardShortcuts } from './useKeyboardShortcuts'
export { useWindowTitle } from './useWindowTitle'
export { useClipboardEvents, registerPendingCopy } from './useClipboardEvents'

// Legacy hooks (to be deprecated)
export { useSettings } from './useSettings'
export { useTabs } from './useTabs'
export { usePerTabStrokeHistory } from './usePerTabStrokeHistory'
export { useStrokeHistory } from './useStrokeHistory'
export { useHistory } from './useHistory'
export { useRuler } from './useRuler'
