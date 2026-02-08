/**
 * SettingsContext - Bridges SettingsManager with React
 */

import { listen } from "@tauri-apps/api/event";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { settingsManager, windowManager } from "~/services";
import type { AppSettings } from "~/types/settings";

type SettingsContextValue = {
  settings: AppSettings;
  hasChanges: boolean;
  isLoaded: boolean;
  isOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  updateDraft: (updates: Partial<AppSettings>) => void;
  save: () => Promise<boolean>;
  cancel: () => void;
  reset: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsProviderProps = {
  children: React.ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(
    settingsManager.settings,
  );
  const [hasChanges, setHasChanges] = useState<boolean>(
    settingsManager.hasChanges,
  );
  const [isLoaded, setIsLoaded] = useState<boolean>(settingsManager.loaded);
  const [isOpen, setIsOpen] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initial load
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!settingsManager.loaded) {
        await settingsManager.load();
      }
      if (mounted) {
        setSettings({ ...settingsManager.settings });
        setHasChanges(settingsManager.hasChanges);
        setIsLoaded(settingsManager.loaded);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to settings changes
  useEffect(() => {
    unsubscribeRef.current = settingsManager.on("settingsChanged", () => {
      setSettings({ ...settingsManager.settings });
      setHasChanges(settingsManager.hasChanges);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Listen for settings-saved event from settings window (cross-window communication)
  // This ensures settings are applied immediately without requiring a restart
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<AppSettings>("settings-saved", async () => {
        // Reload settings from disk to get the latest saved values
        await settingsManager.load();
        setSettings({ ...settingsManager.settings });
        setHasChanges(settingsManager.hasChanges);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const updateDraft = useCallback((updates: Partial<AppSettings>) => {
    settingsManager.updateDraft(updates);
  }, []);

  const save = useCallback(async () => {
    return await settingsManager.save();
  }, []);

  const cancel = useCallback(async () => {
    settingsManager.cancel();
    await windowManager.closeSettings();
  }, []);

  const reset = useCallback(() => {
    settingsManager.resetToDefaults();
  }, []);

  const openSettings = useCallback(async () => {
    await windowManager.openSettings();
  }, []);

  const closeSettings = useCallback(async () => {
    await windowManager.closeSettings();
    setIsOpen(false);
  }, []);

  const value: SettingsContextValue = {
    settings,
    hasChanges,
    isLoaded,
    isOpen,
    openSettings,
    closeSettings,
    updateDraft,
    save,
    cancel,
    reset,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export { SettingsContext };
