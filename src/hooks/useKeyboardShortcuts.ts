/**
 * @file Keyboard Shortcuts & File Actions
 * @description Manages global keyboard shortcuts with high-performance Ref-based
 * dispatching to prevent listener churn during canvas operations.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useCanvasEngine } from "~/contexts/CanvasEngineContext";
import { useDocument } from "~/contexts/DocumentContext";
import { useDrawing } from "~/contexts/DrawingContext";
import { useSettings } from "~/contexts/SettingsContext";
import { useTabManager } from "~/contexts/TabManagerContext";
import { services } from "~/services";
import { DEFAULT_HOTKEYS } from "~/services/Settings/config";
import type { HotkeyAction, HotkeySettings } from "~/types/settings";
import { Tools } from "~/types/tools";
import { formatHotkey, matchesHotkey } from "~/utils/hotkeys";
import { registerPendingCopy } from "./useClipboardEvents";

// -----------------------------------------------------------------------------
// Hotkey Display Hooks
// -----------------------------------------------------------------------------

export function useHotkeyDisplay(action: HotkeyAction): string {
  const { settings } = useSettings();
  const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;
  return useMemo(() => formatHotkey(hotkeys[action]), [hotkeys, action]);
}

export function useHotkeys(): HotkeySettings {
  const { settings } = useSettings();
  return settings.hotkeys || DEFAULT_HOTKEYS;
}

// -----------------------------------------------------------------------------
// File Actions Hook
// -----------------------------------------------------------------------------

export function useFileActions() {
  const { engine } = useCanvasEngine();
  const engineRef = useRef(engine);

  // Keep engine ref fresh
  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

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
      registerPendingCopy(version, false);
      const { copySettings } = services.settingsManager.settings;

      await services.ioService.copyToClipboard(canvas, version, {
        force: true,
        isAutoCopy: false,
        format: copySettings.manualCopyFormat,
        jpegQuality: copySettings.manualCopyJpegQuality,
      });
    }
  }, []);

  return useMemo(
    () => ({ handleOpen, handleSave, handleCopy }),
    [handleOpen, handleSave, handleCopy],
  );
}

// -----------------------------------------------------------------------------
// Global Keyboard Manager
// -----------------------------------------------------------------------------

export function useKeyboardShortcuts(): void {
  const { settings } = useSettings();

  // 1. Grab all contexts
  const tabManager = useTabManager();
  const documentContext = useDocument();
  const drawingContext = useDrawing();
  const canvasContext = useCanvasEngine();
  const fileActions = useFileActions();

  // 2. Create a "Latest State" Ref
  // We store all current handlers/values in a ref.
  // This allows the Event Listener to be STABLE (created once)
  // while still accessing the freshest state (Zoom, Undo, etc.)
  const stateRef = useRef({
    settings,
    tabManager,
    documentContext,
    drawingContext,
    canvasContext,
    fileActions,
  });

  // 3. Keep the Ref synchronized with every render
  useLayoutEffect(() => {
    stateRef.current = {
      settings,
      tabManager,
      documentContext,
      drawingContext,
      canvasContext,
      fileActions,
    };
  });

  // 4. Stable Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Access latest state from Ref
      const current = stateRef.current;
      const {
        settings,
        documentContext,
        drawingContext,
        canvasContext,
        tabManager,
        fileActions,
      } = current;

      const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;

      // Define Actions implementation
      // We define this INSIDE the handler so it always uses the variables from `current`
      const executeAction = (action: HotkeyAction) => {
        switch (action) {
          // File
          case "file.open":
            return fileActions.handleOpen();
          case "file.save":
            return fileActions.handleSave();
          case "file.copy":
            return fileActions.handleCopy();

          // Edit
          case "edit.undo":
            return documentContext.undo();
          case "edit.redo":
            return documentContext.redo();

          // Tools
          case "tool.pen":
            return drawingContext.switchTool(Tools.PEN);
          case "tool.highlighter":
            return drawingContext.switchTool(Tools.HIGHLIGHTER);
          case "tool.area":
            return drawingContext.switchTool(Tools.AREA);
          case "tool.eraser":
            return drawingContext.switchTool(Tools.ERASER);

          // Colors
          case "color.1":
          case "color.2":
          case "color.3":
          case "color.4":
          case "color.5":
          case "color.6":
          case "color.7": {
            // Extract index from "color.N" (1-based to 0-based)
            const idx = parseInt(action.split(".")[1]) - 1;
            const color = settings.activePaletteColors[idx];
            if (color) drawingContext.setActiveColor(color);
            return;
          }

          // View
          case "nav.ruler":
            return documentContext.toggleRuler();
          case "nav.zoomIn":
            return canvasContext.setZoom(Math.min(5, canvasContext.zoom * 1.2));
          case "nav.zoomOut":
            return canvasContext.setZoom(
              Math.max(0.1, canvasContext.zoom / 1.2),
            );
          case "nav.fitToWindow":
            return canvasContext.fitToWindow();
          case "nav.stretchToFill":
            return canvasContext.stretchToFill();
          case "nav.centerImage":
            return canvasContext.centerImage();

          // Tabs
          case "tab.new":
            return tabManager.addTab();
          case "tab.close":
            if (tabManager.documents.length > 1) {
              if (tabManager.activeDocumentId)
                tabManager.closeTab(tabManager.activeDocumentId);
            }
            return;
          case "tab.next":
            return tabManager.switchToNextTab();
          case "tab.previous":
            return tabManager.switchToPreviousTab();
        }
      };

      // Match and Execute
      for (const [actionKey, binding] of Object.entries(hotkeys)) {
        if (!binding.key) continue;
        if (matchesHotkey(e, binding)) {
          e.preventDefault();
          executeAction(actionKey as HotkeyAction);
          return;
        }
      }
    };

    // Attach ONCE
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
