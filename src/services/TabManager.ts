import type { CloseTabBehavior, ServiceEvents } from "~/types/settings";
import { Document } from "../core/Document";

type EventCallback<T> = (payload: T) => void;

interface PendingClose {
  id: string;
  document: Document;
}

/**
 * TabManager manages a collection of Document instances (tabs)
 * Handles tab lifecycle: create, switch, close
 * Supports configurable close behaviors and emits events for document changes
 */
export class TabManager {
  private documents: Map<string, Document> = new Map();
  private activeId: string | null = null;
  private listeners: {
    [K in keyof ServiceEvents]?: EventCallback<ServiceEvents[K]>[];
  } = {};
  private pendingClose: PendingClose | null = null;
  private closeTabBehavior: CloseTabBehavior = "prompt";

  constructor() {
    // Create initial empty document
    const emptyDoc = Document.createEmpty();
    this.documents.set(emptyDoc.id, emptyDoc);
    this.activeId = emptyDoc.id;
    this.setupDocumentListeners(emptyDoc);
  }

  /**
   * Get all document IDs in order of creation
   */
  get documentIds(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get the number of documents
   */
  get documentCount(): number {
    return this.documents.size;
  }

  /**
   * Get the active document ID
   */
  get activeDocumentId(): string | null {
    return this.activeId;
  }

  /**
   * Get the currently active document
   */
  getActiveDocument(): Document | null {
    return this.activeId ? this.documents.get(this.activeId) || null : null;
  }

  /**
   * Get a document by ID
   */
  getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }

  /**
   * Check if there is a pending close operation waiting for confirmation
   */
  get hasPendingClose(): boolean {
    return this.pendingClose !== null;
  }

  /**
   * Get the pending close document info
   */
  get pendingCloseDocument(): {
    id: string;
    fileName: string | null;
    hasChanges: boolean;
  } | null {
    if (!this.pendingClose) return null;
    const doc = this.pendingClose.document;
    return {
      id: doc.id,
      fileName: doc.fileName,
      hasChanges: doc.hasChanges,
    };
  }

  /**
   * Set the close tab behavior (prompt, auto-save, discard)
   */
  setCloseTabBehavior(behavior: CloseTabBehavior): void {
    this.closeTabBehavior = behavior;
  }

  /**
   * Create a new document
   * Reuses empty tab if the active document is empty and no image is being loaded
   */
  createDocument(
    filePath?: string,
    fileName?: string,
    imageSrc?: string,
  ): string {
    const activeDoc = this.getActiveDocument();

    // Reuse empty active tab if no image is loaded and we're creating an empty doc
    // or if we're loading an image into an empty tab
    if (activeDoc && activeDoc.isEmpty() && !activeDoc.hasChanges) {
      if (filePath && imageSrc) {
        // Load image into the empty document
        activeDoc.loadImage(filePath, imageSrc, fileName);
        this.emit("documentChanged", { id: activeDoc.id });
        return activeDoc.id;
      } else if (!filePath && !imageSrc) {
        // Creating another empty document - just return the existing one
        return activeDoc.id;
      }
    }

    // Create new document
    const newDoc = Document.createEmpty();
    this.documents.set(newDoc.id, newDoc);
    this.setupDocumentListeners(newDoc);

    // Load image if provided
    if (filePath && imageSrc) {
      newDoc.loadImage(filePath, imageSrc, fileName);
    }

    this.emit("documentAdded", { id: newDoc.id });

    // Switch to the new document
    this.switchToDocument(newDoc.id);

    return newDoc.id;
  }

  /**
   * Close a document by ID
   * Handles close behavior (prompt, auto-save, discard)
   */
  closeDocument(id: string): void {
    const doc = this.documents.get(id);
    if (!doc) return;

    // If no changes or document is empty, close immediately
    if (!doc.hasChanges || doc.isEmpty()) {
      this.doCloseDocument(id);
      return;
    }

    // Handle based on close behavior setting
    switch (this.closeTabBehavior) {
      case "discard":
        this.doCloseDocument(id);
        break;
      case "auto-save":
        // Set up pending close - caller should handle save then call confirmCloseWithSave
        this.pendingClose = { id, document: doc };
        this.emit("documentChanged", { id }); // Trigger UI update for pending close
        break;
      case "prompt":
      default:
        // Set up pending close for confirmation dialog
        this.pendingClose = { id, document: doc };
        this.emit("documentChanged", { id }); // Trigger UI update for pending close
        break;
    }
  }

  /**
   * Actually close the document (internal)
   */
  private doCloseDocument(id: string): void {
    const doc = this.documents.get(id);
    if (!doc) return;

    // Clean up document resources
    doc.clear();
    doc.offChange();
    this.documents.delete(id);

    // If we're closing the active document, switch to another
    if (id === this.activeId) {
      const ids = this.documentIds;
      if (ids.length > 0) {
        // Find the index of the closed document and switch to adjacent
        const closedIndex = ids.indexOf(id);
        const newIndex =
          closedIndex >= 0 && closedIndex < ids.length
            ? closedIndex
            : ids.length - 1;
        this.activeId = ids[newIndex] || null;
      } else {
        this.activeId = null;
      }
    }

    this.emit("documentClosed", { id });
    this.emit("activeDocumentChanged", { id: this.activeId });

    // If no documents left, create a new empty one
    if (this.documents.size === 0) {
      const emptyDoc = Document.createEmpty();
      this.documents.set(emptyDoc.id, emptyDoc);
      this.activeId = emptyDoc.id;
      this.setupDocumentListeners(emptyDoc);
      this.emit("documentAdded", { id: emptyDoc.id });
      this.emit("activeDocumentChanged", { id: emptyDoc.id });
    }
  }

  /**
   * Confirm closing with save (for 'auto-save' and 'prompt' behaviors)
   * Returns the document ID that was pending close
   */
  confirmCloseWithSave(): string | null {
    if (!this.pendingClose) return null;

    const { id } = this.pendingClose;
    this.pendingClose = null;
    this.doCloseDocument(id);
    return id;
  }

  /**
   * Confirm closing without saving (discard changes)
   */
  confirmCloseWithoutSave(): void {
    if (!this.pendingClose) return;

    const { id } = this.pendingClose;
    this.pendingClose = null;
    this.doCloseDocument(id);
  }

  /**
   * Cancel the pending close operation
   */
  cancelClose(): void {
    this.pendingClose = null;
    // Re-emit to update UI that pending close was cancelled
    if (this.activeId) {
      this.emit("documentChanged", { id: this.activeId });
    }
  }

  /**
   * Switch to a document by ID
   */
  switchToDocument(id: string): void {
    if (!this.documents.has(id)) return;
    if (this.activeId === id) return;

    this.activeId = id;
    this.emit("activeDocumentChanged", { id });
  }

  /**
   * Get the next document ID (for keyboard navigation)
   */
  getNextDocumentId(): string | null {
    const ids = this.documentIds;
    if (ids.length === 0) return null;

    const currentIndex = this.activeId ? ids.indexOf(this.activeId) : -1;
    if (currentIndex === -1) return ids[0];

    const nextIndex = (currentIndex + 1) % ids.length;
    return ids[nextIndex];
  }

  /**
   * Get the previous document ID (for keyboard navigation)
   */
  getPreviousDocumentId(): string | null {
    const ids = this.documentIds;
    if (ids.length === 0) return null;

    const currentIndex = this.activeId ? ids.indexOf(this.activeId) : -1;
    if (currentIndex === -1) return ids[0];

    const prevIndex = (currentIndex - 1 + ids.length) % ids.length;
    return ids[prevIndex];
  }

  /**
   * Switch to the next document
   */
  switchToNextDocument(): void {
    const nextId = this.getNextDocumentId();
    if (nextId) {
      this.switchToDocument(nextId);
    }
  }

  /**
   * Switch to the previous document
   */
  switchToPreviousDocument(): void {
    const prevId = this.getPreviousDocumentId();
    if (prevId) {
      this.switchToDocument(prevId);
    }
  }

  /**
   * Find an empty document (no image loaded)
   */
  findEmptyDocument(): Document | undefined {
    for (const doc of this.documents.values()) {
      if (doc.isEmpty()) {
        return doc;
      }
    }
    return undefined;
  }

  /**
   * Check if a document is empty
   */
  isDocumentEmpty(id: string): boolean {
    const doc = this.documents.get(id);
    return doc ? doc.isEmpty() : true;
  }

  /**
   * Set up listeners on a document to forward changes
   */
  private setupDocumentListeners(doc: Document): void {
    doc.onChange(() => {
      this.emit("documentChanged", { id: doc.id });
    });
  }

  /**
   * Subscribe to tab manager events
   */
  on<K extends keyof ServiceEvents>(
    event: K,
    callback: EventCallback<ServiceEvents[K]>,
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners[event]?.indexOf(callback);
      if (index !== undefined && index > -1) {
        this.listeners[event]!.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event to listeners
   */
  private emit<K extends keyof ServiceEvents>(
    event: K,
    payload: ServiceEvents[K],
  ): void {
    this.listeners[event]?.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`Error in ${String(event)} listener:`, error);
      }
    });
  }

  /**
   * Load initial state - ensures at least one empty document exists
   * Called during app initialization
   */
  loadInitialState(): void {
    if (this.documents.size === 0) {
      const emptyDoc = Document.createEmpty();
      this.documents.set(emptyDoc.id, emptyDoc);
      this.activeId = emptyDoc.id;
      this.setupDocumentListeners(emptyDoc);
      this.emit("documentAdded", { id: emptyDoc.id });
      this.emit("activeDocumentChanged", { id: emptyDoc.id });
    }
  }

  /**
   * Clear all documents and reset to initial state
   */
  reset(): void {
    // Clear all documents
    for (const doc of this.documents.values()) {
      doc.clear();
      doc.offChange();
    }
    this.documents.clear();
    this.activeId = null;
    this.pendingClose = null;

    // Create new empty document
    const emptyDoc = Document.createEmpty();
    this.documents.set(emptyDoc.id, emptyDoc);
    this.activeId = emptyDoc.id;
    this.setupDocumentListeners(emptyDoc);
    this.emit("documentAdded", { id: emptyDoc.id });
    this.emit("activeDocumentChanged", { id: emptyDoc.id });
  }
}

// Singleton instance
export const tabManager = new TabManager();
