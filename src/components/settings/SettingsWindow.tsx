import { useState, useCallback } from "react";
import {
  Settings,
  Wrench,
  Keyboard,
  Palette,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { GeneralSettings } from "./tabs/GeneralSettings";
import { ToolsSettings } from "./tabs/ToolsSettings";
import { ShortcutsSettings } from "./tabs/ShortcutsSettings";
import { ColorsSettings } from "./tabs/ColorsSettings";
import { cn } from "../../lib/utils";
import type { AppSettings } from "../../services/types";

type TabId = "general" | "colors" | "tools" | "shortcuts";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
  { id: "colors", label: "Colors", icon: <Palette className="w-4 h-4" /> },
  { id: "tools", label: "Tool Defaults", icon: <Wrench className="w-4 h-4" /> },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: <Keyboard className="w-4 h-4" />,
  },
];

interface SettingsWindowProps {
  settings: AppSettings;
  hasChanges: boolean;
  updateDraft: (updates: Partial<AppSettings>) => void;
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
          {activeTab === "general" && (
            <GeneralSettings settings={settings} updateDraft={updateDraft} />
          )}
          {activeTab === "colors" && (
            <ColorsSettings settings={settings} updateDraft={updateDraft} />
          )}
          {activeTab === "tools" && (
            <ToolsSettings settings={settings} updateDraft={updateDraft} />
          )}
          {activeTab === "shortcuts" && (
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
