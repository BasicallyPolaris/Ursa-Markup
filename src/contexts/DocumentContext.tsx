/**
 * DocumentContext - Bridges active Document with React
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Document, StrokeHistory, Ruler } from '../core'
import type { Point, Tool, BrushSettings, BlendMode } from '../core'

interface DocumentContextValue {
  document: Document
  strokeHistory: StrokeHistory
  ruler: Ruler
  startStrokeGroup: () => void
  startStroke: (tool: Tool, brush: BrushSettings, point: Point, blendMode: BlendMode) => void
  addPointToStroke: (point: Point) => void
  endStrokeGroup: () => void
  undo: () => void
  redo: () => void
  // Ruler actions
  toggleRuler: () => void
  showRuler: () => void
  hideRuler: () => void
  rotateRuler: (delta: number) => void
  setRulerAngle: (angle: number) => void
  startDragRuler: (point: Point) => void
  dragRulerTo: (point: Point) => void
  endDragRuler: () => void
}

const DocumentContext = createContext<DocumentContextValue | null>(null)

interface DocumentProviderProps {
  document: Document
  children: React.ReactNode
}

export function DocumentProvider({ document, children }: DocumentProviderProps) {
  const [, forceUpdate] = useState({})

  // Subscribe to document changes
  useEffect(() => {
    let mounted = true

    const handleChange = () => {
      if (mounted) {
        forceUpdate({})
      }
    }

    document.onChange(handleChange)

    return () => {
      mounted = false
      document.offChange()
    }
  }, [document])

  // Stroke history actions
  const startStrokeGroup = useCallback(() => {
    document.strokeHistory.startGroup()
  }, [document])

  const startStroke = useCallback((
    tool: Tool,
    brush: BrushSettings,
    point: Point,
    blendMode: BlendMode = 'normal'
  ) => {
    document.strokeHistory.startStroke(tool, brush, point, blendMode)
    document.markAsChanged()
  }, [document])

  const addPointToStroke = useCallback((point: Point) => {
    document.strokeHistory.addPoint(point)
  }, [document])

  const endStrokeGroup = useCallback(() => {
    document.strokeHistory.endGroup()
  }, [document])

  const undo = useCallback(() => {
    document.strokeHistory.undo()
    document.markAsChanged()
  }, [document])

  const redo = useCallback(() => {
    document.strokeHistory.redo()
    document.markAsChanged()
  }, [document])

  // Ruler actions
  const toggleRuler = useCallback(() => {
    document.ruler.toggle()
    document.markAsChanged()
  }, [document])

  const showRuler = useCallback(() => {
    document.ruler.show()
    document.markAsChanged()
  }, [document])

  const hideRuler = useCallback(() => {
    document.ruler.hide()
    document.markAsChanged()
  }, [document])

  const rotateRuler = useCallback((delta: number) => {
    document.ruler.rotate(delta)
    document.markAsChanged()
  }, [document])

  const setRulerAngle = useCallback((angle: number) => {
    document.ruler.setAngle(angle)
    document.markAsChanged()
  }, [document])

  const startDragRuler = useCallback((point: Point) => {
    document.ruler.startDrag(point)
    forceUpdate({})  // Trigger re-render so ruler.isDragging is picked up
  }, [document])

  const dragRulerTo = useCallback((point: Point) => {
    document.ruler.dragTo(point)
    // No need to call forceUpdate here - the animation loop handles rendering
    // But we do need to update state so React knows about the change
  }, [document])

  const endDragRuler = useCallback(() => {
    document.ruler.endDrag()
    document.markAsChanged()
  }, [document])

  const value: DocumentContextValue = {
    document,
    strokeHistory: document.strokeHistory,
    ruler: document.ruler,
    startStrokeGroup,
    startStroke,
    addPointToStroke,
    endStrokeGroup,
    undo,
    redo,
    toggleRuler,
    showRuler,
    hideRuler,
    rotateRuler,
    setRulerAngle,
    startDragRuler,
    dragRulerTo,
    endDragRuler,
  }

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  )
}

export function useDocument(): DocumentContextValue {
  const context = useContext(DocumentContext)
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider')
  }
  return context
}

export { DocumentContext }
