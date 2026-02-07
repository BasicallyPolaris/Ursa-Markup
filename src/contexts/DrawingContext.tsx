import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BlendModes,
  EraseModes,
  Tools,
  type Tool,
  type ToolConfigs,
} from "~/types/tools";
import { useSettings } from "./SettingsContext";

interface DrawingActions {
  switchTool: (tool: Tool) => void;
  updateToolConfig: <T extends Tool>(
    tool: T,
    changes: Partial<ToolConfigs[T]>,
  ) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
}

type DrawingContextValue = DrawingActions &
  {
    [K in Tool]: {
      tool: K;
      toolConfig: ToolConfigs[K];
    };
  }[Tool];

const DrawingContext = createContext<DrawingContextValue | null>(null);

// --- Helpers ---

const getDefaultConfigs = (settings: any): ToolConfigs => ({
  [Tools.PEN]: {
    tool: Tools.PEN,
    size: settings.defaultPenSize,
    opacity: settings.defaultPenOpacity,
    blendMode: settings.defaultPenBlendMode ?? BlendModes.NORMAL,
  },
  [Tools.HIGHLIGHTER]: {
    tool: Tools.HIGHLIGHTER,
    size: settings.defaultHighlighterSize,
    opacity: settings.defaultHighlighterOpacity,
    blendMode: settings.defaultHighlighterBlendMode ?? BlendModes.MULTIPLY,
  },
  [Tools.AREA]: {
    tool: Tools.AREA,
    opacity: settings.defaultAreaOpacity,
    blendMode: settings.defaultAreaBlendMode ?? BlendModes.MULTIPLY,
    borderRadius: settings.defaultAreaBorderRadius,
  },
  [Tools.ERASER]: {
    tool: Tools.ERASER,
    size: settings.defaultEraserSize || 1,
    eraserMode: settings.defaultEraseMode || EraseModes.FULL_STROKE,
  },
});

interface DrawingProviderProps {
  children: React.ReactNode;
  initialTool?: Tool;
}

export function DrawingProvider({
  children,
  initialTool = Tools.PEN,
}: DrawingProviderProps) {
  const { settings, isLoaded } = useSettings();
  const defaultColor = settings.activePaletteColors[0];

  // Lazy initialization for color
  const [activeColor, setActiveColor] = useState<string>(() => defaultColor);

  const [tool, setTool] = useState<Tool>(initialTool);

  // Lazy initialization for configs using the helper
  const [toolConfigs, setToolConfigs] = useState<ToolConfigs>(() =>
    getDefaultConfigs(settings),
  );

  const isInitialized = useRef(false);

  // Sync settings ONLY when they transition from unloaded to loaded.
  // We use a ref to prevent overwriting user changes if settings re-emit later.
  useEffect(() => {
    if (isLoaded && !isInitialized.current) {
      setToolConfigs(getDefaultConfigs(settings));
      // Also sync the active color from settings
      setActiveColor(defaultColor);
      isInitialized.current = true;
    }
  }, [isLoaded, settings]);

  const updateToolConfig = useCallback(
    <T extends Tool>(toolToUpdate: T, changes: Partial<ToolConfigs[T]>) => {
      setToolConfigs((prev) => ({
        ...prev,
        [toolToUpdate]: { ...prev[toolToUpdate], ...changes },
      }));
    },
    [],
  );

  const switchTool = useCallback((newTool: Tool) => {
    setTool(newTool);
  }, []);

  const value = useMemo(() => {
    const contextValue = {
      tool,
      toolConfig: toolConfigs[tool],
      switchTool,
      updateToolConfig,
      activeColor,
      setActiveColor,
    };

    return contextValue as DrawingContextValue;
  }, [tool, toolConfigs, switchTool, updateToolConfig, activeColor]);

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
