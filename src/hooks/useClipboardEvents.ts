import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";

/**
 * Payload from the Rust backend clipboard-copy-result event
 */
interface ClipboardCopyResultPayload {
  success: boolean;
  error: string | null;
  version: number;
}

/**
 * Track whether the most recent copy was auto or manual
 * Using a simple flag instead of version-based tracking for reliability
 */
let lastCopyWasManual = false;
let lastCopyTimestamp = 0;

/**
 * Singleton listener state - ensures only ONE listener exists globally
 */
let globalUnlisten: UnlistenFn | null = null;
let listenerPromise: Promise<void> | null = null;
let listenerRefCount = 0;

/**
 * Register a pending copy operation
 * Called when a copy is initiated to track whether it was auto or manual
 */
export function registerPendingCopy(_version: number, isAutoCopy: boolean): void {
  lastCopyWasManual = !isAutoCopy;
  lastCopyTimestamp = Date.now();
}

/**
 * Set up the global clipboard event listener (singleton pattern)
 */
async function setupGlobalListener(): Promise<void> {
  // Already have a listener
  if (globalUnlisten) return;
  
  // Setup in progress - wait for it
  if (listenerPromise) {
    await listenerPromise;
    return;
  }
  
  // Create the listener
  listenerPromise = (async () => {
    globalUnlisten = await listen<ClipboardCopyResultPayload>(
      "clipboard-copy-result",
      (event) => {
        const { success, error } = event.payload;
        
        // Check if the most recent copy was manual (within last 10 seconds)
        const isRecentManualCopy = lastCopyWasManual && (Date.now() - lastCopyTimestamp < 10000);
        
        // Reset the flag after processing
        if (isRecentManualCopy) {
          lastCopyWasManual = false;
        }
        
        // Show toast for manual copies or errors
        if (success) {
          // Only show success toast for manual copies
          if (isRecentManualCopy) {
            toast.success("Copied to clipboard", {
              duration: 2000,
            });
          }
        } else {
          // Always show error toast (even for auto-copy)
          toast.error("Copy failed", {
            description: error || "Unknown error",
            duration: 5000,
          });
        }
      }
    );
  })();
  
  await listenerPromise;
  listenerPromise = null;
}

/**
 * Cleanup the global listener when no more hooks are using it
 */
function cleanupGlobalListener(): void {
  if (listenerRefCount <= 0 && globalUnlisten) {
    globalUnlisten();
    globalUnlisten = null;
  }
}

/**
 * Hook to listen for clipboard copy results from the Rust backend
 * Shows toast notifications for copy success/failure
 * 
 * Auto-copies are silent (no toast), manual copies show toast
 * 
 * Uses a singleton pattern to ensure only one listener exists globally,
 * even if multiple components use this hook or components remount.
 */
export function useClipboardEvents(): void {
  useEffect(() => {
    // Increment ref count and set up listener
    listenerRefCount++;
    setupGlobalListener();

    return () => {
      // Decrement ref count and cleanup if needed
      listenerRefCount--;
      cleanupGlobalListener();
    };
  }, []);
}
