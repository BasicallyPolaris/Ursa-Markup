/**
 * @file Window Title Manager
 * @description Syncs the application window title with the active document state.
 * Handles displaying the filename, unsaved change indicators, and the application name.
 */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { useTabManager } from "~/contexts/TabManagerContext";
import { APP_SETTINGS_CONSTANTS } from "~/services/Settings/config";

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Automatically updates the Tauri window title based on the active document.
 */
export function useWindowTitle(): void {
  const { activeDocument } = useTabManager();

  const displayTitle = activeDocument?.getDisplayTitle();
  const hasChanges = activeDocument?.hasChanges;

  useEffect(() => {
    const updateTitle = async () => {
      const appWindow = getCurrentWindow();

      const newTitle = displayTitle
        ? `${hasChanges ? `${APP_SETTINGS_CONSTANTS.UNSAVED_INDICATOR} ` : ""}${displayTitle} - ${APP_SETTINGS_CONSTANTS.APP_NAME}`
        : APP_SETTINGS_CONSTANTS.APP_NAME;

      try {
        await appWindow.setTitle(newTitle);
      } catch (error) {
        console.error("Failed to update window title:", error);
      }
    };

    updateTitle();
  }, [displayTitle, hasChanges]);
}
