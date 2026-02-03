import { writeFile } from "@tauri-apps/plugin-fs";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { Image } from "@tauri-apps/api/image";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";

/**
 * IOService handles all file and clipboard operations
 * Provides a clean interface for file I/O and clipboard access
 */
export class IOService {
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
   * Copy canvas image to clipboard
   */
  async copyToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      // Get raw RGBA image data from canvas for Tauri clipboard
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get canvas context");
        return false;
      }
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rgbaData = new Uint8Array(imageData.data.buffer);

      // Try Tauri clipboard manager first with RGBA data
      try {
        // Create a Tauri Image from raw RGBA data
        const tauriImage = await Image.new(rgbaData, canvas.width, canvas.height);
        await writeImage(tauriImage);
        return true;
      } catch (tauriError) {
        console.log(
          "Tauri clipboard failed, trying native command...",
          tauriError,
        );

        // Fallback for Wayland: use wl-copy command via Rust backend with PNG data
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/png");
        });

        if (!blob) {
          console.error("Failed to create blob from canvas");
          return false;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64 in chunks to avoid stack overflow
        const base64 = this.uint8ArrayToBase64(uint8Array);
        await invoke("copy_image_wayland", { imageBase64: base64 });
        return true;
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  }

  /**
   * Convert Uint8Array to base64 without stack overflow
   * Uses chunked processing to handle large arrays
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    const chunkSize = 0x8000; // 32KB chunks
    const chunks: string[] = [];
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
    }
    
    return btoa(chunks.join(""));
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
