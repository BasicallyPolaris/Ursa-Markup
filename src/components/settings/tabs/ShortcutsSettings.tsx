import { Keyboard, FileInput, Brush, MousePointer, Layers } from "lucide-react"
import { SettingsSection } from "../components/SettingsSection"

interface ShortcutGroup {
  title: string
  icon: React.ReactNode
  shortcuts: { keys: string; description: string }[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "File Operations",
    icon: <FileInput className="w-4 h-4" />,
    shortcuts: [
      { keys: "Ctrl+O", description: "Open image" },
      { keys: "Ctrl+S", description: "Save image" },
      { keys: "Ctrl+C", description: "Copy to clipboard" },
    ],
  },
  {
    title: "Edit",
    icon: <Layers className="w-4 h-4" />,
    shortcuts: [
      { keys: "Ctrl+Z", description: "Undo" },
      { keys: "Ctrl+Shift+Z", description: "Redo" },
    ],
  },
  {
    title: "Tools",
    icon: <Brush className="w-4 h-4" />,
    shortcuts: [
      { keys: "1", description: "Pen tool" },
      { keys: "2", description: "Marker tool" },
      { keys: "3", description: "Area tool" },
      { keys: "Ctrl+1-7", description: "Quick colors 1-7" },
    ],
  },
  {
    title: "Navigation",
    icon: <MousePointer className="w-4 h-4" />,
    shortcuts: [
      { keys: "Ctrl+R", description: "Toggle ruler" },
      { keys: "Ctrl+Scroll", description: "Zoom in/out" },
      { keys: "Ctrl+Drag", description: "Pan canvas" },
    ],
  },
  {
    title: "Tabs",
    icon: <Keyboard className="w-4 h-4" />,
    shortcuts: [
      { keys: "Ctrl+T", description: "New tab" },
      { keys: "Ctrl+W", description: "Close tab" },
      { keys: "Ctrl+Tab", description: "Next tab" },
      { keys: "Ctrl+Shift+Tab", description: "Previous tab" },
    ],
  },
]

export function ShortcutsSettings() {
  return (
    <div className="space-y-5">
      {shortcutGroups.map((group) => (
        <SettingsSection
          key={group.title}
          title={group.title}
          icon={group.icon}
        >
          <div className="space-y-1">
            {group.shortcuts.map(({ keys, description }) => (
              <div
                key={keys}
                className="flex items-center justify-between py-2 px-1 rounded hover:bg-surface-bg-hover/50 transition-colors"
              >
                <span className="text-text-secondary text-sm">{description}</span>
                <kbd className="px-2.5 py-1 text-xs font-mono bg-surface-bg rounded-md text-text-primary border border-toolbar-border shadow-sm">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </SettingsSection>
      ))}
    </div>
  )
}
