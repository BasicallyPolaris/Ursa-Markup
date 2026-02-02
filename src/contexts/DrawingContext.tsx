/**
 * DrawingContext - Shared state for drawing tools and brush settings
 * Connects Toolbar with CanvasContainer
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Tool, BrushSettings } from '../core'

type BlendMode = 'normal' | 'multiply'

interface DrawingContextValue {
  tool: Tool
  brush: BrushSettings
  blendMode: BlendMode
  setTool: (tool: Tool) => void
  setBrush: (brush: BrushSettings | ((prev: BrushSettings) => BrushSettings)) => void
  setBlendMode: (mode: BlendMode) => void
  updateBrush: (changes: Partial<BrushSettings>) => void
}

const DrawingContext = createContext<DrawingContextValue | null>(null)

interface DrawingProviderProps {
  children: React.ReactNode
  initialTool?: Tool
  initialBrush?: BrushSettings
}

export function DrawingProvider({ 
  children, 
  initialTool = 'pen',
  initialBrush = { size: 3, color: '#FFB3BA', opacity: 1 }
}: DrawingProviderProps) {
  const [tool, setTool] = useState<Tool>(initialTool)
  const [brush, setBrush] = useState<BrushSettings>(initialBrush)
  const [blendMode, setBlendMode] = useState<BlendMode>('normal')

  const updateBrush = useCallback((changes: Partial<BrushSettings>) => {
    setBrush(prev => ({ ...prev, ...changes }))
  }, [])

  const value: DrawingContextValue = {
    tool,
    brush,
    blendMode,
    setTool,
    setBrush,
    setBlendMode,
    updateBrush,
  }

  return (
    <DrawingContext.Provider value={value}>
      {children}
    </DrawingContext.Provider>
  )
}

export function useDrawing(): DrawingContextValue {
  const context = useContext(DrawingContext)
  if (!context) {
    throw new Error('useDrawing must be used within a DrawingProvider')
  }
  return context
}

export { DrawingContext }
