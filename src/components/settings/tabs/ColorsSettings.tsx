import { useState, useEffect } from "react";
import { Moon, SwatchBook, Eye, ExternalLink, FileJson } from "lucide-react";
import { Button } from "../../ui/button";
import { SettingsSection } from "../components/SettingsSection";
import { ColorPreviewModal } from "../components/ColorPreviewModal";
import type { AppSettings, ColorPalette, Theme } from "../../../services/types";
import { themeManager } from "../../../services";

interface ColorsSettingsProps {
  settings: AppSettings;
  updateDraft: (updates: Partial<AppSettings>) => void;
}

export function ColorsSettings({ settings, updateDraft }: ColorsSettingsProps) {
  const [availablePalettes, setAvailablePalettes] = useState<ColorPalette[]>(
    [],
  );
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [previewPalette, setPreviewPalette] = useState<ColorPalette | null>(
    null,
  );

  useEffect(() => {
    // Load themes and palettes from theme manager (user config)
    const loadData = () => {
      setAvailableThemes(themeManager.availableThemes);
      setAvailablePalettes(themeManager.availablePalettes);
    };

    loadData();

    // Subscribe to theme changes
    const unsubscribe = themeManager.on("themeLoaded", loadData);
    return () => unsubscribe();
  }, []);

  // Apply theme class when theme setting changes (for preview in settings window)
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = availableThemes.find((t) => t.name === settings.theme);

    if (currentTheme) {
      // Apply light/dark class based on theme name
      if (settings.theme === "light") {
        root.classList.add("light");
        root.classList.remove("dark");
      } else {
        root.classList.add("dark");
        root.classList.remove("light");
      }
    }
  }, [settings.theme, availableThemes]);

  const handlePreviewTheme = (theme: Theme) => {
    setPreviewTheme(theme);
    setPreviewPalette(null);
    setPreviewModalOpen(true);
  };

  const handlePreviewPalette = (palette: ColorPalette) => {
    setPreviewPalette(palette);
    setPreviewTheme(null);
    setPreviewModalOpen(true);
  };

  const handleOpenConfig = async () => {
    try {
      // Ensure the user config file exists and is populated before opening
      if (typeof themeManager.ensureUserConfig === "function") {
        await themeManager.ensureUserConfig();
      }
      await themeManager.openConfigFile();
    } catch (err) {
      console.error("Failed to open theme config:", err);
    }
  };

  const handleThemeSelect = (themeName: string) => {
    // Update draft settings
    updateDraft({ theme: themeName });
    // Immediately apply theme for hot preview
    themeManager.setTheme(themeName);
  };

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Theme Configuration"
        description="Customize themes and palettes by editing the theme.json config file
        directly. Changes will be applied after restarting the app."
        icon={<FileJson className="size-4" />}
      >
        {/* Open Config Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenConfig}
          className="mt-3 w-full border-dashed border-toolbar-border hover:border-text-muted hover:cursor-pointer"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Theme Config
        </Button>
      </SettingsSection>
      {/* Theme Selection */}
      <SettingsSection
        title="Theme"
        description="Choose your preferred theme"
        icon={<Moon className="w-4 h-4" />}
      >
        <div className="space-y-3">
          {availableThemes.map((theme) => (
            <div
              key={theme.name}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                settings.theme === theme.name
                  ? "bg-accent-primary/10 border-accent-primary"
                  : "bg-surface-bg border-toolbar-border hover:border-text-muted"
              }`}
            >
              <button
                onClick={() => handleThemeSelect(theme.name)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <div
                  className="w-10 h-10 rounded-md border border-toolbar-border shrink-0"
                  style={{ backgroundColor: theme.colors.app.background }}
                />
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      settings.theme === theme.name
                        ? "text-text-primary"
                        : "text-text-secondary"
                    }`}
                  >
                    {theme.label}
                  </p>
                  <p className="text-xs text-text-muted">{theme.description}</p>
                </div>
                {settings.theme === theme.name && (
                  <div className="w-2 h-2 rounded-full bg-accent-primary" />
                )}
              </button>
              <button
                onClick={() => handlePreviewTheme(theme)}
                className="p-1.5 rounded hover:bg-surface-bg-hover text-text-muted hover:text-text-primary shrink-0"
                title="Preview theme colors"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Palette Selection */}
      <SettingsSection
        title="Color Palette"
        description="Choose a color palette for drawing"
        icon={<SwatchBook className="w-4 h-4" />}
      >
        <div className="space-y-3">
          {availablePalettes.map((palette) => (
            <div
              key={palette.name}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                settings.selectedPalette === palette.name
                  ? "bg-accent-primary/10 border-accent-primary"
                  : "bg-surface-bg border-toolbar-border hover:border-text-muted"
              }`}
            >
              <button
                onClick={() => updateDraft({ selectedPalette: palette.name })}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <div className="flex gap-1">
                  {palette.colors.map((color: string, idx: number) => (
                    <div
                      key={idx}
                      className="w-6 h-6 rounded-full border border-text-primary/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span
                  className={`text-sm capitalize flex-1 ${
                    settings.selectedPalette === palette.name
                      ? "text-text-primary font-medium"
                      : "text-text-secondary"
                  }`}
                >
                  {palette.name.replace(/-/g, " ")}
                </span>
                {settings.selectedPalette === palette.name && (
                  <div className="w-2 h-2 rounded-full bg-accent-primary" />
                )}
              </button>

              <button
                onClick={() => handlePreviewPalette(palette)}
                className="p-1.5 rounded hover:bg-surface-bg-hover text-text-muted hover:text-text-primary"
                title="Preview colors"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Color Preview Modal */}
      <ColorPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        theme={previewTheme}
        palette={previewPalette}
      />
    </div>
  );
}
