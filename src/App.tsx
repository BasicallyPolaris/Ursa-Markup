import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CanvasContainer } from "./components/canvas/CanvasContainer";
import { CloseTabDialog } from "./components/tabs/CloseTabDialog";
import { TabBar } from "./components/tabs/TabBar";
import { Toolbar } from "./components/toolbar/Toolbar";
import { Toaster } from "./components/ui/sonner";
import {
  CanvasEngineProvider,
  DocumentProvider,
  DrawingProvider,
  SettingsProvider,
  TabManagerProvider,
  ThemeProvider,
  useTabManager,
} from "./contexts";
import { useKeyboardShortcuts, useWindowTitle } from "./hooks";
import { useClipboardEvents } from "./hooks/useClipboardEvents";
import { services } from "./services";
import { CloseWindowBehaviors, type AppSettings } from "./types/settings";

type AppContentProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasContainerRef: RefObject<HTMLDivElement | null>;
};

function DocumentContentInner({
  canvasContainerRef,
}: {
  canvasContainerRef: RefObject<HTMLDivElement | null>;
}) {
  useKeyboardShortcuts();
  useWindowTitle();

  return (
    <>
      <Toolbar />
      <TabBar />
      <CloseTabDialog />
      <CanvasContainer className="flex-1" containerRef={canvasContainerRef} />
    </>
  );
}

function DocumentContent({
  canvasContainerRef,
}: {
  canvasContainerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <DrawingProvider>
      <DocumentContentInner canvasContainerRef={canvasContainerRef} />
    </DrawingProvider>
  );
}

function GlobalKeyboardShortcuts() {
  const { addTab, activeDocumentId, documents, closeTab } = useTabManager();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "o":
            e.preventDefault();
            services.ioService.openFile().then((result) => {
              if (result) {
                const blob = new Blob([result.fileData]);
                const url = URL.createObjectURL(blob);
                services.tabManager.createDocument(
                  result.filePath,
                  undefined,
                  url,
                );
              }
            });
            break;
          case "t":
            e.preventDefault();
            addTab();
            break;
          case "w":
            if (documents.length > 1 && activeDocumentId) {
              e.preventDefault();
              closeTab(activeDocumentId);
            }
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [addTab, activeDocumentId, documents.length, closeTab]);

  return null;
}

function EmptyStateContentInner({
  canvasContainerRef,
}: {
  canvasContainerRef: RefObject<HTMLDivElement | null>;
}) {
  useWindowTitle();

  return (
    <>
      <GlobalKeyboardShortcuts />
      <Toolbar />
      <TabBar />
      <CloseTabDialog />
      <CanvasContainer className="flex-1" containerRef={canvasContainerRef} />
    </>
  );
}

function EmptyStateContent({
  canvasContainerRef,
}: {
  canvasContainerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <DrawingProvider>
      <EmptyStateContentInner canvasContainerRef={canvasContainerRef} />
    </DrawingProvider>
  );
}

function AppContent({ containerRef, canvasContainerRef }: AppContentProps) {
  const { activeDocument } = useTabManager();

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg"
    >
      {activeDocument ? (
        <DocumentProvider key={activeDocument.id} document={activeDocument}>
          <CanvasEngineProvider
            containerRef={canvasContainerRef}
            document={activeDocument}
          >
            <DocumentContent canvasContainerRef={canvasContainerRef} />
          </CanvasEngineProvider>
        </DocumentProvider>
      ) : (
        <EmptyStateContent canvasContainerRef={canvasContainerRef} />
      )}
    </div>
  );
}

/**
 * App - Root component
 * Initializes services and sets up context providers
 */
function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<AppSettings>(
    services.settingsManager.settings,
  );

  useClipboardEvents();

  // Initialize services on mount
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          services.settingsManager.load(),
          services.themeManager.load(),
        ]);

        services.tabManager.loadInitialState();

        const savedSettings = services.settingsManager.settings;
        setSettings({ ...savedSettings });
      } catch (error) {
        console.error("Failed to initialize services:", error);
      } finally {
        await getCurrentWindow().show();
      }
    };

    init();
  }, []);

  // Subscribe to settings changes for theme updates
  useEffect(() => {
    const unsubscribe = services.settingsManager.on("settingsChanged", () => {
      setSettings({ ...services.settingsManager.settings });
    });
    return () => unsubscribe();
  }, []);

  // Handle CLI file opening (initial launch + single-instance)
  useEffect(() => {
    const openFilesFromCLI = async (filePaths: string[]) => {
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

  // Listen for settings applied events from settings window
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<AppSettings>(
        "settings-applied",
        (event) => {
          const savedSettings = event.payload;
          services.themeManager.setTheme(savedSettings.activeTheme);
          services.settingsManager.load().then(() => {
            setSettings({ ...services.settingsManager.settings });
          });
        },
      );
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

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

  // Apply theme when theme changes
  useEffect(() => {
    services.themeManager.setTheme(settings.activeTheme);
  }, [settings.activeTheme]);

  return (
    <SettingsProvider>
      <ThemeProvider>
        <TabManagerProvider>
          <DrawingProvider>
            <AppContent
              containerRef={containerRef}
              canvasContainerRef={canvasContainerRef}
            />
            <Toaster />
          </DrawingProvider>
        </TabManagerProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
