import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { services } from "~/services";
import { CloseWindowBehaviors, type AppSettings } from "~/types/settings";

/**
 * Hook to handle window management (close behavior, tray interactions)
 */
export function useWindowManagement(settings: AppSettings): void {
  // Handle window close behavior
  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested(
      async (event) => {
        if (
          settings.miscSettings.closeWindowBehavior ===
          CloseWindowBehaviors.MINIMIZE_TO_TRAY
        ) {
          event.preventDefault();
          await invoke("minimize_to_tray");
          console.log("Window minimized to tray");
        } else {
          console.log("Window closing, exiting app");
        }
      },
    );

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [settings.miscSettings.closeWindowBehavior]);

  // Listen for tray right-click to open file dialog
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen("tray-open-file", () => {
        services.ioService.openFile().then(async (result) => {
          if (result) {
            await invoke("restore_from_tray");
            const blob = new Blob([result.fileData]);
            const url = URL.createObjectURL(blob);
            services.tabManager.createDocument(result.filePath, undefined, url);
          }
        });
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
}
