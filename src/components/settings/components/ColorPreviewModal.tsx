import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { Theme, ColorPalette } from "../../../services/types";

interface ColorPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme | null;
  palette: ColorPalette | null;
}

export function ColorPreviewModal({
  isOpen,
  onClose,
  theme,
  palette,
}: ColorPreviewModalProps) {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const renderThemeColors = () => {
    if (!theme) return null;

    const colorGroups = [
      {
        title: "Application",
        colors: [
          { name: "Background", value: theme.colors.app.background },
          { name: "Foreground", value: theme.colors.app.foreground },
        ],
      },
      {
        title: "Toolbar",
        colors: [
          { name: "Background", value: theme.colors.toolbar.background },
          { name: "Secondary", value: theme.colors.toolbar.backgroundSecondary },
          { name: "Border", value: theme.colors.toolbar.border },
        ],
      },
      {
        title: "Panel",
        colors: [
          { name: "Background", value: theme.colors.panel.background },
          { name: "Border", value: theme.colors.panel.border },
        ],
      },
      {
        title: "Surface",
        colors: [
          { name: "Background", value: theme.colors.surface.background },
          { name: "Hover", value: theme.colors.surface.backgroundHover },
          { name: "Active", value: theme.colors.surface.backgroundActive },
        ],
      },
      {
        title: "Text",
        colors: [
          { name: "Primary", value: theme.colors.text.primary },
          { name: "Secondary", value: theme.colors.text.secondary },
          { name: "Muted", value: theme.colors.text.muted },
        ],
      },
      {
        title: "Accent",
        colors: [
          { name: "Primary", value: theme.colors.accent.primary },
          { name: "Foreground", value: theme.colors.accent.primaryForeground },
          { name: "Hover", value: theme.colors.accent.hover },
        ],
      },
      {
        title: "Canvas",
        colors: [
          { name: "Background", value: theme.colors.canvas.background },
          { name: "Pattern", value: theme.colors.canvas.pattern },
        ],
      },
      {
        title: "Status",
        colors: [
          { name: "Success", value: theme.colors.status.success },
          { name: "Warning", value: theme.colors.status.warning },
          { name: "Unsaved", value: theme.colors.status.unsaved },
        ],
      },
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">
          Theme: {theme.label}
        </h3>
        {colorGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h4 className="text-sm font-medium text-text-secondary">
              {group.title}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {group.colors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => copyToClipboard(color.value)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-surface-bg hover:bg-surface-bg-hover transition-colors text-left group"
                >
                  <div
                    className="w-8 h-8 rounded-md border border-toolbar-border flex-shrink-0"
                    style={{ backgroundColor: color.value }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-secondary truncate">
                      {color.name}
                    </p>
                    <p className="text-xs font-mono text-text-primary truncate">
                      {color.value}
                    </p>
                  </div>
                  {copiedColor === color.value ? (
                    <Check className="w-3 h-3 text-success flex-shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPaletteColors = () => {
    if (!palette) return null;

    return (
      <div className="space-y-4 mt-6 pt-6 border-t border-toolbar-border">
        <h3 className="text-lg font-semibold text-text-primary">
          Palette: {palette.name.charAt(0).toUpperCase() + palette.name.slice(1)}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {palette.colors.map((color: string, index: number) => (
            <button
              key={index}
              onClick={() => copyToClipboard(color)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface-bg hover:bg-surface-bg-hover transition-colors group"
            >
              <div
                className="w-12 h-12 rounded-full border-2 border-toolbar-border"
                style={{ backgroundColor: color }}
              />
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-text-primary">
                  {color}
                </span>
                {copiedColor === color ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100" />
                )}
              </div>
              <span className="text-xs text-text-muted">Color {index + 1}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/80">
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-panel-bg rounded-xl border border-panel-border shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-toolbar-border">
          <h2 className="text-xl font-semibold text-text-primary">
            Color Preview
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-bg-hover transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {theme && renderThemeColors()}
          {palette && renderPaletteColors()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-toolbar-border bg-toolbar-bg">
          <p className="text-sm text-text-muted">
            Click any color to copy its value to clipboard
          </p>
        </div>
      </div>
    </div>
  );
}
