import { useState, useCallback, useRef } from 'react'

const MAX_HISTORY = 100

export function useHistory() {
  const historyRef = useRef<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isDrawingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const lastSaveTimeRef = useRef(0)

  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < historyRef.current.length - 1 && historyIndex >= 0

  const saveState = useCallback((canvas: HTMLCanvasElement, force = false) => {
    // Don't save if currently drawing (unless forced)
    if (isDrawingRef.current && !force) {
      pendingSaveRef.current = true
      return
    }
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Rate limit saves to avoid performance issues (min 100ms between saves)
    const now = Date.now()
    if (!force && now - lastSaveTimeRef.current < 100) {
      return
    }
    lastSaveTimeRef.current = now

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Remove redo states and add new state
    const newHistory = historyRef.current.slice(0, historyIndex + 1)
    newHistory.push(imageData)
    
    // Keep only last MAX_HISTORY states
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift()
    }
    
    historyRef.current = newHistory
    setHistoryIndex(newHistory.length - 1)
    pendingSaveRef.current = false
  }, [historyIndex])

  const undo = useCallback((canvas: HTMLCanvasElement) => {
    if (historyIndex < 0) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newIndex = historyIndex - 1
    
    if (newIndex >= 0) {
      // Restore previous state
      const imageData = historyRef.current[newIndex]
      if (imageData) {
        ctx.putImageData(imageData, 0, 0)
      }
    } else {
      // Clear canvas when undoing first action
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    
    setHistoryIndex(newIndex)
  }, [historyIndex])

  const redo = useCallback((canvas: HTMLCanvasElement) => {
    if (historyIndex >= historyRef.current.length - 1) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newIndex = historyIndex + 1
    const imageData = historyRef.current[newIndex]
    
    if (imageData) {
      ctx.putImageData(imageData, 0, 0)
    }
    
    setHistoryIndex(newIndex)
  }, [historyIndex])

  const clearHistory = useCallback(() => {
    historyRef.current = []
    setHistoryIndex(-1)
    pendingSaveRef.current = false
  }, [])

  const startDrawing = useCallback(() => {
    isDrawingRef.current = true
    pendingSaveRef.current = false
  }, [])

  const endDrawing = useCallback((canvas?: HTMLCanvasElement) => {
    isDrawingRef.current = false
    if (pendingSaveRef.current && canvas) {
      saveState(canvas, true)
    }
  }, [saveState])

  return {
    canUndo,
    canRedo,
    saveState,
    undo,
    redo,
    clearHistory,
    startDrawing,
    endDrawing
  }
}
