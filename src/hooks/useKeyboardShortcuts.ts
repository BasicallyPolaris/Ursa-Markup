import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useTabManager } from '../contexts/TabManagerContext';
import { useDocument } from '../contexts/DocumentContext';
import { useCanvasEngine } from '../contexts/CanvasEngineContext';
import { useDrawing } from '../contexts/DrawingContext';
import { services } from '../services';
import { registerPendingCopy } from './useClipboardEvents';
import type { Tool } from '../core/types';
import { matchesHotkey, formatHotkey, DEFAULT_HOTKEYS } from '../services/types';
import type { HotkeyAction, HotkeySettings, HotkeyBinding } from '../services/types';

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
 * Hook to get file action handlers (save, copy, open)
 * These can be used by both keyboard shortcuts and UI buttons
 */
export function useFileActions() {
  const { engine } = useCanvasEngine();
  // Keep engine in a ref to always have the latest reference
  const engineRef = useRef(engine);
  engineRef.current = engine;

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
    const currentEngine = engineRef.current;
    if (!activeDoc || !currentEngine) return;
    
    const canvas = currentEngine.getCombinedCanvas();
    if (!canvas) return;
    
    const defaultPath = activeDoc.filePath || 'annotated-image.png';
    const success = await services.ioService.saveImage(canvas, defaultPath);
    if (success) {
      activeDoc.markAsChanged(false);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const activeDoc = services.tabManager.getActiveDocument();
    const currentEngine = engineRef.current;
    if (!currentEngine || !activeDoc) return;
    
    const canvas = currentEngine.getCombinedCanvas();
    if (canvas) {
      const version = activeDoc.version;
      // Register as manual copy (show toast on success)
      registerPendingCopy(version, false);
      // Force copy even if version matches (user explicitly requested it)
      await services.ioService.copyToClipboard(canvas, version, { force: true, isAutoCopy: false });
    }
  }, []);

  return { handleOpen, handleSave, handleCopy };
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

  const { switchTool, updateBrush } = useDrawing();

  const {
    zoom,
    setZoom,
    fitToWindow,
    stretchToFill,
    centerImage
  } = useCanvasEngine();

  // Get file action handlers
  const { handleOpen, handleSave, handleCopy } = useFileActions();

  // Get hotkeys from settings, fallback to defaults
  const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;

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
    switchTool(tool);
  }, [switchTool]);

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
      // Skip hotkeys when typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

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
        'nav.stretchToFill': stretchToFill,
        'nav.centerImage': centerImage,
        'tab.new': addTab,
        'tab.close': documents.length > 1 && activeDocumentId ? handleCloseTab : null,
        'tab.next': switchToNextTab,
        'tab.previous': switchToPreviousTab,
      };

      // Check each hotkey action
      for (const [action, binding] of Object.entries(hotkeys) as [HotkeyAction, HotkeyBinding][]) {
        // Skip unbound hotkeys (empty key)
        if (!binding.key || binding.key === '') continue;
        
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
    stretchToFill,
    centerImage,
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
