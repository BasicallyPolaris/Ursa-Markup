import type { Theme, ThemeConfig } from "~/types/theme";
import defaultConfigData from "./theme.json";

export const DEFAULT_THEME: ThemeConfig = defaultConfigData as ThemeConfig;

/** Get the default theme (dark) */
export function getDefaultTheme(): Theme {
  return DEFAULT_THEME.themes[0];
}

/** Get a theme by name */
export function getThemeByName(name: string): Theme | undefined {
  return DEFAULT_THEME.themes.find((t) => t.name === name);
}
