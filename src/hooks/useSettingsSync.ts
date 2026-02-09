import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { services } from "~/services";
import type { AppSettings } from "~/types/settings";

/**
 * Hook to handle settings synchronization and theme updates
 */
export function useSettingsSync(
  settings: AppSettings,
  setSettings: (settings: AppSettings) => void,
): void {
  // Subscribe to settings changes for theme updates
  useEffect(() => {
    const unsubscribe = services.settingsManager.on("settingsChanged", () => {
      setSettings({ ...services.settingsManager.settings });
    });
    return () => unsubscribe();
  }, [setSettings]);

  // Listen for settings applied events from settings window
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<AppSettings>(
        "settings-applied",
        (event) => {
          const savedSettings = event.payload;
          services.themeManager.setTheme(savedSettings.activeTheme);
          services.settingsManager.load().then(() => {
            setSettings({ ...services.settingsManager.settings });
          });
        },
      );
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setSettings]);

  // Apply theme when theme changes
  useEffect(() => {
    services.themeManager.setTheme(settings.activeTheme);
  }, [settings.activeTheme]);
}
