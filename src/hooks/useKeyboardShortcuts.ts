/**
 * @file Keyboard Shortcuts & File Actions
 * @description Manages global keyboard shortcuts, hotkey display logic, and core
 * file operations (Open, Save, Copy). Acts as the central registry for binding
 * user inputs to application state changes.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCanvasEngine } from "~/contexts/CanvasEngineContext";
import { useDocument } from "~/contexts/DocumentContext";
import { useDrawing } from "~/contexts/DrawingContext";
import { useSettings } from "~/contexts/SettingsContext";
import { useTabManager } from "~/contexts/TabManagerContext";
import { services } from "~/services";
import { DEFAULT_HOTKEYS } from "~/services/Settings/config";
import type { HotkeyAction, HotkeySettings } from "~/types/settings";
import { Tool, Tools } from "~/types/tools";
import { formatHotkey, matchesHotkey } from "~/utils/hotkeys";
import { registerPendingCopy } from "./useClipboardEvents";

// -----------------------------------------------------------------------------
// Hotkey Display Hooks
// -----------------------------------------------------------------------------

/**
 * Retrieves the formatted display string for a specific hotkey action.
 * Useful for UI tooltips and menu items (e.g., "Ctrl+S").
 *
 * @param action - The identifier of the action to look up.
 * @returns The formatted hotkey string.
 */
export function useHotkeyDisplay(action: HotkeyAction): string {
  const { settings } = useSettings();
  const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;
  return useMemo(() => formatHotkey(hotkeys[action]), [hotkeys, action]);
}

/**
 * Retrieves the full map of current hotkey bindings.
 */
export function useHotkeys(): HotkeySettings {
  const { settings } = useSettings();
  return settings.hotkeys || DEFAULT_HOTKEYS;
}

// -----------------------------------------------------------------------------
// File Actions Hook
// -----------------------------------------------------------------------------

/**
 * Provides handlers for core file operations: Open, Save, and Copy.
 * These handlers abstract the logic for interacting with the CanvasEngine
 * and IOService, making them reusable for both keyboard shortcuts and UI buttons.
 */
export function useFileActions() {
  const { engine } = useCanvasEngine();

  // Use a ref to access the latest engine instance within callbacks
  // without forcing re-creation of the handlers on every render.
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

    const canvas = currentEngine.getFreshCombinedCanvas();
    if (!canvas) return;

    const defaultPath = activeDoc.filePath || "annotated-image.png";
    const success = await services.ioService.saveImage(canvas, defaultPath);

    if (success) {
      activeDoc.markAsChanged(false);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const activeDoc = services.tabManager.getActiveDocument();
    const currentEngine = engineRef.current;

    if (!currentEngine || !activeDoc) return;

    const canvas = currentEngine.getFreshCombinedCanvas();
    if (canvas) {
      const version = activeDoc.version;

      // Register intent to copy (handled by useClipboardEvents)
      registerPendingCopy(version, false);

      // Retrieve latest copy preferences directly to ensure freshness
      const { copySettings } = services.settingsManager.settings;

      await services.ioService.copyToClipboard(canvas, version, {
        force: true, // Manual copy always forces an update
        isAutoCopy: false,
        format: copySettings.manualCopyFormat,
        jpegQuality: copySettings.manualCopyJpegQuality,
      });
    }
  }, []);

  return { handleOpen, handleSave, handleCopy };
}

// -----------------------------------------------------------------------------
// Global Keyboard Manager
// -----------------------------------------------------------------------------

/**
 * centralized registry for all application keyboard shortcuts.
 * * Maps hotkey definitions (from settings) to specific handler functions.
 * Listens for global `keydown` events and executes the matching action.
 */
export function useKeyboardShortcuts(): void {
  const { settings } = useSettings();

  // Context Consumers
  const tabManager = useTabManager();
  const documentContext = useDocument();
  const drawingContext = useDrawing();
  const canvasContext = useCanvasEngine();
  const fileActions = useFileActions();

  // Action Handlers
  // Wrapped in useCallbacks to maintain stable references for the effect dependency array

  const handleUndo = useCallback(
    () => documentContext.undo(),
    [documentContext],
  );
  const handleRedo = useCallback(
    () => documentContext.redo(),
    [documentContext],
  );
  const handleToggleRuler = useCallback(
    () => documentContext.toggleRuler(),
    [documentContext],
  );

  const handleToolChange = useCallback(
    (tool: Tool) => {
      drawingContext.switchTool(tool);
    },
    [drawingContext],
  );

  const handleColorChange = useCallback(
    (index: number) => {
      const color = settings.activePaletteColors[index];
      if (color) {
        drawingContext.setActiveColor(color);
      }
    },
    [settings.activePaletteColors, drawingContext],
  );

  const handleZoomIn = useCallback(() => {
    canvasContext.setZoom(Math.min(5, canvasContext.zoom * 1.2));
  }, [canvasContext]);

  const handleZoomOut = useCallback(() => {
    canvasContext.setZoom(Math.max(0.1, canvasContext.zoom / 1.2));
  }, [canvasContext]);

  const handleCloseTab = useCallback(() => {
    const { documents, activeDocumentId, closeTab } = tabManager;
    if (documents.length > 1 && activeDocumentId) {
      closeTab(activeDocumentId);
    }
  }, [tabManager]);

  // Event Listener Setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore input fields to prevent blocking typing
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Action Registry
      // Maps configuration keys to executable functions
      const actionMap: Record<HotkeyAction, (() => void) | null> = {
        // File Operations
        "file.open": fileActions.handleOpen,
        "file.save": fileActions.handleSave,
        "file.copy": fileActions.handleCopy,

        // Edit Operations
        "edit.undo": handleUndo,
        "edit.redo": handleRedo,

        // Tools
        "tool.pen": () => handleToolChange(Tools.PEN),
        "tool.highlighter": () => handleToolChange(Tools.HIGHLIGHTER),
        "tool.area": () => handleToolChange(Tools.AREA),
        "tool.eraser": () => handleToolChange(Tools.ERASER),

        // Colors
        "color.1": () => handleColorChange(0),
        "color.2": () => handleColorChange(1),
        "color.3": () => handleColorChange(2),
        "color.4": () => handleColorChange(3),
        "color.5": () => handleColorChange(4),
        "color.6": () => handleColorChange(5),
        "color.7": () => handleColorChange(6),

        // Navigation & View
        "nav.ruler": handleToggleRuler,
        "nav.zoomIn": handleZoomIn,
        "nav.zoomOut": handleZoomOut,
        "nav.fitToWindow": canvasContext.fitToWindow,
        "nav.stretchToFill": canvasContext.stretchToFill,
        "nav.centerImage": canvasContext.centerImage,

        // Tab Management
        "tab.new": tabManager.addTab,
        "tab.close": tabManager.documents.length > 1 ? handleCloseTab : null,
        "tab.next": tabManager.switchToNextTab,
        "tab.previous": tabManager.switchToPreviousTab,
      };

      const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;

      // Iterate through defined hotkeys and execute match
      for (const [actionKey, binding] of Object.entries(hotkeys)) {
        const action = actionKey as HotkeyAction;

        // Skip unbound or invalid keys
        if (!binding.key) continue;

        if (matchesHotkey(e, binding)) {
          const handler = actionMap[action];
          if (handler) {
            e.preventDefault();
            handler();
            return; // Execute only the first matching action
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    // Dependencies are extensive to ensure closure freshness
    settings.hotkeys,
    fileActions,
    handleUndo,
    handleRedo,
    handleToggleRuler,
    handleToolChange,
    handleColorChange,
    handleZoomIn,
    handleZoomOut,
    handleCloseTab,
    canvasContext.fitToWindow,
    canvasContext.stretchToFill,
    canvasContext.centerImage,
    tabManager.addTab,
    tabManager.switchToNextTab,
    tabManager.switchToPreviousTab,
    tabManager.documents.length, // Required for tab closing logic
  ]);
}
