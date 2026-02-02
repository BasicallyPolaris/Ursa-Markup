import { useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useTabManager } from '../contexts/TabManagerContext';
import { useDocument } from '../contexts/DocumentContext';
import { useCanvasEngine } from '../contexts/CanvasEngineContext';
import { useDrawing } from '../contexts/DrawingContext';
import { services } from '../services';
import type { Tool } from '../core/types';

/**
 * useKeyboardShortcuts consolidates all keyboard shortcuts
 * Provides global keyboard handling for the application
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            handleOpen();
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'r':
            e.preventDefault();
            handleToggleRuler();
            break;
          case '=':
          case '+':
            e.preventDefault();
            handleZoomIn();
            break;
          case '-':
            e.preventDefault();
            handleZoomOut();
            break;
          case '0':
            e.preventDefault();
            // fitToWindow requires container dimensions, handled by component
            console.log('Fit to window shortcut');
            break;
          case 't':
            e.preventDefault();
            addTab();
            break;
          case 'w':
            if (documents.length > 1 && activeDocumentId) {
              e.preventDefault();
              closeTab(activeDocumentId);
            }
            break;
          case 'tab':
            e.preventDefault();
            if (e.shiftKey) {
              switchToPreviousTab();
            } else {
              switchToNextTab();
            }
            break;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
            e.preventDefault();
            const colorIndex = parseInt(e.key) - 1;
            handleColorChange(colorIndex);
            break;
        }
      } else {
        switch (e.key) {
          case '1':
            handleToolChange('pen');
            break;
          case '2':
            handleToolChange('highlighter');
            break;
          case '3':
            handleToolChange('area');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
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
    closeTab,
    activeDocumentId,
    documents.length,
    switchToNextTab,
    switchToPreviousTab,
    handleToolChange,
    handleColorChange
  ]);
}
