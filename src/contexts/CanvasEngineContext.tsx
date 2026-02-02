/**
 * CanvasEngineContext - Manages CanvasEngine instance
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { CanvasEngine } from '../core'
import { CanvasEngine as CanvasEngineClass } from '../core'
import type { Point, Size } from '../core'

interface CanvasEngineContextValue {
  engine: CanvasEngine | null
  zoom: number
  viewOffset: Point
  canvasSize: Size
  setZoom: (zoom: number) => void
  setViewOffset: (offset: Point) => void
  setCanvasSize: (size: Size) => void
  fitToWindow: () => void
  zoomAroundPoint: (newZoom: number, screenX: number, screenY: number, containerRect: DOMRect) => void
}

const CanvasEngineContext = createContext<CanvasEngineContextValue | null>(null)

interface CanvasEngineProviderProps {
  containerRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}

export function CanvasEngineProvider({ containerRef, children }: CanvasEngineProviderProps) {
  const [engine, setEngine] = useState<CanvasEngine | null>(null)
  const [zoom, setZoomState] = useState<number>(1)
  const [viewOffset, setViewOffsetState] = useState<Point>({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState<Size>({ width: 0, height: 0 })

  // Initialize engine when container is available
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (!engine) {
      const newEngine = new CanvasEngineClass()
      newEngine.initialize(container)
      setEngine(newEngine)
    }

    return () => {
      if (engine) {
        engine.destroy()
      }
    }
  }, [containerRef, engine])

  const setZoom = useCallback((newZoom: number) => {
    setZoomState(Math.max(0.1, Math.min(5, newZoom)))
  }, [])

  const setViewOffset = useCallback((offset: Point) => {
    setViewOffsetState(offset)
  }, [])

  const setCanvasSizeValue = useCallback((size: Size) => {
    setCanvasSize(size)
  }, [])

  const fitToWindow = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (canvasSize.width === 0 || canvasSize.height === 0) return

    const rect = container.getBoundingClientRect()
    const containerWidth = rect.width
    const containerHeight = rect.height
    const padding = 40

    const availableWidth = containerWidth - padding * 2
    const availableHeight = containerHeight - padding * 2

    const scaleX = availableWidth / canvasSize.width
    const scaleY = availableHeight / canvasSize.height
    const newZoom = Math.min(scaleX, scaleY, 1)
    const finalZoom = Math.max(0.1, newZoom)

    const imageScreenWidth = canvasSize.width * finalZoom
    const imageScreenHeight = canvasSize.height * finalZoom

    const panX = (containerWidth - imageScreenWidth) / 2
    const panY = (containerHeight - imageScreenHeight) / 2

    setZoomState(finalZoom)
    setViewOffsetState({ x: -panX / finalZoom, y: -panY / finalZoom })
  }, [containerRef, canvasSize])

  const zoomAroundPoint = useCallback((
    newZoom: number,
    screenX: number,
    screenY: number,
    containerRect: DOMRect
  ) => {
    const mouseScreenX = screenX - containerRect.left
    const mouseScreenY = screenY - containerRect.top

    // Calculate canvas coordinates at current zoom
    const canvasX = mouseScreenX / zoom + viewOffset.x
    const canvasY = mouseScreenY / zoom + viewOffset.y

    // Calculate new view offset to keep canvas point under mouse
    const newViewOffsetX = canvasX - mouseScreenX / newZoom
    const newViewOffsetY = canvasY - mouseScreenY / newZoom

    const clampedZoom = Math.max(0.1, Math.min(5, newZoom))
    setZoomState(clampedZoom)
    setViewOffsetState({ x: newViewOffsetX, y: newViewOffsetY })
  }, [zoom, viewOffset])

  const value: CanvasEngineContextValue = {
    engine,
    zoom,
    viewOffset,
    canvasSize,
    setZoom,
    setViewOffset,
    setCanvasSize: setCanvasSizeValue,
    fitToWindow,
    zoomAroundPoint,
  }

  return (
    <CanvasEngineContext.Provider value={value}>
      {children}
    </CanvasEngineContext.Provider>
  )
}

export function useCanvasEngine(): CanvasEngineContextValue {
  const context = useContext(CanvasEngineContext)
  if (!context) {
    throw new Error('useCanvasEngine must be used within a CanvasEngineProvider')
  }
  return context
}

export { CanvasEngineContext }
