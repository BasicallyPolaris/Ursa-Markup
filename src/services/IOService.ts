import { writeFile } from '@tauri-apps/plugin-fs'
import { writeImage } from '@tauri-apps/plugin-clipboard-manager'
import { save, open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { readFile } from '@tauri-apps/plugin-fs'

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
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        multiple: false,
      })

      if (!filePath) return null

      const fileData = await readFile(filePath as string)
      
      return {
        filePath: filePath as string,
        fileData,
      }
    } catch (error) {
      console.error('Failed to open file:', error)
      return null
    }
  }

  /**
   * Read a file by path
   */
  async readFile(filePath: string): Promise<Uint8Array> {
    return readFile(filePath)
  }

  /**
   * Save an image canvas to a file
   */
  async saveImage(canvas: HTMLCanvasElement, defaultPath?: string): Promise<boolean> {
    try {
      const filePath = await save({
        filters: [
          { name: 'PNG Image', extensions: ['png'] },
          { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
          { name: 'WebP Image', extensions: ['webp'] },
        ],
        defaultPath: defaultPath || 'annotated-image.png',
      })

      if (!filePath) return false

      const mimeType = filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')
        ? 'image/jpeg'
        : filePath.endsWith('.webp')
        ? 'image/webp'
        : 'image/png'

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, 0.95)
      })

      if (!blob) {
        console.error('Failed to create blob from canvas')
        return false
      }

      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      await writeFile(filePath, uint8Array)
      return true
    } catch (error) {
      console.error('Failed to save image:', error)
      return false
    }
  }

  /**
   * Copy canvas image to clipboard
   */
  async copyToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })

      if (!blob) {
        console.error('Failed to create blob from canvas')
        return false
      }

      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Try Tauri clipboard manager first
      try {
        await writeImage(uint8Array)
        return true
      } catch (tauriError) {
        console.log('Tauri clipboard failed, trying native command...', tauriError)

        // Fallback for Wayland: use wl-copy command via Rust backend
        const base64 = btoa(String.fromCharCode(...uint8Array))
        await invoke('copy_image_wayland', { imageBase64: base64 })
        return true
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  /**
   * Listen for files opened via CLI (single-instance)
   */
  async listenForFiles(callback: (filePath: string) => void): Promise<UnlistenFn> {
    const unlisten = await listen('open-file', (event) => {
      const payload = event.payload as { file_path: string }
      if (payload?.file_path) {
        callback(payload.file_path)
      }
    })

    return unlisten
  }

  /**
   * Get any pending file from initial launch
   */
  async getPendingFile(): Promise<string | null> {
    try {
      // Small delay to ensure backend is ready
      await new Promise(resolve => setTimeout(resolve, 150))
      const pendingFile = await invoke<string | null>('get_pending_file')
      return pendingFile
    } catch {
      // No pending file or backend not ready
      return null
    }
  }
}

// Singleton instance
export const ioService = new IOService()
