import { useState, useCallback } from 'react'
import type { Tab, StrokeGroup } from '../types'
import type { CloseTabBehavior } from './useSettings'

// Generate unique tab ID
const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Create initial empty tab
const createEmptyTab = (): Tab => ({
  id: generateTabId(),
  filePath: null,
  fileName: null,
  imageSrc: null,
  canvasSize: { width: 800, height: 600 },
  zoom: 1,
  viewOffset: { x: 0, y: 0 },
  rulerPosition: { x: 400, y: 300, angle: 0 },
  hasChanges: false,
  recentDir: null,
  strokeHistory: [],
  strokeHistoryIndex: -1,
})

export interface PendingCloseTab {
  tabId: string
  tabName: string | null
  hasChanges: boolean
}

export function useTabs(closeTabBehavior: CloseTabBehavior = 'prompt') {
  const [tabs, setTabs] = useState<Tab[]>([createEmptyTab()])
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id)
  const [pendingCloseTab, setPendingCloseTab] = useState<PendingCloseTab | null>(null)

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0]

  // Check if a tab is empty (no image loaded)
  const isTabEmpty = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    return !tab || !tab.imageSrc
  }, [tabs])

  // Find an empty tab to reuse
  const findEmptyTab = useCallback(() => {
    return tabs.find(tab => !tab.imageSrc)
  }, [tabs])

  // Add a new tab or reuse empty tab
  const addTab = useCallback((filePath?: string, fileName?: string, imageSrc?: string, reuseEmpty: boolean = true) => {
    // If reuseEmpty is true, try to find and reuse an empty tab
    if (reuseEmpty && (!activeTab.imageSrc || !filePath)) {
      const emptyTab = tabs.find(tab => !tab.imageSrc && tab.id === activeTabId)
      if (emptyTab) {
        // Reuse the current empty tab
        setTabs(prev => prev.map(tab => 
          tab.id === emptyTab.id 
            ? { 
                ...tab, 
                filePath: filePath || null,
                fileName: fileName || (filePath ? filePath.split('/').pop() || null : null),
                imageSrc: imageSrc || null,
              }
            : tab
        ))
        return emptyTab.id
      }
    }

    // Create new tab
    const newTab: Tab = {
      ...createEmptyTab(),
      filePath: filePath || null,
      fileName: fileName || (filePath ? filePath.split('/').pop() || null : null),
      imageSrc: imageSrc || null,
    }
    
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
    return newTab.id
  }, [tabs, activeTabId, activeTab.imageSrc])

  // Actually close a tab (after confirmation or immediate)
  const doCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabIndex = prev.findIndex(t => t.id === tabId)
      if (tabIndex === -1) return prev
      
      const tab = prev[tabIndex]
      // Revoke object URL to prevent memory leaks
      if (tab.imageSrc) {
        URL.revokeObjectURL(tab.imageSrc)
      }
      
      const newTabs = prev.filter(t => t.id !== tabId)
      
      // If we're closing the active tab, switch to another
      if (tabId === activeTabId) {
        const newIndex = Math.min(tabIndex, newTabs.length - 1)
        setActiveTabId(newTabs[newIndex]?.id || '')
      }
      
      // If no tabs left, create a new empty one
      if (newTabs.length === 0) {
        const emptyTab = createEmptyTab()
        setActiveTabId(emptyTab.id)
        return [emptyTab]
      }
      
      return newTabs
    })
    setPendingCloseTab(null)
  }, [activeTabId])

  // Request to close a tab (handles confirmation)
  const requestCloseTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    // If no changes or tab is empty, close immediately
    if (!tab.hasChanges || !tab.imageSrc) {
      doCloseTab(tabId)
      return
    }

    // Handle based on close behavior setting
    switch (closeTabBehavior) {
      case 'discard':
        doCloseTab(tabId)
        break
      case 'auto-save':
        // Don't close yet - let App.tsx handle the save then close
        setPendingCloseTab({ tabId, tabName: tab.fileName, hasChanges: true })
        break
      case 'prompt':
      default:
        // Show confirmation dialog
        setPendingCloseTab({ tabId, tabName: tab.fileName, hasChanges: true })
        break
    }
  }, [tabs, closeTabBehavior, doCloseTab])

  // Confirm close with save
  const confirmCloseWithSave = useCallback(() => {
    if (pendingCloseTab) {
      // Return the tab ID that needs to be saved and closed
      const tabId = pendingCloseTab.tabId
      // Don't clear pendingCloseTab here - let App.tsx do it after saving
      return tabId
    }
    return null
  }, [pendingCloseTab])

  // Confirm close without saving
  const confirmCloseWithoutSave = useCallback(() => {
    if (pendingCloseTab) {
      doCloseTab(pendingCloseTab.tabId)
    }
  }, [pendingCloseTab, doCloseTab])

  // Cancel close
  const cancelClose = useCallback(() => {
    setPendingCloseTab(null)
  }, [])

  // Switch to a tab
  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [])

  // Update active tab state
  const updateActiveTab = useCallback((updates: Partial<Tab>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ))
  }, [activeTabId])

  // Mark active tab as having changes
  const markTabAsChanged = useCallback((changed: boolean = true) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, hasChanges: changed } : tab
    ))
  }, [activeTabId])

  // Update stroke history for active tab
  const updateActiveTabStrokeHistory = useCallback((history: StrokeGroup[], historyIndex: number) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, strokeHistory: history, strokeHistoryIndex: historyIndex } : tab
    ))
  }, [activeTabId])

  // Clear stroke history for active tab
  const clearActiveTabStrokeHistory = useCallback(() => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, strokeHistory: [], strokeHistoryIndex: -1 } : tab
    ))
  }, [activeTabId])

  // Get next tab (for keyboard navigation)
  const switchToNextTab = useCallback(() => {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const nextIndex = (currentIndex + 1) % tabs.length
    setActiveTabId(tabs[nextIndex].id)
  }, [tabs, activeTabId])

  // Get previous tab (for keyboard navigation)
  const switchToPrevTab = useCallback(() => {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
    setActiveTabId(tabs[prevIndex].id)
  }, [tabs, activeTabId])

  return {
    tabs,
    activeTab,
    activeTabId,
    pendingCloseTab,
    addTab,
    closeTab: requestCloseTab,
    confirmCloseWithSave,
    confirmCloseWithoutSave,
    cancelClose,
    switchTab,
    updateActiveTab,
    markTabAsChanged,
    switchToNextTab,
    switchToPrevTab,
    updateActiveTabStrokeHistory,
    clearActiveTabStrokeHistory,
    isTabEmpty,
    findEmptyTab,
  }
}
