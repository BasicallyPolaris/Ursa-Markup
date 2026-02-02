/**
 * SettingsContext - Bridges SettingsManager with React
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { AppSettings } from '../services'
import { settingsManager } from '../services'

interface SettingsContextValue {
  settings: AppSettings
  hasChanges: boolean
  isLoaded: boolean
  updateDraft: (updates: Partial<AppSettings>) => void
  updateColorPreset: (index: number, color: string) => void
  save: () => Promise<boolean>
  cancel: () => void
  reset: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

interface SettingsProviderProps {
  children: React.ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(settingsManager.settings)
  const [hasChanges, setHasChanges] = useState<boolean>(settingsManager.hasChanges)
  const [isLoaded, setIsLoaded] = useState<boolean>(settingsManager.loaded)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Initial load
  useEffect(() => {
    let mounted = true

    const init = async () => {
      if (!settingsManager.loaded) {
        await settingsManager.load()
      }
      if (mounted) {
        setSettings({ ...settingsManager.settings })
        setHasChanges(settingsManager.hasChanges)
        setIsLoaded(settingsManager.loaded)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  // Subscribe to settings changes
  useEffect(() => {
    unsubscribeRef.current = settingsManager.on('settingsChanged', () => {
      setSettings({ ...settingsManager.settings })
      setHasChanges(settingsManager.hasChanges)
    })

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])

  const updateDraft = useCallback((updates: Partial<AppSettings>) => {
    settingsManager.updateDraft(updates)
  }, [])

  const updateColorPreset = useCallback((index: number, color: string) => {
    settingsManager.updateColorPreset(index, color)
  }, [])

  const save = useCallback(async () => {
    return await settingsManager.save()
  }, [])

  const cancel = useCallback(() => {
    settingsManager.cancel()
  }, [])

  const reset = useCallback(async () => {
    await settingsManager.reset()
  }, [])

  const value: SettingsContextValue = {
    settings,
    hasChanges,
    isLoaded,
    updateDraft,
    updateColorPreset,
    save,
    cancel,
    reset,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export { SettingsContext }
