import { useEffect, useState, useCallback } from 'react';
import { Store } from '@tauri-apps/plugin-store';

export interface AppSettings {
  // Auto-copy settings
  autoCopyOnChange: boolean;
  
  // Color presets (7 colors)
  colorPresets: string[];
  
  // Tool defaults
  defaultTool: 'pen' | 'highlighter' | 'area';
  defaultPenSize: number;
  defaultMarkerSize: number;
  defaultPenOpacity: number;
  defaultMarkerOpacity: number;
  defaultMarkerBorderRadius: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoCopyOnChange: false,
  colorPresets: [
    '#FFB3BA', // Pastel Red
    '#FFDFBA', // Pastel Orange
    '#FFFFBA', // Pastel Yellow
    '#BAFFC9', // Pastel Green
    '#BAE1FF', // Pastel Blue
    '#E2BAFF', // Pastel Purple
    '#FFB3E6', // Pastel Pink
  ],
  defaultTool: 'pen',
  defaultPenSize: 3,
  defaultMarkerSize: 20,
  defaultPenOpacity: 1,
  defaultMarkerOpacity: 0.4,
  defaultMarkerBorderRadius: 0,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [store, setStore] = useState<Store | null>(null);

  // Load store on mount
  useEffect(() => {
    let mounted = true;
    
    const initStore = async () => {
      try {
        const storeInstance = await Store.load('settings.json');
        if (!mounted) return;
        
        setStore(storeInstance);
        
        // Load saved settings
        const saved = await storeInstance.get<AppSettings>('appSettings');
        if (saved && mounted) {
          setSettings({ ...DEFAULT_SETTINGS, ...saved });
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        if (mounted) {
          setIsLoaded(true);
        }
      }
    };
    
    initStore();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    if (!isLoaded || !store) return;
    
    const saveSettings = async () => {
      try {
        await store.set('appSettings', settings);
        await store.save();
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    };
    
    saveSettings();
  }, [settings, isLoaded, store]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateColorPreset = useCallback((index: number, color: string) => {
    setSettings(prev => {
      const newPresets = [...prev.colorPresets];
      newPresets[index] = color;
      return { ...prev, colorPresets: newPresets };
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    isLoaded,
    updateSettings,
    updateColorPreset,
    resetSettings,
  };
}
