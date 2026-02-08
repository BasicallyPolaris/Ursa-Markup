import type { DocumentState, Point, Size } from "../types";
import { Ruler } from "./Ruler";
import { StrokeHistory } from "./StrokeHistory";

/**
 * Generate a unique document ID
 */
function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Document is the aggregate root for all per-tab state
 * Encapsulates file info, viewport, stroke history, and ruler
 */
export class Document {
  id: string;
  filePath: string | null;
  fileName: string | null;
  imageSrc: string | null;

  // Viewport state
  zoom: number;
  viewOffset: Point;
  canvasSize: Size;

  // Domain objects
  strokeHistory: StrokeHistory;
  ruler: Ruler;

  // Status
  hasChanges: boolean;
  recentDir: string | null;

  // Track if initial fit behavior has been applied (only do it once per document)
  hasAppliedInitialFit: boolean;

  // Version tracking for clipboard copy deduplication
  // Increments on each change, used to skip redundant copies
  version: number;

  // Event callbacks (for React integration) - allow multiple subscribers
  private onChangeCallbacks: Set<() => void> = new Set();

  constructor(id?: string) {
    this.id = id || generateId();
    this.filePath = null;
    this.fileName = null;
    this.imageSrc = null;

    this.zoom = 1;
    this.viewOffset = { x: 0, y: 0 };
    this.canvasSize = { width: 800, height: 600 };

    this.strokeHistory = new StrokeHistory();
    this.ruler = new Ruler();

    this.hasChanges = false;
    this.recentDir = null;
    this.hasAppliedInitialFit = false;
    this.version = 0;
  }

  /**
   * Load an image into the document
   */
  loadImage(filePath: string, imageSrc: string, fileName?: string): void {
    this.filePath = filePath;
    this.imageSrc = imageSrc;
    this.fileName = fileName || filePath.split("/").pop() || null;

    // Extract directory from file path
    const lastSlash = filePath.lastIndexOf("/");
    this.recentDir = lastSlash > 0 ? filePath.substring(0, lastSlash) : null;

    // Reset viewport
    this.zoom = 1;
    this.viewOffset = { x: 0, y: 0 };
    this.hasChanges = false;

    // Clear stroke history for new image
    this.strokeHistory.clear();

    this.notifyChange();
  }

  /**
   * Clear the document (remove image and reset state)
   */
  clear(): void {
    if (this.imageSrc) {
      URL.revokeObjectURL(this.imageSrc);
    }

    this.filePath = null;
    this.fileName = null;
    this.imageSrc = null;
    this.recentDir = null;

    this.zoom = 1;
    this.viewOffset = { x: 0, y: 0 };
    this.canvasSize = { width: 800, height: 600 };
    this.hasChanges = false;

    this.strokeHistory.clear();

    this.notifyChange();
  }

  /**
   * Mark the document as having changes
   * Increments version for clipboard copy deduplication
   */
  markAsChanged(changed: boolean = true): void {
    if (changed) {
      this.version++;
    }
    this.hasChanges = changed;
    this.notifyChange();
  }

  /**
   * Update canvas size (when image loads)
   */
  setCanvasSize(size: Size): void {
    this.canvasSize = size;
    this.notifyChange();
  }

  /**
   * Update zoom level
   */
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(5, zoom));
    this.notifyChange();
  }

  /**
   * Update view offset (pan position)
   */
  setViewOffset(offset: Point): void {
    this.viewOffset = offset;
    this.notifyChange();
  }

  /**
   * Fit the document to a container size
   */
  fitToWindow(
    containerWidth: number,
    containerHeight: number,
    padding: number = 40,
  ): void {
    if (this.canvasSize.width === 0 || this.canvasSize.height === 0) return;

    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    const scaleX = availableWidth / this.canvasSize.width;
    const scaleY = availableHeight / this.canvasSize.height;
    const newZoom = Math.min(scaleX, scaleY, 1);
    const finalZoom = Math.max(0.1, newZoom);

    const imageScreenWidth = this.canvasSize.width * finalZoom;
    const imageScreenHeight = this.canvasSize.height * finalZoom;

    const panX = (containerWidth - imageScreenWidth) / 2;
    const panY = (containerHeight - imageScreenHeight) / 2;

    this.zoom = finalZoom;
    this.viewOffset = { x: -panX / finalZoom, y: -panY / finalZoom };

    this.notifyChange();
  }

  /**
   * Center image without scale if it fits, otherwise fit to window
   */
  autoCenter(
    containerWidth: number,
    containerHeight: number,
    padding: number = 40,
  ): void {
    if (this.canvasSize.width === 0 || this.canvasSize.height === 0) return;

    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    if (
      this.canvasSize.width <= availableWidth &&
      this.canvasSize.height <= availableHeight
    ) {
      // Fits at 1:1
      this.zoom = 1;
      const panX = (containerWidth - this.canvasSize.width) / 2;
      const panY = (containerHeight - this.canvasSize.height) / 2;
      this.viewOffset = { x: -panX, y: -panY };
    } else {
      // Scale down to fit
      const scaleX = availableWidth / this.canvasSize.width;
      const scaleY = availableHeight / this.canvasSize.height;
      const finalZoom = Math.max(0.1, Math.min(scaleX, scaleY));

      this.zoom = finalZoom;
      const imageScreenWidth = this.canvasSize.width * finalZoom;
      const imageScreenHeight = this.canvasSize.height * finalZoom;
      const panX = (containerWidth - imageScreenWidth) / 2;
      const panY = (containerHeight - imageScreenHeight) / 2;
      this.viewOffset = { x: -panX / finalZoom, y: -panY / finalZoom };
    }

    this.notifyChange();
  }

  /**
   * Stretch image to fill container (zoom in if needed)
   */
  stretchToFill(
    containerWidth: number,
    containerHeight: number,
    padding: number = 40,
  ): void {
    if (this.canvasSize.width === 0 || this.canvasSize.height === 0) return;

    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    const scaleX = availableWidth / this.canvasSize.width;
    const scaleY = availableHeight / this.canvasSize.height;
    // Zoom in or out to fill the canvas (max 500% to match other zoom limits)
    const finalZoom = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)));

    const imageScreenWidth = this.canvasSize.width * finalZoom;
    const imageScreenHeight = this.canvasSize.height * finalZoom;

    const panX = (containerWidth - imageScreenWidth) / 2;
    const panY = (containerHeight - imageScreenHeight) / 2;

    this.zoom = finalZoom;
    this.viewOffset = { x: -panX / finalZoom, y: -panY / finalZoom };

    this.notifyChange();
  }

  /**
   * Zoom around a point (e.g., mouse cursor)
   */
  zoomAroundPoint(
    newZoom: number,
    screenX: number,
    screenY: number,
    containerRect: DOMRect,
  ): void {
    const mouseScreenX = screenX - containerRect.left;
    const mouseScreenY = screenY - containerRect.top;

    // Calculate canvas coordinates at current zoom
    const canvasX = mouseScreenX / this.zoom + this.viewOffset.x;
    const canvasY = mouseScreenY / this.zoom + this.viewOffset.y;

    // Calculate new view offset to keep canvas point under mouse
    const newViewOffsetX = canvasX - mouseScreenX / newZoom;
    const newViewOffsetY = canvasY - mouseScreenY / newZoom;

    this.zoom = Math.max(0.1, Math.min(5, newZoom));
    this.viewOffset = { x: newViewOffsetX, y: newViewOffsetY };

    this.notifyChange();
  }

  /**
   * Check if document has an image loaded
   */
  hasImage(): boolean {
    return this.imageSrc !== null;
  }

  /**
   * Check if document is empty (no image)
   */
  isEmpty(): boolean {
    return !this.hasImage();
  }

  /**
   * Get a display title for the document
   */
  getDisplayTitle(): string {
    return this.fileName || "Untitled";
  }

  /**
   * Set a callback to be called when document changes
   * Used for React integration
   */
  onChange(callback: () => void): void {
    this.onChangeCallbacks.add(callback);
  }

  /**
   * Remove a specific change callback (or all if no arg provided)
   */
  offChange(callback?: () => void): void {
    if (callback) {
      this.onChangeCallbacks.delete(callback);
    } else {
      this.onChangeCallbacks.clear();
    }
  }

  /**
   * Notify listeners of a change
   */
  private notifyChange(): void {
    // Debug: notify about change for easier tracing during runtime
    // console.debug can be enabled in runtime devtools
    // eslint-disable-next-line no-console
    // console.debug("Document.notifyChange", { id: this.id, version: this.version });

    for (const cb of Array.from(this.onChangeCallbacks)) {
      try {
        cb();
      } catch (err) {
        console.error("Document change listener failed", err);
      }
    }
  }

  /**
   * Serialize to plain object for storage
   */
  serialize(): DocumentState {
    return {
      id: this.id,
      filePath: this.filePath,
      fileName: this.fileName,
      imageSrc: this.imageSrc,
      canvasSize: this.canvasSize,
      zoom: this.zoom,
      viewOffset: this.viewOffset,
      rulerPosition: {
        x: this.ruler.x,
        y: this.ruler.y,
        angle: this.ruler.angle,
      },
      hasChanges: this.hasChanges,
      recentDir: this.recentDir,
      strokeHistory: this.strokeHistory.groups,
      strokeHistoryIndex: this.strokeHistory.currentIndex,
    };
  }

  /**
   * Deserialize from plain object
   */
  static deserialize(state: DocumentState): Document {
    const doc = new Document(state.id);

    doc.filePath = state.filePath;
    doc.fileName = state.fileName;
    doc.imageSrc = state.imageSrc;
    doc.canvasSize = state.canvasSize;
    doc.zoom = state.zoom;
    doc.viewOffset = state.viewOffset;
    doc.hasChanges = state.hasChanges;
    doc.recentDir = state.recentDir;

    // Restore ruler position
    doc.ruler.x = state.rulerPosition.x;
    doc.ruler.y = state.rulerPosition.y;
    doc.ruler.angle = state.rulerPosition.angle;

    // Restore stroke history
    doc.strokeHistory.groups = state.strokeHistory;
    doc.strokeHistory.currentIndex = state.strokeHistoryIndex;

    return doc;
  }

  /**
   * Create an empty document
   */
  static createEmpty(): Document {
    return new Document(undefined);
  }
}
