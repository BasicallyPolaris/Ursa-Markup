/**
 * Web Worker for handling image copy operations off the main thread
 *
 * This worker receives raw RGBA pixel data, draws it to an OffscreenCanvas,
 * and converts it to a base64 PNG string for sending to Rust.
 *
 * The heavy PNG encoding happens here instead of blocking the main UI thread.
 */

// Worker message types
type CopyWorkerMessage = {
  type: "copy";
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
};

type CopyWorkerResponse = {
  type: "success" | "error";
  base64Data?: string;
  error?: string;
};

self.onmessage = async (event: MessageEvent<CopyWorkerMessage>) => {
  const { type, imageData, width, height } = event.data;

  if (type !== "copy") {
    self.postMessage({
      type: "error",
      error: "Unknown message type",
    } as CopyWorkerResponse);
    return;
  }

  try {
    // Create an OffscreenCanvas (works in workers)
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext("2d");

    if (!ctx) {
      self.postMessage({
        type: "error",
        error: "Failed to get 2d context",
      } as CopyWorkerResponse);
      return;
    }

    // Create ImageData from the transferred buffer and draw to canvas
    const imgData = new ImageData(
      new Uint8ClampedArray(imageData),
      width,
      height,
    );
    ctx.putImageData(imgData, 0, 0);

    // Convert to PNG blob (this is the expensive operation, now off main thread)
    const blob = await offscreen.convertToBlob({ type: "image/png" });

    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Data = uint8ArrayToBase64(uint8Array);

    self.postMessage({
      type: "success",
      base64Data,
    } as CopyWorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    } as CopyWorkerResponse);
  }
};

/**
 * Convert Uint8Array to base64 string efficiently
 * Uses chunked processing to avoid call stack issues and reduce string allocations
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Process in chunks to avoid call stack issues with large arrays
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }

  return btoa(chunks.join(""));
}

// TypeScript needs this for module workers
export {};
