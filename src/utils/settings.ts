import { DeepPartial } from "~/types";

// Returns a new object with source merged into target
export function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  // If inputs aren't objects, return source (replace)
  if (!(target instanceof Object) || !(source instanceof Object)) {
    return source as T;
  }

  const output = { ...target };

  Object.keys(source).forEach((key) => {
    const k = key as keyof T;
    const targetValue = output[k];
    const sourceValue = source[k];

    if (Array.isArray(sourceValue)) {
      // Arrays: Always replace the full array
      output[k] = [...sourceValue] as any;
    } else if (
      sourceValue instanceof Object &&
      targetValue instanceof Object &&
      !Array.isArray(targetValue) // Ensure target isn't an array
    ) {
      // Objects: Recursively merge
      output[k] = deepMerge(targetValue, sourceValue as any);
    } else {
      // Primitives or type mismatch: Replace
      output[k] = sourceValue as any;
    }
  });

  return output;
}
