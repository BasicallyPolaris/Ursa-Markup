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
    const restoreFromTrayForCLIImage = async () => {
      if (
        !services.settingsManager.settings.miscSettings
          .restoreFromTrayOnCliImage
      ) {
        return;
      }

      try {
        await invoke("restore_from_tray");
      } catch (error) {
        console.error("Failed to restore from tray:", error);
      }
    };

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
      if (hasImages) {
        await restoreFromTrayForCLIImage();
      }
    };

    const openPendingStdinImages = async () => {
      const batch = await services.ioService.getPendingStdinImages();

      for (const error of batch.errors) {
        console.error(error);
        toast.error(error);
      }

      for (const image of batch.images) {
        const imageSrc = `data:${image.mime_type};base64,${image.data_base64}`;
        services.tabManager.createDocument(
          undefined,
          image.file_name,
          imageSrc,
        );
      }

      if (batch.images.length > 0) {
        await restoreFromTrayForCLIImage();
      }
    };

    const setupListeners = async () => {
      return Promise.all([
        services.ioService.listenForFiles((filePaths) => {
          void openFilesFromCLI(filePaths);
        }),
        services.ioService.listenForStdinImages(openPendingStdinImages),
      ]);
    };

    const checkPendingInput = async () => {
      const pendingFiles = await services.ioService.getPendingFiles();
      if (pendingFiles.length > 0) {
        await openFilesFromCLI(pendingFiles);
      }
      await openPendingStdinImages();
    };

    // Register listeners before draining startup input so a second invocation
    // cannot land in the gap between those two operations.
    const unlistenPromise = setupListeners().then(async (unlistenFunctions) => {
      await checkPendingInput();
      return unlistenFunctions;
    });

    return () => {
      void unlistenPromise.then((unlistenFunctions) => {
        for (const unlisten of unlistenFunctions) {
          unlisten();
        }
      });
    };
  }, []);
}
