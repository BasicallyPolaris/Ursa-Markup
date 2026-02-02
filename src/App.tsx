import { useRef, useEffect, RefObject } from 'react';
import { 
  SettingsProvider, 
  ThemeProvider,
  TabManagerProvider,
  DocumentProvider,
  CanvasEngineProvider,
  DrawingProvider,
  useTabManager
} from './contexts';
import { useKeyboardShortcuts, useWindowTitle } from './hooks';
import { services } from './services';
import { Toolbar } from './components/toolbar/Toolbar';
import { TabBar } from './components/tabs/TabBar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { CloseTabDialog } from './components/tabs/CloseTabDialog';
import { CanvasContainer } from './components/canvas/CanvasContainer';

interface AppContentProps {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasContainerRef: RefObject<HTMLDivElement | null>;
}

/**
 * DocumentContent - Component that has access to document and canvas contexts
 * Only renders when a document is active
 */
function DocumentContentInner({ canvasContainerRef }: { canvasContainerRef: RefObject<HTMLDivElement | null> }) {
  useKeyboardShortcuts();
  useWindowTitle();

  return (
    <>
      <Toolbar />
      <TabBar />
      <SettingsPanel />
      <CloseTabDialog />
      <CanvasContainer className="flex-1" containerRef={canvasContainerRef} />
    </>
  );
}

function DocumentContent({ canvasContainerRef }: { canvasContainerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <DrawingProvider>
      <DocumentContentInner canvasContainerRef={canvasContainerRef} />
    </DrawingProvider>
  );
}

/**
 * GlobalKeyboardShortcuts - Keyboard shortcuts that work even without a document
 */
function GlobalKeyboardShortcuts() {
  const { addTab, activeDocumentId, documents, closeTab } = useTabManager();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            services.ioService.openFile().then(result => {
              if (result) {
                const blob = new Blob([result.fileData]);
                const url = URL.createObjectURL(blob);
                services.tabManager.createDocument(result.filePath, undefined, url);
              }
            });
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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addTab, activeDocumentId, documents.length, closeTab]);
  
  return null;
}

/**
 * EmptyStateContent - Component shown when no document is open
 * Only uses contexts that are always available
 */
function EmptyStateContentInner({ canvasContainerRef }: { canvasContainerRef: RefObject<HTMLDivElement | null> }) {
  useWindowTitle();

  return (
    <>
      <GlobalKeyboardShortcuts />
      <Toolbar />
      <TabBar />
      <SettingsPanel />
      <CloseTabDialog />
      <CanvasContainer className="flex-1" containerRef={canvasContainerRef} />
    </>
  );
}

function EmptyStateContent({ canvasContainerRef }: { canvasContainerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <DrawingProvider>
      <EmptyStateContentInner canvasContainerRef={canvasContainerRef} />
    </DrawingProvider>
  );
}

/**
 * AppContent - Inner component that wraps content based on active document
 * This component is INSIDE TabManagerProvider so it can use useTabManager()
 */
function AppContent({ containerRef, canvasContainerRef }: AppContentProps) {
  // Use the hook to get reactive document state
  const { activeDocument } = useTabManager();

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg"
    >
      {activeDocument ? (
        <DocumentProvider key={activeDocument.id} document={activeDocument}>
          <CanvasEngineProvider containerRef={canvasContainerRef}>
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
  
  // Initialize services on mount
  useEffect(() => {
    const init = async () => {
      await services.settingsManager.load();
      await services.themeManager.load();
      services.tabManager.loadInitialState();
    };
    
    init();
  }, []);
  
  return (
    <SettingsProvider>
      <ThemeProvider>
        <TabManagerProvider>
          <AppContent containerRef={containerRef} canvasContainerRef={canvasContainerRef} />
        </TabManagerProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
