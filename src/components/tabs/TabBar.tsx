import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { useCallback } from "react";
import { Button } from "~/components/ui/button";
import { useTabManager } from "~/contexts/TabManagerContext";
import { cn } from "~/lib/utils";
import { APP_SETTINGS_CONSTANTS } from "~/services/Settings/config";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

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
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                key={tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-1.5 w-50 rounded-t-md cursor-pointer select-none transition-all relative",
                  isActive
                    ? "bg-surface-bg-active text-text-primary"
                    : "bg-toolbar-bg text-text-muted hover:bg-surface-bg-hover hover:text-text-secondary",
                )}
              >
                {/* Active tab bottom border indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-full" />
                )}

                <span className="text-status-unsaved">
                  <span
                    aria-hidden="true"
                    className={clsx(!tab.hasChanges && "opacity-0")}
                  >
                    {APP_SETTINGS_CONSTANTS.UNSAVED_INDICATOR}
                  </span>
                  {tab.hasChanges && (
                    <span className="sr-only">Unsaved changes</span>
                  )}
                </span>
                <span className="flex-1 truncate text-sm text-center">
                  {tab.getDisplayTitle()}
                </span>

                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (documents.length > 1 || tab.fileName) {
                      handleCloseTab(tab.id);
                    }
                  }}
                  disabled={!(documents.length > 1 || tab.fileName)}
                  className={cn(
                    "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity size-4 hover:bg-surface-bg-hover",
                    !(documents.length > 1 || tab.fileName) && "opacity-0!",
                  )}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>{tab.getDisplayTitle()}</TooltipContent>
          </Tooltip>
        );
      })}

      {/* Add new tab button - hidden when only one empty tab exists */}
      {!shouldHideAddButton && (
        <button
          onClick={handleAddTab}
          className="p-1.5 rounded-md hover:bg-surface-bg-hover transition-colors text-text-secondary"
          title="New Tab"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
