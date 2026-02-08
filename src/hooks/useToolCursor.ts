import { useMemo } from "react";
import { Tools, type Tool, type ToolConfig } from "~/types/tools";

/**
 * Generates an SVG cursor Data URI.
 * Handles both Circle (Pen/Eraser) and Square (Highlighter) shapes.
 */
const getCursorSVG = (
  size: number,
  zoom: number,
  shape: "circle" | "square" = "circle",
  color: string = "black",
): string => {
  // 1. Calculate Screen Size
  const screenSize = size * zoom;

  // 2. Constraints
  // Min size: 4px (so it doesn't vanish)
  // Max size: 128px (Browser limit. Beyond this, we usually fallback to crosshair)
  if (screenSize < 4) return "crosshair";
  if (screenSize > 128) return "crosshair";

  const s = screenSize;
  const half = s / 2;
  const strokeWidth = 1; // Keep it thin

  // 3. Construct SVG
  let svgShape = "";

  if (shape === "circle") {
    // Double circle for contrast (White outer, Black inner)
    // r needs to account for stroke width so it doesn't get clipped
    const r = half - strokeWidth;
    svgShape = `
      <circle cx="${half}" cy="${half}" r="${r}" stroke="white" stroke-width="${strokeWidth}" fill="none" />
      <circle cx="${half}" cy="${half}" r="${r - 1}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />
    `;
  } else {
    // Square for Highlighter (Matches 'square' lineCap)
    const padding = strokeWidth;
    const rectSize = s - padding * 2;
    svgShape = `
      <rect x="${padding}" y="${padding}" width="${rectSize}" height="${rectSize}" stroke="white" stroke-width="${strokeWidth}" fill="none" />
      <rect x="${padding + 1}" y="${padding + 1}" width="${rectSize - 2}" height="${rectSize - 2}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />
    `;
  }

  const svg = `
    <svg
      width="${s}"
      height="${s}"
      viewBox="0 0 ${s} ${s}"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${svgShape}
    </svg>
  `;

  // 4. Encode
  const blob = encodeURIComponent(svg.replace(/\n/g, "").replace(/\s+/g, " "));
  return `url('data:image/svg+xml;utf8,${blob}') ${half} ${half}, auto`;
};

/**
 * Hook to determine the CSS cursor based on the active tool and state.
 */
export function useToolCursor(
  tool: Tool,
  toolConfig: ToolConfig,
  zoom: number,
  interactionState: {
    isPanning: boolean;
    isRulerHover: boolean;
    isRulerDragging: boolean;
  },
) {
  return useMemo(() => {
    const { isPanning, isRulerHover, isRulerDragging } = interactionState;

    // 1. Priority: Interactions (Panning/Dragging) override everything
    if (isPanning || isRulerDragging) return "grabbing";
    if (isRulerHover) return "grab";

    // 2. Tool Cursors
    // Check if the tool has a size property
    const size = "size" in toolConfig ? (toolConfig as any).size : 0;

    switch (tool) {
      case Tools.ERASER:
        return getCursorSVG(size, zoom, "circle", "black");

      case Tools.PEN:
        // Pen is usually a circle.
        // You could pass 'activeColor' here if you want the cursor to match ink!
        return getCursorSVG(size, zoom, "circle", "black");

      case Tools.HIGHLIGHTER:
        // Highlighter is often square-ish (marker tip)
        return getCursorSVG(size, zoom, "square", "black");

      case Tools.AREA:
        // Area tool doesn't have a brush size, standard crosshair is best
        return "crosshair";

      default:
        return "default";
    }
  }, [tool, toolConfig, zoom, interactionState]);
}
