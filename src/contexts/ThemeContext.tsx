/**
 * ThemeContext - Bridges ThemeManager with React
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { themeManager } from "~/services";
import type { ColorPalette, Theme, ThemeConfig } from "~/types/theme";

type ThemeContextValue = {
  config: ThemeConfig;
  currentTheme: Theme;
  availableThemes: Theme[];
  availablePalettes: ColorPalette[];
  isLoading: boolean;
  error: string | null;
  setTheme: (themeName: string) => boolean;
  getActivePalette: () => ColorPalette;
  getCanvasColor: (colorPath: string, alpha?: number) => string;
  reload: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [config, setConfig] = useState<ThemeConfig>(themeManager.configData);
  const [currentTheme, setCurrentTheme] = useState<Theme>(
    themeManager.currentTheme,
  );
  const [isLoading, setIsLoading] = useState<boolean>(themeManager.loading);
  const [error, setError] = useState<string | null>(themeManager.loadError);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initial load
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!themeManager.loading) {
        await themeManager.load();
      }
      if (mounted) {
        setConfig({ ...themeManager.configData });
        setCurrentTheme(themeManager.currentTheme);
        setIsLoading(themeManager.loading);
        setError(themeManager.loadError);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to theme changes
  useEffect(() => {
    unsubscribeRef.current = themeManager.on("themeLoaded", () => {
      setConfig({ ...themeManager.configData });
      setCurrentTheme(themeManager.currentTheme);
      setIsLoading(themeManager.loading);
      setError(themeManager.loadError);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const setTheme = useCallback((themeName: string): boolean => {
    const success = themeManager.setTheme(themeName);
    if (success) {
      setCurrentTheme(themeManager.currentTheme);
    }
    return success;
  }, []);

  const getActivePalette = useCallback(() => {
    return themeManager.getActivePalette();
  }, []);

  const getCanvasColor = useCallback(
    (colorPath: string, alpha: number = 1): string => {
      return themeManager.getCanvasColor(colorPath, alpha);
    },
    [],
  );

  const reload = useCallback(async () => {
    setIsLoading(true);
    await themeManager.reload();
  }, []);

  const value: ThemeContextValue = {
    config,
    currentTheme,
    availableThemes: themeManager.availableThemes,
    availablePalettes: themeManager.availablePalettes,
    isLoading,
    error,
    setTheme,
    getActivePalette,
    getCanvasColor,
    reload,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { ThemeContext };
