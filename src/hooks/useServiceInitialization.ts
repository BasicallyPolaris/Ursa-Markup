import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { services } from "~/services";
import type { AppSettings } from "~/types/settings";

/**
 * Hook to handle service initialization on app startup
 */
export function useServiceInitialization(
  setSettings: (settings: AppSettings) => void,
): void {
  useEffect(() => {
    const init = async () => {
      try {
        // Load settings and theme services
        await Promise.all([
          services.settingsManager.load(),
          services.themeManager.load(),
        ]);

        // Initialize tab manager with empty document
        services.tabManager.loadInitialState();

        // Update local settings state
        const savedSettings = services.settingsManager.settings;
        setSettings({ ...savedSettings });
      } catch (error) {
        console.error("Failed to initialize services:", error);
      } finally {
        // Show window after initialization completes
        await getCurrentWindow().show();
      }
    };

    init();
  }, [setSettings]);
}
