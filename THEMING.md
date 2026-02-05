# OmniMark Theme System

The OmniMark theme system provides centralized color management that is fully customizable through a single configuration file.

## Quick Start

All theming is controlled through **`theme.json`**. The app looks for this file in two locations:

1. **User config** (primary): `~/.config/omnimark/theme.json`
2. **Bundled default (developer)**: `src/lib/default-config.json` (canonical defaults in source)

On first run, the bundled defaults are used to initialize the user config file.

## Theme Configuration

### Color Formats Supported

- **HEX** (recommended): `#1e1e1e`, `#FFB3BA`
- **RGB**: `rgb(255, 255, 255)`
- **HSL**: `hsl(207, 100%, 31%)`

All colors are automatically converted to HSL internally for CSS variable compatibility.

## Theme Structure

### UI Colors (`colors`)

| Section   | Description                            | Example Properties                                  |
| --------- | -------------------------------------- | --------------------------------------------------- |
| `app`     | Main application background/foreground | `background`, `foreground`                          |
| `toolbar` | Toolbar backgrounds and borders        | `background`, `backgroundSecondary`, `border`       |
| `panel`   | Dialog/panel styling                   | `background`, `border`                              |
| `surface` | Interactive elements (buttons, inputs) | `background`, `backgroundHover`, `backgroundActive` |
| `text`    | Text colors                            | `primary`, `secondary`, `muted`                     |
| `accent`  | Primary accent color                   | `primary`, `primaryForeground`, `hover`             |
| `toggle`  | Switch/toggle states                   | `checked`, `unchecked`                              |
| `canvas`  | Canvas background and pattern          | `background`, `pattern`                             |
| `ruler`   | Ruler colors (canvas-rendered)         | `background`, `border`, `tick`, `text`, `compass`   |

### Drawing Palettes (`palettes`)

Each palette has a `name` and array of `colors`.

```json
{
  "palettes": [
    {
      "name": "pastel",
      "colors": ["#FFB3BA", "#FFDFBA", "#FFFFBA", ...]
    }
  ],
}
```

### Tool Configuration

Tool defaults (size, opacity, border radius) are managed by the application settings UI (`Settings → Tools`) and are not stored in the theme JSON. Theme files control colors, palettes, and UI styles only.

If you need per-tool defaults in the future, they should be introduced as an explicit, opt-in extension and documented here. For now, remove any `tools` blocks from theme files.

## CSS Variables

The theme system creates CSS custom properties that components use:

```css
/* App colors */
--app-bg, --app-fg

/* Toolbar colors */
--toolbar-bg, --toolbar-bg-secondary, --toolbar-border

/* Text colors */
--text-primary, --text-secondary, --text-muted

/* Accent */
--accent-primary, --accent-hover

/* Toggle */
--toggle-checked, --toggle-unchecked

/* Canvas */
--canvas-bg, --canvas-pattern

/* Ruler (for canvas rendering) */
--ruler-bg, --ruler-border, --ruler-tick, --ruler-compass
```

## Default Theme Values

If `theme.json` is missing or invalid, the app falls back to these dark theme defaults:

```javascript
// Dark theme (default)
background: "#1e1e1e";
foreground: "#ffffff";
toolbarBackground: "#252525";
toolbarBorder: "#2a2a2a";
accent: "#005a9e";
```

## Creating Custom Themes

### Example: Light Theme

```json
{
  "colors": {
    "app": {
      "background": "#ffffff",
      "foreground": "#1a1a1a"
    },
    "toolbar": {
      "background": "#f5f5f5",
      "backgroundSecondary": "#ffffff",
      "border": "#e0e0e0"
    },
    "text": {
      "primary": "#1a1a1a",
      "secondary": "#4a4a4a",
      "muted": "#6a6a6a"
    },
    "accent": {
      "primary": "#0066cc",
      "primaryForeground": "#ffffff",
      "hover": "rgba(0, 0, 0, 0.05)"
    }
  }
}
```

### Example: Custom Color Palette

```json
{
  "palettes": [
    {
      "name": "my-palette",
      "colors": [
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#FFFF00",
        "#FF00FF",
        "#00FFFF",
        "#FFFFFF"
      ]
    }
  ],
  "defaultPalette": "my-palette"
}
```

## Architecture

### Files

- **`src/services/ThemeManager.ts`**: Singleton service for loading and applying themes
- **`src/contexts/ThemeContext.tsx`**: React context for theme state
- **`src/lib/theme.ts`**: Theme types, defaults, color conversion utilities
- **`src/hooks/useTheme.ts`**: React hook for accessing theme
- **`src/App.css`**: CSS variable definitions and Tailwind theme mapping

### How It Works

1. **App Startup**: `ThemeManager` loads theme from user config (or bundled fallback)
2. **Auto-Copy**: If user config doesn't exist, bundled theme is copied to `~/.config/omnimark/`
3. **Color Conversion**: All colors converted to HSL format
4. **CSS Application**: Colors applied to CSS custom properties on `:root`
5. **Component Rendering**: Components use Tailwind classes mapped to CSS variables

### Color Conversion Flow

```
theme.json (HEX/RGB/HSL)
    ↓
[ThemeManager] toHslString()
    ↓
CSS Custom Properties (HSL format)
    ↓
Tailwind @theme directive
    ↓
Component classes (e.g., bg-toolbar-bg)
```

## Troubleshooting

### Theme Not Loading

- Check browser console for JSON parse errors
- Verify `~/.config/omnimark/theme.json` exists and is valid JSON
- Delete user config to reset to bundled defaults
- Invalid themes automatically fall back to defaults

### Colors Not Applied

- Ensure color format is correct (HEX recommended)
- Check that CSS variables are being set (inspect `:root` in dev tools)
- Verify component is using theme classes (not hardcoded values)

### Canvas/Ruler Colors

- Ruler colors are read from CSS variables at render time
- If colors appear wrong, ensure theme loaded before canvas renders
