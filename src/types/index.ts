export const BlendModes = {
  NORMAL: "source-over",
  MULTIPLY: "multiply",
} as const;

export type BlendMode = (typeof BlendModes)[keyof typeof BlendModes];

export const EraseModes = {
  FULL_STROKE: "full-stroke",
  CONTAINED: "contained",
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

export interface PenToolConfig {
  tool: typeof Tools.PEN;
  size: number;
  opacity: number;
  blendMode: BlendMode;
}

export interface HighlighterToolConfig {
  tool: typeof Tools.HIGHLIGHTER;
  size: number;
  opacity: number;
  blendMode: BlendMode;
}

export interface AreaToolConfig {
  tool: typeof Tools.AREA;
  opacity: number;
  blendMode: BlendMode;
  borderRadius: number;
}

export interface EraserToolConfig {
  tool: typeof Tools.ERASER;
  size: number;
  eraserMode: EraseMode;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface RulerState {
  visible: boolean;
  x: number;
  y: number;
  angle: number;
  isDragging: boolean;
}

export interface Stroke<T extends Tool> {
  id: string;
  tool: T;
  color: string;
  toolConfig: ToolConfigs[T];
  points: Point[];
  timestamp: number;
}

export type AnyStroke = { [K in Tool]: Stroke<K> }[Tool];

export interface StrokeGroup<T extends Tool> {
  id: string;
  strokes: Stroke<T>[];
  timestamp: number;
}

export type AnyStrokeGroup = { [K in Tool]: StrokeGroup<K> }[Tool];

export interface StrokeHistoryState {
  groups: AnyStrokeGroup[];
  currentIndex: number;
}

export interface Tab {
  id: string;
  filePath: string | null;
  fileName: string | null;
  imageSrc: string | null;
  canvasSize: { width: number; height: number };
  zoom: number;
  viewOffset: { x: number; y: number };
  rulerPosition: { x: number; y: number; angle: number };
  hasChanges: boolean;
  recentDir: string | null;
  strokeHistory: AnyStrokeGroup[];
  strokeHistoryIndex: number;
}

export interface CanvasState {
  tool: Tool;
  toolConfigs: ToolConfigs;
  ruler: RulerState;
  canUndo: boolean;
  canRedo: boolean;
  hasImage: boolean;
}

export interface ColorPalette {
  name: string;
  colors: string[];
}

export interface RulerState {
  visible: boolean;
  x: number;
  y: number;
  angle: number;
  isDragging: boolean;
}

export interface RulerSnapInfo {
  distance: number;
  snapToFarSide: boolean;
  inStickyZone: boolean;
  onRuler: boolean;
}

export interface DocumentState {
  id: string;
  filePath: string | null;
  fileName: string | null;
  imageSrc: string | null;
  canvasSize: Size;
  zoom: number;
  viewOffset: Point;
  rulerPosition: { x: number; y: number; angle: number };
  hasChanges: boolean;
  recentDir: string | null;
  strokeHistory: AnyStrokeGroup[];
  strokeHistoryIndex: number;
}

export interface ViewState {
  zoom: number;
  viewOffset: Point;
  canvasSize: Size;
}

export type AnyPreviewState = {
  [K in Tool]: PreviewState<K>;
}[Tool];

export interface PreviewState<T extends Tool> {
  tool: T;
  color: string;
  toolConfig: ToolConfigs[T];
  startPoint: Point;
  currentPoint: Point;
  points?: Point[];
}

// Color types for blend modes
export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}
