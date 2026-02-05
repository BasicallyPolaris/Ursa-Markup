/**
 * SettingsApp - Root component for the Settings window
 * This runs in a separate Tauri window from the main app
 */

import { useState, useEffect, useCallback } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SettingsWindow } from "./components/settings/SettingsWindow";
import { settingsManager, themeManager } from "./services";
import type { AppSettings } from "./services/types";

function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings>(
    settingsManager.settings,
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const init = async () => {
      if (!settingsManager.loaded) {
        await settingsManager.load();
      }

      // Load theme config
      await themeManager.load();

      // Apply saved theme
      const savedSettings = settingsManager.settings;
      if (savedSettings.theme) {
        themeManager.setTheme(savedSettings.theme);
      }

      setSettings({ ...savedSettings });
      setHasChanges(settingsManager.hasChanges);
      setIsLoaded(true);
    };
    init();
  }, []);

  // Apply theme class to document when theme changes
  useEffect(() => {
    const root = document.documentElement;

    if (settings.theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [settings.theme]);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = settingsManager.on("settingsChanged", () => {
      setSettings({ ...settingsManager.settings });
      setHasChanges(settingsManager.hasChanges);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for events from main window
  useEffect(() => {
    const setupListeners = async () => {
      const unlisten = await listen("settings-sync", () => {
        // Sync settings from main window if needed
        setSettings({ ...settingsManager.settings });
        setHasChanges(settingsManager.hasChanges);
      });

      return unlisten;
    };

    const unlistenPromise = setupListeners();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const updateDraft = useCallback((updates: Partial<AppSettings>) => {
    settingsManager.updateDraft(updates);
  }, []);

  const handleSave = useCallback(async () => {
    const success = await settingsManager.save();
    if (success) {
      // Emit event to main window that settings were saved with all changes
      await emit("settings-applied", settingsManager.saved);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    settingsManager.cancel();
    // Close the window
    const currentWindow = getCurrentWindow();
    await currentWindow.close();
  }, []);

  const handleReset = useCallback(() => {
    settingsManager.resetToDefaults();
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-panel-bg">
        <div className="text-text-muted">Loading settings...</div>
      </div>
    );
  }

  return (
    <SettingsWindow
      settings={settings}
      hasChanges={hasChanges}
      updateDraft={updateDraft}
      onSave={handleSave}
      onCancel={handleCancel}
      onReset={handleReset}
    />
  );
}

export default SettingsApp;
