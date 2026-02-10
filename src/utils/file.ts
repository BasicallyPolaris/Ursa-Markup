/**
 * Utility functions for file operations
 */

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

/**
 * Checks if a file path corresponds to an image file based on its extension.
 */
export function isImageFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.includes(ext);
}