import { useCallback } from "react";
import { X, Plus } from "lucide-react";
import { useTabManager } from "../../contexts/TabManagerContext";
import { cn } from "../../lib/utils";

export function TabBar() {
  const { documents, activeDocumentId, switchTab, closeTab, addTab } =
    useTabManager();

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      switchTab(tabId);
    },
    [switchTab],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      closeTab(tabId);
    },
    [closeTab],
  );

  const handleAddTab = useCallback(() => {
    addTab();
  }, [addTab]);

  // Check if we should hide the + button
  // Hide when there's only one tab and it's empty (no image loaded)
  const shouldHideAddButton = documents.length === 1 && documents[0]?.isEmpty();

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-toolbar-bg border-b border-toolbar-border overflow-x-auto shrink-0">
      {documents.map((tab) => {
        const isActive = tab.id === activeDocumentId;
        return (
          <div
            key={tab.id}
            onClick={() => handleSwitchTab(tab.id)}
            className={cn(
              "group flex items-center gap-2 px-3 py-1.5 min-w-30 max-w-50 rounded-t-md cursor-pointer select-none transition-all relative",
              isActive
                ? "bg-surface-bg-active text-text-primary"
                : "bg-toolbar-bg text-text-muted hover:bg-surface-bg-hover hover:text-text-secondary",
            )}
          >
            {/* Active tab bottom border indicator */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-full" />
            )}

            <span className="flex-1 truncate text-sm">
              {tab.getDisplayTitle()}
              {tab.hasChanges && (
                <span className="ml-1 text-status-unsaved">●</span>
              )}
            </span>

            {/* Close button - only show on hover or if not the only tab */}
            {documents.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className={cn(
                  "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-surface-bg-hover",
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* Add new tab button - hidden when only one empty tab exists */}
      {!shouldHideAddButton && (
        <button
          onClick={handleAddTab}
          className="p-1.5 rounded-md hover:bg-surface-bg-hover transition-colors text-text-secondary"
          title="New Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
