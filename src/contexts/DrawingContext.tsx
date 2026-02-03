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

  const [tool, setTool] = useState<Tool>(initialTool);
  const [brush, setBrush] = useState<BrushSettings>({
    size: settings.defaultPenSize,
    color: initialColor,
    opacity: settings.defaultPenOpacity,
  });
  const [blendMode, setBlendMode] = useState<BlendMode>("normal");

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

  const value: DrawingContextValue = {
    tool,
    brush,
    blendMode,
    setTool,
    setBrush,
    setBlendMode,
    updateBrush,
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
