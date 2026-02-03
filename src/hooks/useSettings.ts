import { useEffect, useState, useCallback, useRef } from 'react';
import { Store } from '@tauri-apps/plugin-store';

export type CloseTabBehavior = 'prompt' | 'auto-save' | 'discard';

export interface AppSettings {
  autoCopyOnChange: boolean;
  colorPresets: string[];
  defaultTool: 'pen' | 'highlighter' | 'area';
  defaultPenSize: number;
  defaultMarkerSize: number;
  defaultPenOpacity: number;
  defaultMarkerOpacity: number;
  defaultMarkerBorderRadius: number;
  defaultMarkerBlendMode: 'normal' | 'multiply';
  defaultPenBlendMode: 'normal' | 'multiply';
  defaultAreaOpacity: number;
  defaultAreaBorderRadius: number;
  defaultAreaBorderWidth: number;
  defaultAreaBorderEnabled: boolean;
  defaultAreaBlendMode: 'normal' | 'multiply';
  blendMode: 'normal' | 'multiply';
  closeTabBehavior: CloseTabBehavior;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoCopyOnChange: true,
  colorPresets: [
    '#FF6B6B',
    '#FF9F43',
    '#FFE066',
    '#6BCB77',
    '#4D96FF',
    '#9B59B6',
    '#FF6B9D',
  ],
  defaultTool: 'pen',
  defaultPenSize: 3,
  defaultMarkerSize: 20,
  defaultPenOpacity: 1,
  defaultMarkerOpacity: 1,
  defaultMarkerBorderRadius: 4,
  defaultMarkerBlendMode: 'multiply',
  defaultPenBlendMode: 'normal',
  defaultAreaOpacity: 1,
  defaultAreaBorderRadius: 0,
  defaultAreaBorderWidth: 2,
  defaultAreaBorderEnabled: false,
  defaultAreaBlendMode: 'multiply',
  blendMode: 'normal',
  closeTabBehavior: 'prompt',
};

export function useSettings() {
  const [savedSettings, setSavedSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const storeRef = useRef<Store | null>(null);

  // Load settings on mount
  useEffect(() => {
    let mounted = true;
    
    const initStore = async () => {
      try {
        const storeInstance = await Store.load('settings.json');
        if (!mounted) return;
        
        storeRef.current = storeInstance;
        
        const saved = await storeInstance.get<AppSettings>('appSettings');
        if (saved && mounted) {
          const merged = { ...DEFAULT_SETTINGS, ...saved };
          setSavedSettings(merged);
          setDraftSettings(merged);
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

  // Update draft settings (doesn't save to disk)
  const updateDraft = useCallback((updates: Partial<AppSettings>) => {
    setDraftSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateColorPreset = useCallback((index: number, color: string) => {
    setDraftSettings(prev => {
      const newPresets = [...prev.colorPresets];
      newPresets[index] = color;
      return { ...prev, colorPresets: newPresets };
    });
  }, []);

  // Save draft to disk
  const saveSettings = useCallback(async () => {
    if (!storeRef.current) return false;
    
    try {
      await storeRef.current.set('appSettings', draftSettings);
      await storeRef.current.save();
      setSavedSettings(draftSettings);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }, [draftSettings]);

  // Cancel changes - revert draft to saved
  const cancelChanges = useCallback(() => {
    setDraftSettings(savedSettings);
  }, [savedSettings]);

  // Reset to defaults (doesn't save to disk - user must press Save)
  const resetToDefaults = useCallback(() => {
    setDraftSettings(DEFAULT_SETTINGS);
  }, []);

  const hasChanges = JSON.stringify(savedSettings) !== JSON.stringify(draftSettings);

  return {
    settings: draftSettings,
    savedSettings,
    isLoaded,
    hasChanges,
    updateDraft,
    updateColorPreset,
    saveSettings,
    cancelChanges,
    resetToDefaults,
  };
}
