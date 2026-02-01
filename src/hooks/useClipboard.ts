import { useCallback } from 'react'
import { writeFile } from '@tauri-apps/plugin-fs'
import { writeImage } from '@tauri-apps/plugin-clipboard-manager'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

export function useClipboard() {
  const copyToClipboard = useCallback(async (canvas: HTMLCanvasElement) => {
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
  }, [])

  const saveImage = useCallback(async (canvas: HTMLCanvasElement, defaultPath?: string) => {
    try {
      const filePath = await save({
        filters: [
          { name: 'PNG Image', extensions: ['png'] },
          { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
          { name: 'WebP Image', extensions: ['webp'] },
        ],
        defaultPath: defaultPath || 'annotated-image.png'
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
  }, [])

  return {
    copyToClipboard,
    saveImage
  }
}
