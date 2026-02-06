/**
 * DrawingContext - Shared state for drawing tools and brush settings
 * Connects Toolbar with CanvasContainer
 *
 * Each tool maintains its own session settings that persist until app restart.
 * Switching between tools restores that tool's last-used settings.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Tool, BrushSettings } from "../types";
import { useSettings } from "./SettingsContext";

type BlendMode = "normal" | "multiply";

/** Per-tool configuration that persists during the session */
interface ToolConfig {
  size: number;
  opacity: number;
  blendMode: BlendMode;
  borderRadius?: number;
}

interface DrawingContextValue {
  tool: Tool;
  brush: BrushSettings;
  blendMode: BlendMode;
  setTool: (tool: Tool) => void;
  setBrush: (
    brush: BrushSettings | ((prev: BrushSettings) => BrushSettings),
  ) => void;
  setBlendMode: (mode: BlendMode) => void;
  updateBrush: (changes: Partial<BrushSettings>) => void;
  /** Switch tool and restore that tool's session settings */
  switchTool: (tool: Tool) => void;
}

const DrawingContext = createContext<DrawingContextValue | null>(null);

interface DrawingProviderProps {
  children: React.ReactNode;
  initialTool?: Tool;
}

export function DrawingProvider({
  children,
  initialTool = "pen",
}: DrawingProviderProps) {
  const { settings } = useSettings();

  // Initialize with first color from settings colorPresets
  const initialColor = settings.colorPresets[0] || "#FF6B6B";

  // Per-tool session configs - initialized from user settings, but maintained per-session
  const [toolConfigs, setToolConfigs] = useState<Record<Tool, ToolConfig>>(
    () => ({
      pen: {
        size: settings.defaultPenSize,
        opacity: settings.defaultPenOpacity,
        blendMode: settings.defaultPenBlendMode ?? "normal",
      },
      highlighter: {
        size: settings.defaultHighlighterSize,
        opacity: settings.defaultHighlighterOpacity,
        blendMode: settings.defaultHighlighterBlendMode ?? "multiply",
      },
      area: {
        size: 1, // Not used for area tool
        opacity: settings.defaultAreaOpacity,
        blendMode: settings.defaultAreaBlendMode ?? "multiply",
        borderRadius: settings.defaultAreaBorderRadius,
      },
    }),
  );

  const [tool, setToolState] = useState<Tool>(initialTool);

  // Current brush state derived from tool config + shared color
  const [color, setColor] = useState<string>(initialColor);

  // Get current tool's config
  const currentConfig = toolConfigs[tool];

  // Build brush from current tool config and shared color
  const brush: BrushSettings = {
    size: currentConfig.size,
    color: color,
    blendMode: currentConfig.blendMode,
    opacity: currentConfig.opacity,
    borderRadius: currentConfig.borderRadius,
  };

  const blendMode = currentConfig.blendMode;

  // Track if this is the first render to avoid resetting configs on settings change
  const isInitialized = useRef(false);

  useEffect(() => {
    isInitialized.current = true;
  }, []);

  // Sync brush color if it doesn't match any preset (e.g., on settings change)
  useEffect(() => {
    // If current brush color is not in presets, update to first preset
    if (!settings.colorPresets.includes(color)) {
      setColor(settings.colorPresets[0] || color);
    }
  }, [settings.colorPresets, color]);

  /** Update the current tool's config */
  const updateToolConfig = useCallback(
    (toolToUpdate: Tool, changes: Partial<ToolConfig>) => {
      setToolConfigs((prev) => ({
        ...prev,
        [toolToUpdate]: { ...prev[toolToUpdate], ...changes },
      }));
    },
    [],
  );

  const updateBrush = useCallback(
    (changes: Partial<BrushSettings>) => {
      // Update color separately (shared across tools)
      if (changes.color !== undefined) {
        setColor(changes.color);
      }

      // Update tool-specific settings in the current tool's config
      const toolConfigChanges: Partial<ToolConfig> = {};
      if (changes.size !== undefined) toolConfigChanges.size = changes.size;
      if (changes.opacity !== undefined)
        toolConfigChanges.opacity = changes.opacity;
      if (changes.borderRadius !== undefined)
        toolConfigChanges.borderRadius = changes.borderRadius;

      if (Object.keys(toolConfigChanges).length > 0) {
        updateToolConfig(tool, toolConfigChanges);
      }
    },
    [tool, updateToolConfig],
  );

  const setBlendMode = useCallback(
    (mode: BlendMode) => {
      updateToolConfig(tool, { blendMode: mode });
    },
    [tool, updateToolConfig],
  );

  const setBrush = useCallback(
    (brushOrFn: BrushSettings | ((prev: BrushSettings) => BrushSettings)) => {
      const newBrush =
        typeof brushOrFn === "function" ? brushOrFn(brush) : brushOrFn;
      updateBrush(newBrush);
    },
    [brush, updateBrush],
  );

  /**
   * Switch tool and restore that tool's session settings.
   * No longer resets to defaults - each tool remembers its last-used settings.
   */
  const switchTool = useCallback((newTool: Tool) => {
    setToolState(newTool);
    // Tool config is automatically applied via the derived brush state
  }, []);

  const value: DrawingContextValue = {
    tool,
    brush,
    blendMode,
    setTool: setToolState,
    setBrush,
    setBlendMode,
    updateBrush,
    switchTool,
  };

  return (
    <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>
  );
}

export function useDrawing(): DrawingContextValue {
  const context = useContext(DrawingContext);
  if (!context) {
    throw new Error("useDrawing must be used within a DrawingProvider");
  }
  return context;
}

export { DrawingContext };
