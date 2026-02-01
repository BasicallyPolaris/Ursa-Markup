import { useState, useCallback, useEffect, useRef } from 'react'
import type { RulerState, Point } from '../types'

export function useRuler() {
  const [ruler, setRuler] = useState<RulerState>({
    visible: false,
    x: 400,
    y: 300,
    angle: 0,
    isDragging: false
  })

  const dragStartPos = useRef<Point | null>(null)
  const rulerStartPos = useRef<Point | null>(null)

  const toggleRuler = useCallback(() => {
    setRuler(prev => ({ ...prev, visible: !prev.visible }))
  }, [])

  const showRuler = useCallback(() => {
    setRuler(prev => ({ ...prev, visible: true }))
  }, [])

  const hideRuler = useCallback(() => {
    setRuler(prev => ({ ...prev, visible: false }))
  }, [])

  const rotateRuler = useCallback((delta: number) => {
    setRuler(prev => ({
      ...prev,
      angle: (prev.angle + delta) % 360
    }))
  }, [])

  const setRulerAngle = useCallback((angle: number) => {
    setRuler(prev => ({
      ...prev,
      angle: angle % 360
    }))
  }, [])

  const startDragging = useCallback((point: Point) => {
    dragStartPos.current = point
    rulerStartPos.current = { x: ruler.x, y: ruler.y }
    setRuler(prev => ({ ...prev, isDragging: true }))
  }, [ruler.x, ruler.y])

  const drag = useCallback((point: Point) => {
    if (!ruler.isDragging) return
    
    const startDrag = dragStartPos.current
    const startRuler = rulerStartPos.current
    
    if (!startDrag || !startRuler) return

    const dx = point.x - startDrag.x
    const dy = point.y - startDrag.y

    setRuler(prev => ({
      ...prev,
      x: startRuler.x + dx,
      y: startRuler.y + dy
    }))
  }, [ruler.isDragging])

  const stopDragging = useCallback(() => {
    dragStartPos.current = null
    rulerStartPos.current = null
    setRuler(prev => ({ ...prev, isDragging: false }))
  }, [])

  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    const handleWheelEvent = (e: WheelEvent) => {
      if (ruler.visible && e.ctrlKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 5 : -5
        rotateRuler(delta)
      }
    }

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheelEvent)
  }, [ruler.visible, rotateRuler])

  return {
    ruler,
    toggleRuler,
    showRuler,
    hideRuler,
    rotateRuler,
    setRulerAngle,
    startDragging,
    drag,
    stopDragging
  }
}
