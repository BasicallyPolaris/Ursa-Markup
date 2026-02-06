export type Tool = "pen" | "highlighter" | "area";
export type BlendMode = "normal" | "multiply";

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

export interface Stroke {
  id: string;
  tool: Tool;
  points: Point[];
  brushSettings: BrushSettings;
  timestamp: number;
}

export interface StrokeGroup {
  id: string;
  strokes: Stroke[];
  timestamp: number;
}

export interface StrokeHistoryState {
  groups: StrokeGroup[];
  currentIndex: number;
}

// Tab state for multi-tab support
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
  strokeHistory: StrokeGroup[];
  strokeHistoryIndex: number;
}

export interface BrushSettings {
  size: number;
  color: string;
  opacity: number;
  blendMode: BlendMode;
  borderRadius?: number;
}

export interface CanvasState {
  tool: Tool;
  brush: BrushSettings;
  ruler: RulerState;
  canUndo: boolean;
  canRedo: boolean;
  hasImage: boolean;
}

export interface ColorPalette {
  name: string;
  colors: string[];
}

// Tool configuration types for theme system
export interface PenToolConfig {
  minSize: number;
  maxSize: number;
  defaultSize: number;
}

export interface HighlighterToolConfig {
  opacity: number;
  minSize: number;
  maxSize: number;
  defaultSize: number;
}

export interface AreaToolConfig {
  opacity: number;
  defaultSize: number;
  borderRadius: number;
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

export interface ToolConfig {
  pen: PenToolConfig;
  highlighter: HighlighterToolConfig;
  area: AreaToolConfig;
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
  strokeHistory: StrokeGroup[];
  strokeHistoryIndex: number;
}

export interface ViewState {
  zoom: number;
  viewOffset: Point;
  canvasSize: Size;
}

export interface PreviewState {
  tool: Tool;
  startPoint: Point;
  currentPoint: Point;
  brush: BrushSettings;
  points?: Point[];
  blendMode?: BlendMode;
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
