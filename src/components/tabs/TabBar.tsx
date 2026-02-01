import { X, Plus } from 'lucide-react'
import type { Tab } from '../../types'
import { cn } from '../../lib/utils'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onSwitchTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onAddTab: () => void
}

export function TabBar({ tabs, activeTabId, onSwitchTab, onCloseTab, onAddTab }: TabBarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-toolbar-bg border-b border-toolbar-border overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSwitchTab(tab.id)}
          className={cn(
            "group flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] rounded-md cursor-pointer select-none transition-colors",
            tab.id === activeTabId
              ? "bg-button-bg text-button-text"
              : "bg-toolbar-bg text-toolbar-text hover:bg-toolbar-hover"
          )}
        >
          <span className="flex-1 truncate text-sm">
            {tab.fileName || 'Untitled'}
            {tab.hasChanges && (
              <span className="ml-1 text-accent-yellow">●</span>
            )}
          </span>
          
          {/* Close button - only show on hover or if not the only tab */}
          {tabs.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
              className={cn(
                "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-toolbar-hover"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      
      {/* Add new tab button */}
      <button
        onClick={onAddTab}
        className="p-1.5 rounded-md hover:bg-toolbar-hover transition-colors text-toolbar-text"
        title="New Tab"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}
