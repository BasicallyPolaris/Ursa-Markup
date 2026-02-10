import { useEffect } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { services } from "~/services";
import { isImageFile } from "~/utils/file";

/**
 * Hook to handle file operations (CLI files, single-instance file listening)
 */
export function useFileHandling(): void {
  useEffect(() => {
    const openFilesFromCLI = async (filePaths: string[]) => {
      const hasImages = filePaths.some(isImageFile);

      for (const filePath of filePaths) {
        try {
          const fileData = await services.ioService.readFile(filePath);
          const blob = new Blob([fileData]);
          const url = URL.createObjectURL(blob);
          services.tabManager.createDocument(filePath, undefined, url);
        } catch (error) {
          console.error("Failed to open CLI file:", filePath, error);
          toast.error(`Could not open file: ${filePath}`);
        }
      }

      // Restore from tray if images were received via CLI and setting is enabled
      if (hasImages && services.settingsManager.settings.miscSettings.restoreFromTrayOnCliImage) {
        try {
          await invoke("restore_from_tray");
        } catch (error) {
          console.error("Failed to restore from tray:", error);
        }
      }
    };

    const setupListener = async () => {
      return await services.ioService.listenForFiles((filePaths) => {
        openFilesFromCLI(filePaths);
      });
    };

    const checkPendingFiles = async () => {
      const pendingFiles = await services.ioService.getPendingFiles();
      if (pendingFiles.length > 0) {
        await openFilesFromCLI(pendingFiles);
      }
    };

    const unlistenPromise = setupListener();
    checkPendingFiles();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
}
