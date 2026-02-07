import {
  Keyboard,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { DeepPartial } from "~/types";
import type { AppSettings } from "~/types/settings";
import { ColorsSettings } from "./tabs/ColorsSettings";
import { GeneralSettings } from "./tabs/GeneralSettings";
import { ShortcutsSettings } from "./tabs/ShortcutsSettings";
import { ToolsSettings } from "./tabs/ToolsSettings";

const TabIds = {
  GENERAL: "general",
  COLORS: "colors",
  TOOLS: "tools",
  SHORTCUTS: "shortcuts",
} as const;
type TabId = (typeof TabIds)[keyof typeof TabIds];

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    id: TabIds.GENERAL,
    label: "General",
    icon: <Settings className="size-4" />,
  },
  { id: TabIds.COLORS, label: "Colors", icon: <Palette className="size-4" /> },
  {
    id: TabIds.TOOLS,
    label: "Tool Defaults",
    icon: <Wrench className="size-4" />,
  },
  {
    id: TabIds.SHORTCUTS,
    label: "Shortcuts",
    icon: <Keyboard className="size-4" />,
  },
];

interface SettingsWindowProps {
  settings: AppSettings;
  hasChanges: boolean;
  updateDraft: (updates: DeepPartial<AppSettings>) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onReset: () => void;
}

export function SettingsWindow({
  settings,
  hasChanges,
  updateDraft,
  onSave,
  onCancel,
  onReset,
}: SettingsWindowProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  return (
    <div className="flex flex-col h-screen bg-panel-bg select-none">
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with vertical tabs */}
        <div className="w-44 shrink-0 border-r border-toolbar-border bg-toolbar-bg p-2 space-y-1">
          <div className="px-2 py-3 mb-2">
            <h1 className="text-lg font-semibold text-text-primary">
              Settings
            </h1>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left border",
                activeTab === tab.id
                  ? "bg-surface-bg-active text-text-primary border-toolbar-border shadow-sm"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-bg-hover border-transparent",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === TabIds.GENERAL && (
            <GeneralSettings settings={settings} updateDraft={updateDraft} />
          )}
          {activeTab === TabIds.COLORS && (
            <ColorsSettings settings={settings} updateDraft={updateDraft} />
          )}
          {activeTab === TabIds.TOOLS && (
            <ToolsSettings
              toolConfigs={settings.toolConfigs}
              updateDraft={updateDraft}
            />
          )}
          {activeTab === TabIds.SHORTCUTS && (
            <ShortcutsSettings settings={settings} updateDraft={updateDraft} />
          )}
        </div>
      </div>

      {/* Footer with actions */}
      <div className="shrink-0 px-4 py-3 border-t border-toolbar-border bg-toolbar-bg flex items-center justify-between">
        {/* Reset button on left */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-text-muted hover:text-text-primary hover:bg-surface-bg-hover h-8"
        >
          <RotateCcw className="size-4 mr-1.5" />
          Restore Defaults
        </Button>

        {/* Cancel and Save on right */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-text-secondary hover:text-text-primary hover:bg-surface-bg-hover h-8"
          >
            <X className="size-4 mr-1.5" />
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="h-8 bg-accent-primary text-accent-primary-fg hover:bg-accent-primary/90 disabled:opacity-40"
          >
            <Save className="size-4 mr-1.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
