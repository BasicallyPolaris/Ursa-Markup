import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { useCallback } from "react";
import { Button } from "~/components/ui/button";
import { useTabManager } from "~/contexts/TabManagerContext";
import { services } from "~/services";
import { cn } from "~/lib/utils";
import { APP_SETTINGS_CONSTANTS } from "~/services/Settings/config";
import { toast } from "sonner";
import type { Document } from "~/core/Document";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function TabBar() {
  const {
    documents,
    activeDocumentId,
    getDocument,
    switchTab,
    closeTab,
    addTab,
  } = useTabManager();

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

  // Helper for Keyboard Accessibility
  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSwitchTab(tabId);
    }
  };

  const handleAddTab = useCallback(async () => {
    const existingEmpty = documents.find((doc) => doc.isEmpty());
    let targetDoc: Document | null = existingEmpty || null;
    if (existingEmpty) {
      if (existingEmpty.id !== activeDocumentId) {
        switchTab(existingEmpty.id);
      }
    } else {
      const newId = addTab();
      targetDoc = getDocument(newId);
    }
    // Now open dialog and load into targetDoc if available
    try {
      const result = await services.ioService.openFile();
      if (result && targetDoc) {
        const blob = new Blob([result.fileData]);
        const url = URL.createObjectURL(blob);
        targetDoc.loadImage(result.filePath, url);
      }
    } catch {
      toast.error("Failed to open file");
    }
  }, [documents, activeDocumentId, getDocument, switchTab, addTab]);

  const shouldHideAddButton = documents.length === 1 && documents[0]?.isEmpty();

  return (
    <div
      role="tablist"
      aria-label="Open documents"
      className="flex items-center gap-1 px-2 py-1 bg-toolbar-bg border-b border-toolbar-border overflow-x-auto shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
    >
      {documents.map((tab) => {
        const isActive = tab.id === activeDocumentId;
        return (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <div
                onClick={() => handleSwitchTab(tab.id)}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-1.5 w-50 rounded-t-md cursor-pointer select-none transition-all relative outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-inset",
                  isActive
                    ? "bg-surface-bg-active text-text-primary"
                    : "bg-toolbar-bg text-text-muted hover:bg-surface-bg-hover hover:text-text-secondary",
                )}
                role="tab"
                aria-selected={isActive}
              >
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-full" />
                )}

                <span className="text-status-unsaved flex items-center">
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
                  aria-label={`Close ${tab.getDisplayTitle()}`}
                  className={cn(
                    "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity size-4 hover:bg-surface-bg-hover focus:opacity-100", // Ensure focus makes it visible
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

      {!shouldHideAddButton && (
        <button
          onClick={handleAddTab}
          className="p-1.5 rounded-md hover:bg-surface-bg-hover transition-colors text-text-secondary sticky right-0 bg-toolbar-bg shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.1)]"
          title="Open File"
          aria-label="Open file"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
