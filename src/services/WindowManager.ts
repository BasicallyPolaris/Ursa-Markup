/**
 * WindowManager - Handles creation and management of secondary windows
 */

import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";

type SettingsEventPayload = {
  action: "save" | "cancel" | "reset" | "update" | "close";
  data?: unknown;
};

class WindowManager {
  private settingsWindow: WebviewWindow | null = null;

  /**
   * Opens the settings window or focuses it if already open
   */
  async openSettings(): Promise<void> {
    // Check if window already exists and is valid
    const existing = await WebviewWindow.getByLabel("settings");
    if (existing) {
      await existing.setFocus();
      await existing.show();
      return;
    }

    // Create new settings window
    this.settingsWindow = new WebviewWindow("settings", {
      url: "/settings.html",
      title: "OmniMark - Settings",
      width: 650,
      height: 580,
      minWidth: 550,
      minHeight: 480,
      center: true,
      resizable: true,
      decorations: true,
      focus: true,
    });

    // Handle window close event
    this.settingsWindow.once("tauri://destroyed", () => {
      this.settingsWindow = null;
    });
  }

  /**
   * Closes the settings window
   */
  async closeSettings(): Promise<void> {
    const window = await WebviewWindow.getByLabel("settings");
    if (window) {
      await window.close();
    }
    this.settingsWindow = null;
  }

  /**
   * Emit event to settings window
   */
  async emitToSettings(payload: SettingsEventPayload): Promise<void> {
    await emit("settings-action", payload);
  }

  /**
   * Listen for settings events from settings window
   */
  async listenForSettingsEvents(
    callback: (payload: SettingsEventPayload) => void,
  ): Promise<() => void> {
    const unlisten = await listen<SettingsEventPayload>(
      "settings-action",
      (event) => {
        callback(event.payload);
      },
    );
    return unlisten;
  }

  /**
   * Check if settings window is open
   */
  async isSettingsOpen(): Promise<boolean> {
    const window = await WebviewWindow.getByLabel("settings");
    return window !== null;
  }
}

export const windowManager = new WindowManager();
export { WindowManager };
