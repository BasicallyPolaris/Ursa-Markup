/**
 * @file Window Title Manager
 * @description Syncs the application window title with the active document state.
 * Handles displaying the filename, unsaved change indicators, and the application name.
 */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { APP_SETTINGS_CONSTANTS } from "~/services/Settings/config";
import { useTabManager } from "../contexts/TabManagerContext";

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Automatically updates the Tauri window title based on the active document.
 */
export function useWindowTitle(): void {
  const { activeDocument } = useTabManager();

  // Extract primitive values for the dependency array.
  // This ensures the effect runs only when the visual title actually needs to change,
  // rather than on every minor internal update to the document object.
  const displayTitle = activeDocument?.getDisplayTitle();
  const hasChanges = activeDocument?.hasChanges;

  useEffect(() => {
    const updateTitle = async () => {
      const appWindow = getCurrentWindow();

      // Construct the window title
      const newTitle = displayTitle
        ? `${displayTitle}${hasChanges ? ` ${APP_SETTINGS_CONSTANTS.APP_NAME}` : ""} - ${APP_SETTINGS_CONSTANTS.UNSAVED_INDICATOR}`
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
