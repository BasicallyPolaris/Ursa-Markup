import type { Tool, ToolConfigs } from "./tools";

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<U> // Arrays: Treat as atomic (replace, don't merge by index)
    : T[P] extends object
      ? DeepPartial<T[P]> // Objects: Go deeper
      : T[P]; // Primitives: Stop
};

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export interface Stroke<T extends Tool> {
  id: string;
  tool: T;
  color: string;
  toolConfig: ToolConfigs[T];
  points: Point[];
  timestamp: number;
}

export type AnyStroke = { [K in Tool]: Stroke<K> }[Tool];

export type StrokeGroup<T extends Tool> = {
  id: string;
  strokes: Stroke<T>[];
  timestamp: number;
};

export type AnyStrokeGroup = { [K in Tool]: StrokeGroup<K> }[Tool];

export type StrokeHistoryState = {
  groups: AnyStrokeGroup[];
  currentIndex: number;
};

export type Tab = {
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
};

export type CanvasState = {
  tool: Tool;
  toolConfigs: ToolConfigs;
  ruler: RulerState;
  canUndo: boolean;
  canRedo: boolean;
  hasImage: boolean;
};

export type RulerState = {
  visible: boolean;
  x: number;
  y: number;
  angle: number;
  isDragging: boolean;
};

export type RulerSnapInfo = {
  distance: number;
  snapToFarSide: boolean;
  inStickyZone: boolean;
  onRuler: boolean;
};

export type DocumentState = {
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
};

export type ViewState = {
  zoom: number;
  viewOffset: Point;
  canvasSize: Size;
};

export interface PreviewState<T extends Tool> {
  tool: T;
  color: string;
  toolConfig: ToolConfigs[T];
  startPoint: Point;
  currentPoint: Point;
  points?: Point[];
}

export type AnyPreviewState = {
  [K in Tool]: PreviewState<K>;
}[Tool];
