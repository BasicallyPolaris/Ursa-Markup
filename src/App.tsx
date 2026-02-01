import { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, PhysicalSize } from '@tauri-apps/api/window';

import { DrawingCanvas } from './components/canvas/DrawingCanvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { TabBar } from './components/tabs/TabBar';
import { CloseTabDialog } from './components/tabs/CloseTabDialog';
import { useStrokeHistory } from './hooks/useStrokeHistory';
import { useRuler } from './hooks/useRuler';
import { useClipboard } from './hooks/useClipboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { useTabs } from './hooks/useTabs';
import type { Tool, BrushSettings, Point } from './types';
import './App.css';

function App() {
  // Global toolbar settings (shared across tabs)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [brush, setBrush] = useState<BrushSettings>({
    color: '#FFB3BA',
    size: 3,
    opacity: 1,
  });

  // Hooks
  const { settings, updateDraft, updateColorPreset, saveSettings, cancelChanges, resetToDefaults, hasChanges: settingsHasChanges } = useSettings();
  const { getActivePalette } = useTheme();
  const { ruler: globalRuler, toggleRuler, rotateRuler: rotateGlobalRuler, startDragging: startRulerDrag, drag: dragRuler, stopDragging: stopRulerDrag } = useRuler();
  const { copyToClipboard, saveImage } = useClipboard();
  
  // Tab management
  const { 
    tabs, 
    activeTab, 
    activeTabId, 
    pendingCloseTab,
    addTab, 
    closeTab, 
    confirmCloseWithSave,
    confirmCloseWithoutSave,
    cancelClose,
    switchTab, 
    updateActiveTab,
    markTabAsChanged,
    switchToNextTab,
    switchToPrevTab,
  } = useTabs(settings.closeTabBehavior);

  // Per-tab stroke history instances
  const strokeHistoryInstances = useRef<Map<string, ReturnType<typeof useStrokeHistory>>>(new Map());

  // Refs
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCenteredRef = useRef(false);

  // Initialize stroke history for each tab
  const strokeHistory = useStrokeHistory();
  
  // Keep stroke history in sync with active tab
  useEffect(() => {
    strokeHistoryInstances.current.set(activeTabId, strokeHistory);
    return () => {
      // Cleanup handled in closeTab
    };
  }, [activeTabId, strokeHistory]);

  // Handle opening a file (for both CLI and dialog)
  const openFile = useCallback(async (filePath: string, switchToTab: boolean = true) => {
    try {
      console.log('Opening file:', filePath);
      const fileData = await readFile(filePath);
      const blob = new Blob([fileData], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      const lastSlash = filePath.lastIndexOf('/');
      const fileName = lastSlash > 0 ? filePath.substring(lastSlash + 1) : filePath;
      const recentDir = lastSlash > 0 ? filePath.substring(0, lastSlash) : null;

      // Add new tab with the file (reuse empty tab if current is empty)
      const newTabId = addTab(filePath, fileName, url, true);
      
      // If we reused the current tab, update it directly
      if (newTabId === activeTabId) {
        updateActiveTab({
          filePath,
          fileName,
          imageSrc: url,
          recentDir,
          zoom: 1,
          viewOffset: { x: 0, y: 0 },
          hasChanges: false,
        });
      } else {
        // Update the new tab with additional info
        updateActiveTab({
          recentDir,
          zoom: 1,
          viewOffset: { x: 0, y: 0 },
          hasChanges: false,
        });
      }

      if (switchToTab) {
        switchTab(newTabId);
      }

      return newTabId;
    } catch (error) {
      console.error('Failed to open image:', error);
      return null;
    }
  }, [addTab, updateActiveTab, switchTab]);

  // Handle open from dialog
  const handleOpen = useCallback(async () => {
    try {
      const filePath = await open({
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        multiple: false,
      });

      if (!filePath) return;
      await openFile(filePath as string);
    } catch (error) {
      console.error('Failed to open image:', error);
    }
  }, [openFile]);

  // Handle new empty tab
  const handleNewTab = useCallback(() => {
    addTab();
  }, [addTab]);

  // Handle fit to window
  const handleFitToWindow = useCallback(() => {
    if (!containerRef.current || activeTab.canvasSize.width === 0) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const padding = 40;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;
    
    const scaleX = availableWidth / activeTab.canvasSize.width;
    const scaleY = availableHeight / activeTab.canvasSize.height;
    const newZoom = Math.min(scaleX, scaleY, 1);
    const finalZoom = Math.max(0.1, newZoom);
    
    const imageScreenWidth = activeTab.canvasSize.width * finalZoom;
    const imageScreenHeight = activeTab.canvasSize.height * finalZoom;
    
    const panX = (rect.width - imageScreenWidth) / 2;
    const panY = (rect.height - imageScreenHeight) / 2;
    
    const viewOffsetX = -panX / finalZoom;
    const viewOffsetY = -panY / finalZoom;
    
    updateActiveTab({
      zoom: finalZoom,
      viewOffset: { x: viewOffsetX, y: viewOffsetY },
    });
  }, [activeTab.canvasSize, updateActiveTab]);

  const handleFitToWindowRef = useRef(handleFitToWindow);
  useEffect(() => {
    handleFitToWindowRef.current = handleFitToWindow;
  }, [handleFitToWindow]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!drawCanvasRef.current || !activeTab.imageSrc) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const baseCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!baseCanvas) return;

    tempCanvas.width = baseCanvas.width;
    tempCanvas.height = baseCanvas.height;

    tempCtx.drawImage(baseCanvas, 0, 0);
    tempCtx.drawImage(drawCanvasRef.current, 0, 0);

    const defaultPath = activeTab.recentDir 
      ? `${activeTab.recentDir}/${activeTab.fileName || 'annotated-image.png'}` 
      : (activeTab.fileName || 'annotated-image.png');
    await saveImage(tempCanvas, defaultPath);
    
    // Mark as saved
    markTabAsChanged(false);
  }, [saveImage, activeTab, markTabAsChanged]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!drawCanvasRef.current || !activeTab.imageSrc) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const baseCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!baseCanvas) return;

    tempCanvas.width = baseCanvas.width;
    tempCanvas.height = baseCanvas.height;

    tempCtx.drawImage(baseCanvas, 0, 0);
    tempCtx.drawImage(drawCanvasRef.current, 0, 0);

    await copyToClipboard(tempCanvas);
  }, [copyToClipboard, activeTab.imageSrc]);

  // Handle brush change
  const handleBrushChange = useCallback((changes: Partial<BrushSettings>) => {
    setBrush((prev) => ({ ...prev, ...changes }));
  }, []);

  // Handle tool change
  const handleToolChange = useCallback((newTool: Tool) => {
    setTool(newTool);
    if (newTool === 'pen') {
      setBrush((prev) => ({ 
        ...prev, 
        size: settings.defaultPenSize,
        opacity: settings.defaultPenOpacity 
      }));
    } else if (newTool === 'highlighter') {
      setBrush((prev) => ({ 
        ...prev, 
        size: settings.defaultMarkerSize,
        opacity: settings.defaultMarkerOpacity,
        borderRadius: settings.defaultMarkerBorderRadius
      }));
    } else if (newTool === 'area') {
      setBrush((prev) => ({ 
        ...prev, 
        opacity: 0.1 
      }));
    }
  }, [settings]);

  // Handle zoom change
  const handleZoomChange = useCallback((newZoom: number, mouseX?: number, mouseY?: number) => {
    const container = containerRef.current;
    if (!container || mouseX === undefined || mouseY === undefined) {
      updateActiveTab({ zoom: newZoom });
      return;
    }

    const rect = container.getBoundingClientRect();
    const mouseScreenX = mouseX - rect.left;
    const mouseScreenY = mouseY - rect.top;
    
    const prevZoom = activeTab.zoom;
    const canvasX = mouseScreenX / prevZoom + activeTab.viewOffset.x;
    const canvasY = mouseScreenY / prevZoom + activeTab.viewOffset.y;
    
    const newViewOffsetX = canvasX - mouseScreenX / newZoom;
    const newViewOffsetY = canvasY - mouseScreenY / newZoom;
    
    updateActiveTab({
      zoom: newZoom,
      viewOffset: { x: newViewOffsetX, y: newViewOffsetY },
    });
  }, [activeTab.zoom, activeTab.viewOffset, updateActiveTab]);

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) {
      strokeHistory.undo(canvas);
      markTabAsChanged(true);
    }
  }, [strokeHistory, markTabAsChanged]);

  const handleRedo = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) {
      strokeHistory.redo(canvas);
      markTabAsChanged(true);
    }
  }, [strokeHistory, markTabAsChanged]);

  const handleSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  // Handle ruler interactions
  const handleRulerDragStart = useCallback((point: Point) => {
    startRulerDrag(point);
  }, [startRulerDrag]);

  const handleRulerDrag = useCallback((point: Point) => {
    dragRuler(point);
  }, [dragRuler]);

  const handleRulerDragEnd = useCallback(() => {
    stopRulerDrag();
  }, [stopRulerDrag]);

  const handleRulerRotate = useCallback((delta: number) => {
    rotateGlobalRuler(delta);
  }, [rotateGlobalRuler]);

  // Handle stroke events
  const handleStartStrokeGroup = useCallback(() => {
    strokeHistory.startStrokeGroup();
  }, [strokeHistory]);

  const handleStartStroke = useCallback((tool: Tool, brush: BrushSettings, point: Point) => {
    strokeHistory.startStroke(tool, brush, point);
  }, [strokeHistory]);

  const handleAddPointToStroke = useCallback((point: Point) => {
    strokeHistory.addPointToStroke(point);
  }, [strokeHistory]);

  const handleEndStrokeGroup = useCallback(() => {
    strokeHistory.endStrokeGroup();
    markTabAsChanged(true);
  }, [strokeHistory, markTabAsChanged]);

  // Handle view offset change
  const handleViewOffsetChange = useCallback((offset: { x: number; y: number }) => {
    updateActiveTab({ viewOffset: offset });
  }, [updateActiveTab]);

  // Handle canvas size change
  const handleCanvasSizeChange = useCallback((size: { width: number; height: number }) => {
    updateActiveTab({ canvasSize: size });
  }, [updateActiveTab]);

  // Handle close tab confirmation
  const handleCloseWithSave = useCallback(async () => {
    // Save the pending tab
    if (pendingCloseTab) {
      await handleSave();
      const tabId = confirmCloseWithSave();
      if (tabId) {
        // Close was handled by confirmCloseWithSave
      }
    }
  }, [pendingCloseTab, handleSave, confirmCloseWithSave]);

  const handleCloseWithoutSave = useCallback(() => {
    confirmCloseWithoutSave();
  }, [confirmCloseWithoutSave]);

  const handleCancelClose = useCallback(() => {
    cancelClose();
  }, [cancelClose]);

  // Keyboard shortcuts
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
            toggleRuler();
            break;
          case '=':
          case '+':
            e.preventDefault();
            handleZoomChange(Math.min(5, activeTab.zoom * 1.2));
            break;
          case '-':
            e.preventDefault();
            handleZoomChange(Math.max(0.1, activeTab.zoom / 1.2));
            break;
          case '0':
            e.preventDefault();
            handleFitToWindowRef.current();
            break;
          case 't':
            e.preventDefault();
            handleNewTab();
            break;
          case 'w':
            if (tabs.length > 1) {
              e.preventDefault();
              closeTab(activeTabId);
            }
            break;
          case 'tab':
            e.preventDefault();
            if (e.shiftKey) {
              switchToPrevTab();
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
            if (colorIndex < settings.colorPresets.length) {
              handleBrushChange({ color: settings.colorPresets[colorIndex] });
            }
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
  }, [handleOpen, handleSave, handleCopy, handleUndo, handleRedo, toggleRuler, handleToolChange, handleZoomChange, handleNewTab, closeTab, activeTabId, tabs.length, switchToNextTab, switchToPrevTab, activeTab.zoom, settings.colorPresets, handleBrushChange]);

  // CLI: single-instance (open-file event) + initial launch (get_pending_file from backend)
  useEffect(() => {
    const unlistenSingleInstance = listen('open-file', (event) => {
      const payload = event.payload as { file_path: string };
      if (payload?.file_path) {
        openFile(payload.file_path);
      }
    });

    const openPendingFile = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        const pendingFile = await invoke<string | null>('get_pending_file');
        if (pendingFile) {
          await openFile(pendingFile);
        }
      } catch {
        // No pending file or backend not ready
      }
    };
    openPendingFile();

    return () => {
      unlistenSingleInstance.then(fn => fn());
    };
  }, [openFile]);

  // Update window title when active tab changes
  useEffect(() => {
    const updateTitle = async () => {
      const currentWindow = getCurrentWindow();
      const title = activeTab.fileName 
        ? `${activeTab.fileName}${activeTab.hasChanges ? ' ●' : ''} - OmniMark` 
        : 'OmniMark';
      console.log('Setting window title:', title);
      await currentWindow.setTitle(title);
    };
    updateTitle();
  }, [activeTab.fileName, activeTab.hasChanges]);

  // Update window size when active tab image changes
  useEffect(() => {
    if (!activeTab.imageSrc) {
      hasCenteredRef.current = false;
      strokeHistory.clearHistory();
      return;
    }
    
    strokeHistory.clearHistory();

    const img = new Image();
    img.onload = () => {
      updateActiveTab({ 
        canvasSize: { width: img.width, height: img.height },
      });
      
      const padding = 80;
      const width = Math.min(img.width + padding, globalThis.window.screen.availWidth * 0.95);
      const height = Math.min(img.height + padding + 80, globalThis.window.screen.availHeight * 0.95);

      const currentWindow = getCurrentWindow();
      const physicalSize = new PhysicalSize(Math.round(width), Math.round(height));
      currentWindow.setSize(physicalSize);
      
      setTimeout(() => {
        if (!hasCenteredRef.current) {
          hasCenteredRef.current = true;
          handleFitToWindowRef.current();
        }
      }, 150);
    };
    img.src = activeTab.imageSrc;
  }, [activeTab.imageSrc, activeTabId]);

  // Reset centering when switching tabs
  useEffect(() => {
    hasCenteredRef.current = false;
    // Clear stroke history when switching tabs
    strokeHistory.clearHistory();
  }, [activeTabId, strokeHistory.clearHistory]);

  // Get canvas ref
  useEffect(() => {
    const canvas = document.querySelector('canvas:nth-of-type(2)') as HTMLCanvasElement;
    if (canvas) {
      drawCanvasRef.current = canvas;
    }
  }, [activeTab.imageSrc]);

  // Get the active color palette from theme
  const activePalette = getActivePalette();

  // Build ruler state for active tab
  const activeRuler = {
    ...globalRuler,
    x: activeTab.rulerPosition.x,
    y: activeTab.rulerPosition.y,
    angle: activeTab.rulerPosition.angle,
  };

  return (
    <div ref={containerRef} className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg">
      <Toolbar
        tool={tool}
        onToolChange={handleToolChange}
        brush={brush}
        onBrushChange={handleBrushChange}
        ruler={activeRuler}
        onToggleRuler={toggleRuler}
        canUndo={strokeHistory.canUndo}
        canRedo={strokeHistory.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpen={handleOpen}
        onSave={handleSave}
        onCopy={handleCopy}
        onSettings={handleSettings}
        hasImage={!!activeTab.imageSrc}
        zoom={activeTab.zoom}
        onZoomChange={handleZoomChange}
        onFitToWindow={handleFitToWindow}
        palette={activePalette}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={switchTab}
        onCloseTab={closeTab}
        onAddTab={handleNewTab}
      />

      <SettingsPanel
        settings={settings}
        hasChanges={settingsHasChanges}
        onUpdateDraft={updateDraft}
        onUpdateColorPreset={updateColorPreset}
        onSave={saveSettings}
        onCancel={cancelChanges}
        onReset={resetToDefaults}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <CloseTabDialog
        isOpen={!!pendingCloseTab}
        fileName={pendingCloseTab?.tabName || null}
        onSave={handleCloseWithSave}
        onDiscard={handleCloseWithoutSave}
        onCancel={handleCancelClose}
      />

      <DrawingCanvas
        imageSrc={activeTab.imageSrc}
        tool={tool}
        brush={brush}
        ruler={activeRuler}
        zoom={activeTab.zoom}
        viewOffset={activeTab.viewOffset}
        canvasSize={activeTab.canvasSize}
        onZoomChange={handleZoomChange}
        onViewOffsetChange={handleViewOffsetChange}
        onCanvasSizeChange={handleCanvasSizeChange}
        onRulerDragStart={handleRulerDragStart}
        onRulerDrag={handleRulerDrag}
        onRulerDragEnd={handleRulerDragEnd}
        onRulerRotate={handleRulerRotate}
        onStartStrokeGroup={handleStartStrokeGroup}
        onStartStroke={handleStartStroke}
        onAddPointToStroke={handleAddPointToStroke}
        onEndStrokeGroup={handleEndStrokeGroup}
        className="flex-1"
      />
    </div>
  );
}

export default App;
