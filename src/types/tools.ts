// ============================================================================
// TOOLS
// ============================================================================

export const BlendModes = {
  NORMAL: "source-over",
  MULTIPLY: "multiply",
} as const;

export type BlendMode = (typeof BlendModes)[keyof typeof BlendModes];

export const EraseModes = {
  PIXEL: "contained",
  FULL_STROKE: "full-stroke",
} as const;

export type EraseMode = (typeof EraseModes)[keyof typeof EraseModes];

export const Tools = {
  PEN: "pen",
  HIGHLIGHTER: "highlighter",
  AREA: "area",
  ERASER: "eraser",
} as const;

export type Tool = (typeof Tools)[keyof typeof Tools];

export type ToolConfig =
  | PenToolConfig
  | HighlighterToolConfig
  | AreaToolConfig
  | EraserToolConfig;

export type ToolConfigs = {
  [Tools.PEN]: PenToolConfig;
  [Tools.HIGHLIGHTER]: HighlighterToolConfig;
  [Tools.AREA]: AreaToolConfig;
  [Tools.ERASER]: EraserToolConfig;
};

export type PenToolConfig = {
  tool: typeof Tools.PEN;
  size: number;
  opacity: number;
  blendMode: BlendMode;
};

export type HighlighterToolConfig = {
  tool: typeof Tools.HIGHLIGHTER;
  size: number;
  opacity: number;
  blendMode: BlendMode;
};

export type AreaToolConfig = {
  tool: typeof Tools.AREA;
  opacity: number;
  blendMode: BlendMode;
  borderRadius: number;
};

export type EraserToolConfig = {
  tool: typeof Tools.ERASER;
  size: number;
  eraserMode: EraseMode;
};
