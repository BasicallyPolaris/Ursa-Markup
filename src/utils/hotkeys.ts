// ============================================================================
// HOTKEY UTILITIES
// ============================================================================

import { HotkeyBinding } from "../types/settings";

/** Converts a HotkeyBinding into a human-readable string (e.g., "Ctrl+Shift+Z") */
export function formatHotkey(binding: HotkeyBinding | undefined): string {
  if (!binding || !binding.key || binding.key === "") return "Unbound";

  const parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");

  let keyDisplay = binding.key;
  const specialKeys: Record<string, string> = {
    " ": "Space",
    tab: "Tab",
    escape: "Esc",
    enter: "Enter",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    "=": "+",
  };

  keyDisplay =
    specialKeys[keyDisplay.toLowerCase()] || keyDisplay.toUpperCase();
  parts.push(keyDisplay);

  return parts.join("+");
}

/** Compares a KeyboardEvent against a HotkeyBinding */
export function matchesHotkey(
  event: KeyboardEvent,
  binding: HotkeyBinding,
): boolean {
  const key = event.key.toLowerCase();
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  return (
    key === binding.key.toLowerCase() &&
    ctrlOrMeta === !!binding.ctrl &&
    event.shiftKey === !!binding.shift &&
    event.altKey === !!binding.alt
  );
}
