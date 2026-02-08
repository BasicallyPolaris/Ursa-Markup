import { Ruler } from "~/core";
import type { Point } from "~/types";

type DebugOverlayProps = {
  zoom: number;
  viewOffset: Point;
  ruler: Ruler;
};

export function DebugOverlay({ zoom, viewOffset, ruler }: DebugOverlayProps) {
  return (
    <div className="absolute bottom-4 right-4 bg-surface-bg/95 text-text-primary px-3 py-2 rounded-lg text-xs font-mono pointer-events-none select-none flex flex-col gap-1 border border-toolbar-border z-50">
      <div>Zoom: {Math.round(zoom * 100)}%</div>
      {(viewOffset.x !== 0 || viewOffset.y !== 0) && (
        <div className="text-text-muted">Panned</div>
      )}
      {ruler.visible && (
        <div className="text-accent-primary">
          Ruler: {Math.round(ruler.angle % 360)}°
        </div>
      )}
    </div>
  );
}
