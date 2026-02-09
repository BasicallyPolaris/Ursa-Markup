/**
 * Image processing utilities for clipboard operations and image manipulation
 */

/**
 * Convert clipboard RGBA buffer to PNG data URL for display
 * @param rgbaBuffer Raw RGBA pixel data from clipboard
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns PNG data URL string
 */
export function convertClipboardImageToDataUrl(
  rgbaBuffer: Uint8Array,
  width: number,
  height: number
): string {
  // Create temporary canvas to convert RGBA pixels to PNG
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas not supported");
  }

  // Convert RGBA buffer to ImageData and draw to canvas
  const imageData = new ImageData(
    new Uint8ClampedArray(rgbaBuffer),
    width,
    height,
  );
  ctx.putImageData(imageData, 0, 0);

  // Convert to data URL (PNG format)
  return canvas.toDataURL("image/png");
}