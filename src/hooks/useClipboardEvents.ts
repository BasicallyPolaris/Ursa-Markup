/**
 * @file Clipboard Event Manager
 * @description Manages global Tauri clipboard event listeners using a reference-counted
 * singleton pattern. Handles toast notifications based on user settings and copy context
 * (manual vs. automatic).
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { toast } from "sonner";
import { settingsManager } from "~/services";

// -----------------------------------------------------------------------------
// Types & Interfaces
// -----------------------------------------------------------------------------

/**
 * Payload received from the backend `clipboard-copy-result` event.
 */
type ClipboardCopyResultPayload = {
  success: boolean;
  error: string | null;
  version: number;
};

// -----------------------------------------------------------------------------
// Module State
// -----------------------------------------------------------------------------

/**
 * Heuristics to distinguish between user-initiated and auto-generated copies.
 * @internal
 */
let lastCopyWasManual = false;
let lastCopyTimestamp = 0;
const MANUAL_COPY_TIMEOUT_MS = 10000;

/**
 * Singleton listener references.
 * Ensures only one Tauri event listener is active regardless of hook consumer count.
 * @internal
 */
let globalUnlisten: UnlistenFn | null = null;
let listenerPromise: Promise<void> | null = null;
let listenerRefCount = 0;

// -----------------------------------------------------------------------------
// Public Helpers
// -----------------------------------------------------------------------------

/**
 * Updates the internal state to reflect an initiated copy operation.
 * Used to correlate the subsequent backend result event with the action source.
 *
 * @param _version - The optimistic version number of the copy (unused currently).
 * @param isAutoCopy - Whether the copy was triggered programmatically.
 */
export function registerPendingCopy(
  _version: number,
  isAutoCopy: boolean,
): void {
  lastCopyWasManual = !isAutoCopy;
  lastCopyTimestamp = Date.now();
}

// -----------------------------------------------------------------------------
// Internal Logic
// -----------------------------------------------------------------------------

/**
 * Initializes the global Tauri event listener if not already active.
 * Handles the logic for displaying toast notifications based on success/failure
 * and user preference settings.
 */
async function setupGlobalListener(): Promise<void> {
  // Prevent duplicate listeners
  if (globalUnlisten) return;

  // Prevent race conditions during async setup
  if (listenerPromise) {
    await listenerPromise;
    return;
  }

  listenerPromise = (async () => {
    globalUnlisten = await listen<ClipboardCopyResultPayload>(
      "clipboard-copy-result",
      (event) => {
        const { success, error } = event.payload;

        // Validate if the result correlates to a recent manual action
        const isRecentManualCopy =
          lastCopyWasManual &&
          Date.now() - lastCopyTimestamp < MANUAL_COPY_TIMEOUT_MS;

        // Reset flag to prevent stale state affecting future events
        if (isRecentManualCopy) {
          lastCopyWasManual = false;
        }

        const shouldShowToastForAutoCopy =
          settingsManager.settings.copySettings.autoCopyShowToast;

        if (success) {
          // Toast policy: Always show for manual actions, conditionally for auto-copy
          if (isRecentManualCopy || shouldShowToastForAutoCopy) {
            toast.success("Copied to clipboard", { duration: 2000 });
          }
        } else {
          // Error policy: Always notify on failure
          toast.error("Copy failed", {
            description: error || "Unknown error",
            duration: 5000,
          });
        }
      },
    );
  })();

  await listenerPromise;
  listenerPromise = null;
}

/**
 * Decrements the listener reference count.
 * Detaches the global Tauri listener if no components are currently observing.
 */
function cleanupGlobalListener(): void {
  if (listenerRefCount <= 0 && globalUnlisten) {
    globalUnlisten();
    globalUnlisten = null;
  }
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

/**
 * Subscribes the mounting component to global clipboard events.
 *
 * Implements a reference-counting mechanism to manage the lifecycle of the
 * underlying Tauri event listener. When the last component unmounts, the
 * listener is automatically cleaned up.
 *
 * @example
 * ```tsx
 * // In a top-level layout or specific component
 * useClipboardEvents();
 * ```
 */
export function useClipboardEvents(): void {
  useEffect(() => {
    listenerRefCount++;
    setupGlobalListener();

    return () => {
      listenerRefCount--;
      cleanupGlobalListener();
    };
  }, []);
}
