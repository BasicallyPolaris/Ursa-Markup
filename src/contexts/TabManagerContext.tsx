/**
 * TabManagerContext - Bridges TabManager with React
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Document } from "~/core";
import { tabManager } from "~/services";

type PendingCloseDocument = {
  id: string;
  fileName: string | null;
  hasChanges: boolean;
};

type TabManagerContextValue = {
  documents: Document[];
  activeDocument: Document | null;
  activeDocumentId: string | null;
  pendingCloseDocument: PendingCloseDocument | null;
  getDocument: (id: string) => Document | null;
  addTab: (filePath?: string, fileName?: string, imageSrc?: string) => string;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  confirmCloseWithSave: () => string | null;
  confirmCloseWithoutSave: () => void;
  cancelClose: () => void;
  switchToNextTab: () => void;
  switchToPreviousTab: () => void;
};

const TabManagerContext = createContext<TabManagerContextValue | null>(null);

type TabManagerProviderProps = {
  children: React.ReactNode;
};

export function TabManagerProvider({ children }: TabManagerProviderProps) {
  const [documents, setDocuments] = useState<Document[]>(() => {
    const activeDoc = tabManager.getActiveDocument();
    return activeDoc ? [activeDoc] : [];
  });
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
    tabManager.activeDocumentId,
  );
  const [pendingCloseDocument, setPendingCloseDocument] =
    useState<PendingCloseDocument | null>(null);

  // Get active document from current state
  const activeDocument =
    documents.find((doc) => doc.id === activeDocumentId) || null;

  // Subscribe to tab manager events
  useEffect(() => {
    const updateState = () => {
      const newDocs = tabManager.documentIds
        .map((id) => tabManager.getDocument(id))
        .filter((doc): doc is Document => doc !== undefined);
      setDocuments(newDocs);
      setActiveDocumentId(tabManager.activeDocumentId);

      const pending = tabManager.pendingCloseDocument;
      if (pending) {
        setPendingCloseDocument(pending);
      } else {
        setPendingCloseDocument(null);
      }
    };

    // Initial state
    updateState();

    // Subscribe to all relevant events
    const unsubs: (() => void)[] = [];

    unsubs.push(tabManager.on("documentAdded", updateState));
    unsubs.push(tabManager.on("documentClosed", updateState));
    unsubs.push(tabManager.on("activeDocumentChanged", updateState));
    unsubs.push(tabManager.on("documentChanged", updateState));

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  const addTab = useCallback(
    (filePath?: string, fileName?: string, imageSrc?: string) => {
      return tabManager.createDocument(filePath, fileName, imageSrc);
    },
    [],
  );

  const closeTab = useCallback((id: string) => {
    tabManager.closeDocument(id);
  }, []);

  const switchTab = useCallback((id: string) => {
    tabManager.switchToDocument(id);
  }, []);

  const confirmCloseWithSave = useCallback(() => {
    return tabManager.confirmCloseWithSave();
  }, []);

  const confirmCloseWithoutSave = useCallback(() => {
    tabManager.confirmCloseWithoutSave();
  }, []);

  const cancelClose = useCallback(() => {
    tabManager.cancelClose();
  }, []);

  const switchToNextTab = useCallback(() => {
    tabManager.switchToNextDocument();
  }, []);

  const switchToPreviousTab = useCallback(() => {
    tabManager.switchToPreviousDocument();
  }, []);

  const getDocument = useCallback((id: string) => {
    return tabManager.getDocument(id) || null;
  }, []);

  const value: TabManagerContextValue = {
    documents,
    activeDocument,
    activeDocumentId,
    pendingCloseDocument,
    getDocument,
    addTab,
    closeTab,
    switchTab,
    confirmCloseWithSave,
    confirmCloseWithoutSave,
    cancelClose,
    switchToNextTab,
    switchToPreviousTab,
  };

  return (
    <TabManagerContext.Provider value={value}>
      {children}
    </TabManagerContext.Provider>
  );
}

export function useTabManager(): TabManagerContextValue {
  const context = useContext(TabManagerContext);
  if (!context) {
    throw new Error("useTabManager must be used within a TabManagerProvider");
  }
  return context;
}

export { TabManagerContext };
