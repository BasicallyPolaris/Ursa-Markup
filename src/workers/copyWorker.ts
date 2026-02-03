/**
 * Web Worker for handling image copy operations off the main thread
 * 
 * This worker receives an ImageBitmap, draws it to an OffscreenCanvas,
 * and converts it to a base64 PNG string for sending to Rust.
 * 
 * The heavy PNG encoding happens here instead of blocking the main UI thread.
 */

// Worker message types
interface CopyWorkerMessage {
  type: 'copy';
  imageBitmap: ImageBitmap;
  width: number;
  height: number;
}

interface CopyWorkerResponse {
  type: 'success' | 'error';
  base64Data?: string;
  error?: string;
}

self.onmessage = async (event: MessageEvent<CopyWorkerMessage>) => {
  const { type, imageBitmap, width, height } = event.data;

  if (type !== 'copy') {
    self.postMessage({ type: 'error', error: 'Unknown message type' } as CopyWorkerResponse);
    return;
  }

  try {
    // Create an OffscreenCanvas (works in workers)
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    
    if (!ctx) {
      self.postMessage({ type: 'error', error: 'Failed to get 2d context' } as CopyWorkerResponse);
      return;
    }

    // Draw the ImageBitmap to the OffscreenCanvas
    ctx.drawImage(imageBitmap, 0, 0);
    
    // Close the ImageBitmap to free memory
    imageBitmap.close();

    // Convert to PNG blob (this is the expensive operation, now off main thread)
    const blob = await offscreen.convertToBlob({ type: 'image/png' });
    
    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Data = uint8ArrayToBase64(uint8Array);

    self.postMessage({
      type: 'success',
      base64Data,
    } as CopyWorkerResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    } as CopyWorkerResponse);
  }
};

/**
 * Convert Uint8Array to base64 string
 * More efficient than using btoa with string conversion
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// TypeScript needs this for module workers
export {};
