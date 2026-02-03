/**
 * DrawingContext - Shared state for drawing tools and brush settings
 * Connects Toolbar with CanvasContainer
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import type { Tool, BrushSettings } from "../core";
import { useSettings } from "./SettingsContext";

type BlendMode = "normal" | "multiply";

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
  /** Switch tool and apply default settings from user preferences */
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

  // Determine blend mode based on tool
  const getBlendModeForTool = useCallback((tool: Tool): BlendMode => {
    switch (tool) {
      case "pen":
        return settings.defaultPenBlendMode ?? "normal";
      case "highlighter":
        return settings.defaultMarkerBlendMode ?? "multiply";
      case "area":
        return settings.defaultAreaBlendMode ?? "multiply";
      default:
        return "normal";
    }
  }, [settings.defaultPenBlendMode, settings.defaultMarkerBlendMode, settings.defaultAreaBlendMode]);

  const [tool, setToolState] = useState<Tool>(initialTool);
  const [brush, setBrush] = useState<BrushSettings>({
    size: settings.defaultPenSize,
    color: initialColor,
    opacity: settings.defaultPenOpacity,
  });
  const [blendMode, setBlendMode] = useState<BlendMode>(() => getBlendModeForTool(initialTool));

  // Sync brush color if it doesn't match any preset (e.g., on settings change)
  useEffect(() => {
    // If current brush color is not in presets, update to first preset
    if (!settings.colorPresets.includes(brush.color)) {
      setBrush((prev) => ({
        ...prev,
        color: settings.colorPresets[0] || prev.color,
      }));
    }
  }, [settings.colorPresets, brush.color]);

  const updateBrush = useCallback((changes: Partial<BrushSettings>) => {
    setBrush((prev) => ({ ...prev, ...changes }));
  }, []);

  /**
   * Switch tool and apply default settings from user preferences
   * This should be used when switching tools via toolbar or keyboard shortcuts
   */
  const switchTool = useCallback((newTool: Tool) => {
    setToolState(newTool);
    
    // Apply default settings for the tool
    if (newTool === "pen") {
      setBrush((prev) => ({
        ...prev,
        size: settings.defaultPenSize,
        opacity: settings.defaultPenOpacity,
      }));
      setBlendMode(settings.defaultPenBlendMode ?? "normal");
    } else if (newTool === "highlighter") {
      setBrush((prev) => ({
        ...prev,
        size: settings.defaultMarkerSize,
        opacity: settings.defaultMarkerOpacity,
        borderRadius: settings.defaultMarkerBorderRadius,
      }));
      setBlendMode(settings.defaultMarkerBlendMode ?? "multiply");
    } else if (newTool === "area") {
      setBrush((prev) => ({
        ...prev,
        opacity: settings.defaultAreaOpacity,
        borderRadius: settings.defaultAreaBorderRadius,
        borderWidth: settings.defaultAreaBorderWidth,
      }));
      setBlendMode(settings.defaultAreaBlendMode ?? "multiply");
    }
  }, [
    settings.defaultPenSize,
    settings.defaultPenOpacity,
    settings.defaultPenBlendMode,
    settings.defaultMarkerSize,
    settings.defaultMarkerOpacity,
    settings.defaultMarkerBorderRadius,
    settings.defaultMarkerBlendMode,
    settings.defaultAreaOpacity,
    settings.defaultAreaBorderRadius,
    settings.defaultAreaBorderWidth,
    settings.defaultAreaBlendMode,
  ]);

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
