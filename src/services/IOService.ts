import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";

// Import the worker
import CopyWorker from "~/workers/copyWorker?worker";

/**
 * Options for clipboard copy operation
 */
export type CopyOptions = {
  /** Force copy even if version matches last copied version */
  force?: boolean;
  /** Whether this is an auto-copy (affects toast behavior) */
  isAutoCopy?: boolean;
  /** Image format for clipboard copy */
  format?: "png" | "jpeg";
  /** JPEG quality (0.0 - 1.0), only used when format is "jpeg" */
  jpegQuality?: number;
};

/**
 * Result of clipboard copy operation
 */
export type CopyResult = {
  /** Whether the copy was skipped (already copied this version) */
  skipped: boolean;
  /** The version that was copied (or would have been) */
  version: number;
};

/**
 * IOService handles all file and clipboard operations
 * Provides a clean interface for file I/O and clipboard access
 */
export class IOService {
  /** Track the last version that was successfully queued for copy */
  private lastCopiedVersion: number = -1;

  /** Web Worker for PNG encoding */
  private copyWorker: Worker | null = null;

  /**
   * Get or create the copy worker (lazy initialization)
   */
  private getCopyWorker(): Worker {
    if (!this.copyWorker) {
      this.copyWorker = new CopyWorker();
    }
    return this.copyWorker;
  }

  /**
   * Open a file dialog and read the selected file
   */
  async openFile(): Promise<{ filePath: string; fileData: Uint8Array } | null> {
    try {
      const filePath = await open({
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"],
          },
          { name: "All Files", extensions: ["*"] },
        ],
        multiple: false,
      });

      if (!filePath) return null;

      const fileData = await readFile(filePath as string);

      return {
        filePath: filePath as string,
        fileData,
      };
    } catch (error) {
      console.error("Failed to open file:", error);
      return null;
    }
  }

  /**
   * Read a file by path
   */
  async readFile(filePath: string): Promise<Uint8Array> {
    return readFile(filePath);
  }

  /**
   * Save an image canvas to a file
   */
  async saveImage(
    canvas: HTMLCanvasElement,
    defaultPath?: string,
  ): Promise<boolean> {
    try {
      const filePath = await save({
        filters: [
          { name: "PNG Image", extensions: ["png"] },
          { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
          { name: "WebP Image", extensions: ["webp"] },
        ],
        defaultPath: defaultPath || "annotated-image.png",
      });

      if (!filePath) return false;

      const mimeType =
        filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")
          ? "image/jpeg"
          : filePath.endsWith(".webp")
            ? "image/webp"
            : "image/png";

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, 0.95);
      });

      if (!blob) {
        console.error("Failed to create blob from canvas");
        return false;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await writeFile(filePath, uint8Array);
      return true;
    } catch (error) {
      console.error("Failed to save image:", error);
      return false;
    }
  }

  /**
   * Copy canvas image to clipboard using Web Worker + Rust backend
   *
   *
   * @param canvas The canvas to copy
   * @param version The document version (for deduplication)
   * @param options Copy options
   * @returns Copy result indicating if copy was skipped or queued
   */
  async copyToClipboard(
    canvas: HTMLCanvasElement,
    version: number,
    options?: CopyOptions,
  ): Promise<CopyResult> {
    // Skip if already copied this version (unless forced)
    if (!options?.force && version === this.lastCopiedVersion) {
      return { skipped: true, version };
    }

    try {
      let base64Data: string;
      const format = options?.format ?? "png";

      if (format === "jpeg") {
        // JPEG path: Fast encoding (hardware accelerated)
        const quality = options?.jpegQuality ?? 0.85;
        base64Data = await this.encodeAsJpeg(canvas, quality);
      } else {
        // PNG path: High quality via worker (slower)
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get canvas context");

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        base64Data = await this.encodeInWorker(imageData);
      }

      // Queue copy in Rust backend (fire-and-forget)
      await invoke("queue_clipboard_copy_base64", {
        imageBase64: base64Data,
        version,
      });

      // Update last copied version
      this.lastCopiedVersion = version;

      return { skipped: false, version };
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      throw error;
    }
  }

  /**
   * Fast JPEG encoding for auto-copy (much faster than PNG)
   * Uses canvas.toBlob which is hardware accelerated
   */
  private async encodeAsJpeg(
    canvas: HTMLCanvasElement,
    quality: number = 0.92,
  ): Promise<string> {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (!blob) {
      throw new Error("Failed to create JPEG blob from canvas");
    }

    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return this.uint8ArrayToBase64(uint8Array);
  }

  /**
   * Convert Uint8Array to base64 string efficiently
   * Uses chunked processing to avoid call stack issues
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    // Process in chunks to avoid call stack issues with large arrays
    const CHUNK_SIZE = 0x8000; // 32KB chunks
    const chunks: string[] = [];

    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
      chunks.push(
        String.fromCharCode.apply(null, chunk as unknown as number[]),
      );
    }

    return btoa(chunks.join(""));
  }

  /**
   * Encode ImageData to base64 PNG in a Web Worker
   */
  private encodeInWorker(imageData: ImageData): Promise<string> {
    return new Promise((resolve, reject) => {
      const worker = this.getCopyWorker();

      const handleMessage = (event: MessageEvent) => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);

        if (event.data.type === "success") {
          resolve(event.data.base64Data);
        } else {
          reject(new Error(event.data.error || "Worker failed"));
        }
      };

      const handleError = (error: ErrorEvent) => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        reject(new Error(error.message));
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);

      // Transfer the underlying ArrayBuffer to the worker (zero-copy)
      worker.postMessage(
        {
          type: "copy",
          imageData: imageData.data,
          width: imageData.width,
          height: imageData.height,
        },
        [imageData.data.buffer],
      );
    });
  }

  /**
   * Get the last copied version (for UI feedback)
   */
  getLastCopiedVersion(): number {
    return this.lastCopiedVersion;
  }

  /**
   * Listen for files opened via CLI (single-instance)
   */
  async listenForFiles(
    callback: (filePath: string) => void,
  ): Promise<UnlistenFn> {
    const unlisten = await listen("open-file", (event) => {
      const payload = event.payload as { file_path: string };
      if (payload?.file_path) {
        callback(payload.file_path);
      }
    });

    return unlisten;
  }

  /**
   * Get any pending file from initial launch
   */
  async getPendingFile(): Promise<string | null> {
    try {
      // Small delay to ensure backend is ready
      await new Promise((resolve) => setTimeout(resolve, 150));
      const pendingFile = await invoke<string | null>("get_pending_file");
      return pendingFile;
    } catch {
      // No pending file or backend not ready
      return null;
    }
  }
}

// Singleton instance
export const ioService = new IOService();
