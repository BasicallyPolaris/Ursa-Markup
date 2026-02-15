import { RefObject, useRef, useState } from "react";
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
import { useFileHandling } from "./hooks/useFileHandling";
import { useServiceInitialization } from "./hooks/useServiceInitialization";
import { useSettingsSync } from "./hooks/useSettingsSync";
import { useWindowManagement } from "./hooks/useWindowManagement";
import { services } from "./services";
import type { AppSettings } from "./types/settings";

type AppContentProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasContainerRef: RefObject<HTMLDivElement | null>;
};

function DocumentContent({
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

function AppContent({ containerRef, canvasContainerRef }: AppContentProps) {
  const { activeDocument } = useTabManager();

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg"
    >
      {activeDocument && (
        <CanvasEngineProvider
          containerRef={canvasContainerRef}
          document={activeDocument}
        >
          <DocumentProvider key={activeDocument.id} document={activeDocument}>
            <DocumentContent canvasContainerRef={canvasContainerRef} />
          </DocumentProvider>
        </CanvasEngineProvider>
      )}
    </div>
  );
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<AppSettings>(
    services.settingsManager.settings,
  );

  useClipboardEvents();
  useServiceInitialization(setSettings);
  useFileHandling();
  useSettingsSync(settings, setSettings);
  useWindowManagement(settings);

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
