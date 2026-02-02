import { useEffect, useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useTabManager } from '../contexts/TabManagerContext';
import { useDocument } from '../contexts/DocumentContext';
import { useCanvasEngine } from '../contexts/CanvasEngineContext';
import { useDrawing } from '../contexts/DrawingContext';
import { services } from '../services';
import type { Tool } from '../core/types';
import { matchesHotkey, formatHotkey, DEFAULT_HOTKEYS } from '../services/types';
import type { HotkeyAction, HotkeySettings } from '../services/types';

/**
 * Hook to get a formatted hotkey string for a specific action
 * Use this in UI components to display the current hotkey binding
 */
export function useHotkeyDisplay(action: HotkeyAction): string {
  const { settings } = useSettings();
  const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;
  return useMemo(() => formatHotkey(hotkeys[action]), [hotkeys, action]);
}

/**
 * Hook to get all hotkey bindings for display purposes
 */
export function useHotkeys(): HotkeySettings {
  const { settings } = useSettings();
  return settings.hotkeys || DEFAULT_HOTKEYS;
}

/**
 * useKeyboardShortcuts consolidates all keyboard shortcuts
 * Provides global keyboard handling for the application
 * Now uses customizable hotkeys from settings
 */
export function useKeyboardShortcuts() {
  const { settings } = useSettings();
  const { 
    addTab, 
    closeTab, 
    activeDocumentId, 
    documents,
    switchToNextTab,
    switchToPreviousTab
  } = useTabManager();
  
  const {
    undo,
    redo,
    toggleRuler,
  } = useDocument();

  const { setTool, updateBrush } = useDrawing();

  const {
    engine,
    zoom,
    setZoom,
    fitToWindow
  } = useCanvasEngine();

  // Get hotkeys from settings, fallback to defaults
  const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;

  const handleOpen = useCallback(async () => {
    const result = await services.ioService.openFile();
    if (result) {
      const blob = new Blob([result.fileData]);
      const url = URL.createObjectURL(blob);
      services.tabManager.createDocument(result.filePath, undefined, url);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const activeDoc = services.tabManager.getActiveDocument();
    if (!activeDoc || !engine) return;
    
    const canvas = engine.getCombinedCanvas();
    if (!canvas) return;
    
    const defaultPath = activeDoc.filePath || 'annotated-image.png';
    const success = await services.ioService.saveImage(canvas, defaultPath);
    if (success) {
      activeDoc.markAsChanged(false);
    }
  }, [engine]);

  const handleCopy = useCallback(async () => {
    if (!engine) return;
    const canvas = engine.getCombinedCanvas();
    if (canvas) {
      await services.ioService.copyToClipboard(canvas);
    }
  }, [engine]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  const handleToggleRuler = useCallback(() => {
    toggleRuler();
  }, [toggleRuler]);

  const handleToolChange = useCallback((tool: Tool) => {
    setTool(tool);
  }, [setTool]);

  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(5, zoom * 1.2));
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(0.1, zoom / 1.2));
  }, [zoom, setZoom]);

  const handleColorChange = useCallback((index: number) => {
    if (index < settings.colorPresets.length) {
      updateBrush({ color: settings.colorPresets[index] });
    }
  }, [settings.colorPresets, updateBrush]);

  const handleCloseTab = useCallback(() => {
    if (documents.length > 1 && activeDocumentId) {
      closeTab(activeDocumentId);
    }
  }, [documents.length, activeDocumentId, closeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Map hotkey actions to handlers - defined inside effect to capture current values
      const actionHandlers: Record<HotkeyAction, (() => void) | null> = {
        'file.open': handleOpen,
        'file.save': handleSave,
        'file.copy': handleCopy,
        'edit.undo': handleUndo,
        'edit.redo': handleRedo,
        'tool.pen': () => handleToolChange('pen'),
        'tool.marker': () => handleToolChange('highlighter'),
        'tool.area': () => handleToolChange('area'),
        'color.1': () => handleColorChange(0),
        'color.2': () => handleColorChange(1),
        'color.3': () => handleColorChange(2),
        'color.4': () => handleColorChange(3),
        'color.5': () => handleColorChange(4),
        'color.6': () => handleColorChange(5),
        'color.7': () => handleColorChange(6),
        'nav.ruler': handleToggleRuler,
        'nav.zoomIn': handleZoomIn,
        'nav.zoomOut': handleZoomOut,
        'nav.fitToWindow': fitToWindow,
        'tab.new': addTab,
        'tab.close': documents.length > 1 && activeDocumentId ? handleCloseTab : null,
        'tab.next': switchToNextTab,
        'tab.previous': switchToPreviousTab,
      };

      // Check each hotkey action
      for (const [action, binding] of Object.entries(hotkeys) as [HotkeyAction, typeof hotkeys[HotkeyAction]][]) {
        if (matchesHotkey(e, binding)) {
          const handler = actionHandlers[action];
          if (handler) {
            e.preventDefault();
            handler();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hotkeys,
    handleOpen,
    handleSave,
    handleCopy,
    handleUndo,
    handleRedo,
    handleToggleRuler,
    handleZoomIn,
    handleZoomOut,
    fitToWindow,
    addTab,
    handleCloseTab,
    activeDocumentId,
    documents.length,
    switchToNextTab,
    switchToPreviousTab,
    handleToolChange,
    handleColorChange
  ]);
}
