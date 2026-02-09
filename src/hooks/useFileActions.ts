/**
 * @file File Actions Hook
 * @description Provides file operation handlers (open, save, copy) with centralized
 * user feedback and canvas integration for image annotation workflows.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCanvasEngine } from "~/contexts/CanvasEngineContext";
import { services } from "~/services";
import { registerPendingCopy } from "./useClipboardEvents";
import { toast } from "sonner";

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

  const handleSave = useCallback(async (): Promise<boolean> => {
    const activeDoc = services.tabManager.getActiveDocument();
    const currentEngine = engineRef.current;

    if (!activeDoc || !currentEngine) {
      toast.error("Failed to save file");
      return false;
    }

    const canvas = currentEngine.getFreshCombinedCanvas();
    if (!canvas) {
      toast.error("Failed to save file");
      return false;
    }

    const defaultPath = activeDoc.filePath || "annotated-image.png";
    const success = await services.ioService.saveImage(canvas, defaultPath);

    if (success) {
      activeDoc.markAsChanged(false);
      toast.success("File saved successfully", { duration: 2000 });
      return true;
    } else {
      toast.error("Failed to save file");
      return false;
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