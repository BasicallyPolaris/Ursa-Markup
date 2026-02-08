import { APP_SETTINGS_CONSTANTS } from "~/services/Settings/config";
import {
  type AnyStroke,
  type AnyStrokeGroup,
  type Point,
  type StrokeHistoryState,
} from "~/types";
import { type Tool, type ToolConfigs } from "~/types/tools";

/**
 * StrokeHistory manages stroke recording, undo/redo state.
 * It is purely a data container and does not handle rendering.
 */
export class StrokeHistory {
  groups: AnyStrokeGroup[] = [];
  currentIndex = -1;
  maxHistory = APP_SETTINGS_CONSTANTS.MAX_HISTORY;

  // Current stroke tracking (not yet committed to history)
  // We use a looser type internally while building the group
  private currentGroup: {
    id: string;
    strokes: AnyStroke[];
    timestamp: number;
  } | null = null;

  private currentStroke: AnyStroke | null = null;
  private isRecording = false;

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return (
      this.currentIndex < this.groups.length - 1 && this.currentIndex >= -1
    );
  }

  /**
   * Start a new stroke group (typically on mouse down)
   */
  startGroup(): void {
    this.isRecording = true;
    this.currentGroup = {
      id: this.generateId(),
      strokes: [],
      timestamp: Date.now(),
    };
    this.currentStroke = null;
  }

  /**
   * Start a new stroke within the current group
   *
   */
  startStroke<T extends Tool>(
    tool: T,
    config: ToolConfigs[T],
    color: string,
    point: Point,
  ): void {
    if (!this.isRecording || !this.currentGroup) {
      console.warn("Attempted to start stroke without active group");
      return;
    }

    // Create the stroke with strict typing
    // We cast to AnyStroke because the implementation is generic but the storage is a union
    const stroke: any = {
      id: this.generateId(),
      tool,
      color,
      toolConfig: config,
      points: [point],
      timestamp: Date.now(),
    };

    this.currentStroke = stroke as AnyStroke;
    this.currentGroup.strokes.push(this.currentStroke);
  }

  /**
   * Add a point to the current stroke
   */
  addPoint(point: Point): void {
    if (!this.isRecording || !this.currentStroke) {
      return;
    }
    this.currentStroke.points.push(point);
  }

  /**
   * End the current stroke group (typically on mouse up)
   * Commits the group to history if it has strokes
   */
  endGroup(): void {
    if (!this.isRecording || !this.currentGroup) {
      return;
    }

    this.isRecording = false;
    this.currentStroke = null;

    // Only save if there are strokes
    if (this.currentGroup.strokes.length === 0) {
      this.currentGroup = null;
      return;
    }

    // 1. Remove "Future" (Redo stack)
    // If we were in the middle of the stack, we discard the redo history
    const newGroups = this.groups.slice(0, this.currentIndex + 1);

    // 2. Add new group
    // We cast here because we assume the group is homogeneous by usage
    newGroups.push(this.currentGroup as unknown as AnyStrokeGroup);

    // 3. Enforce Max History (Queue behavior)
    if (newGroups.length > this.maxHistory) {
      newGroups.shift();
    }

    this.groups = newGroups;
    this.currentIndex = newGroups.length - 1;
    this.currentGroup = null;
  }

  /**
   * Aborts the current stroke group being recorded.
   * Discards all points/strokes in the current group and resets recording state.
   * Does NOT affect the history stack.
   *
   * Use this when a stroke is cancelled (e.g. Esc key) or invalid (e.g. Eraser hit nothing).
   */
  abortGroup(): void {
    this.isRecording = false;
    this.currentGroup = null;
    this.currentStroke = null;
  }

  /**
   * Undo the last stroke group
   * Returns the new index after undo
   */
  undo(): number {
    if (this.canUndo()) {
      this.currentIndex--;
    }
    return this.currentIndex;
  }

  /**
   * Redo the previously undone stroke group
   * Returns the new index after redo
   */
  redo(): number {
    if (this.canRedo()) {
      this.currentIndex++;
    }
    return this.currentIndex;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.groups = [];
    this.currentIndex = -1;
    this.currentGroup = null;
    this.currentStroke = null;
    this.isRecording = false;
  }

  /**
   * Check if currently recording a stroke group
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get the current stroke group being recorded (if any)
   */
  getCurrentGroup(): AnyStrokeGroup | null {
    return this.currentGroup as unknown as AnyStrokeGroup;
  }

  /**
   * Serialize to plain object for storage
   */
  serialize(): StrokeHistoryState {
    return {
      groups: this.groups,
      currentIndex: this.currentIndex,
    };
  }

  /**
   * Deserialize from plain object
   */
  static deserialize(state: StrokeHistoryState): StrokeHistory {
    const history = new StrokeHistory();
    history.groups = state.groups;
    history.currentIndex = state.currentIndex;
    return history;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
