# OmniMark

A cross-platform image annotation tool inspired by the Windows Snipping Tool. Built with Tauri, React, and TypeScript.

## Features

### Drawing Tools

- **Pen Tool**: Freehand drawing with smooth anti-aliased strokes
- **Highlighter/Marker Tool**: Semi-transparent highlighting with flat ends
- **Area Tool**: Rectangle/rounded rectangle highlighting with optional border

### Tool Settings

- Adjustable size and opacity per tool
- Border radius for area tool
- Blend modes (Normal / Multiply)

### Canvas Features

- **Zoom**: 10% - 500% (Ctrl+Scroll, Ctrl+=, Ctrl+-)
- **Pan**: Ctrl+Click and drag
- **Fit/Stretch/Center**: Multiple view modes

### Ruler Overlay

- Toggle with Ctrl+R
- Rotate with scroll wheel
- Snap drawing to ruler edge with Shift+drag

### Multi-Tab Support

- Work on multiple images simultaneously
- Configurable close behavior (prompt, auto-save, discard)

### Other Features

- **Undo/Redo**: Full history support per document
- **Auto-Copy**: Automatically copies annotated image to clipboard after each stroke
- **Save**: Export as PNG, JPEG, or WebP
- **Customizable Hotkeys**: Rebind all keyboard shortcuts
- **Theming**: Fully customizable colors via theme.json

## Keyboard Shortcuts

All shortcuts can be customized in Settings → Shortcuts.

| Shortcut            | Action                     |
| ------------------- | -------------------------- |
| `Ctrl+O`            | Open image                 |
| `Ctrl+S`            | Save image                 |
| `Ctrl+C`            | Copy to clipboard          |
| `Ctrl+Z`            | Undo                       |
| `Ctrl+Shift+Z`      | Redo                       |
| `Ctrl+R`            | Toggle ruler               |
| `1`                 | Pen tool                   |
| `2`                 | Highlighter tool           |
| `3`                 | Area tool                  |
| `Ctrl+1` - `Ctrl+7` | Quick color presets        |
| `Ctrl+T`            | New tab                    |
| `Ctrl+W`            | Close tab                  |
| `Ctrl+Tab`          | Next tab                   |
| `Ctrl+Shift+Tab`    | Previous tab               |
| `Ctrl+=` / `Ctrl+-` | Zoom in/out                |
| `Ctrl+0`            | Reset zoom to 100%         |
| `Ctrl+Alt+F`        | Fit image to window        |
| `Ctrl+F`            | Stretch to fill            |
| `Ctrl+Alt+C`        | Center image               |
| `Shift + drag`      | Snap drawing to ruler line |

## Tech Stack

- **Framework**: Tauri 2.x (Rust backend + Web frontend)
- **Frontend**: React 19 + TypeScript
- **Styling**: TailwindCSS 4 + ShadCN + BaseUI
- **Build Tool**: Vite
- **Canvas**: HTML5 Canvas API with Web Workers for clipboard encoding

## Development

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Rust](https://rustup.rs/) (for Tauri)
- Linux dependencies for Tauri (see [Tauri prerequisites](https://tauri.app/start/prerequisites/))

### Setup

```bash
# Install dependencies
bun install

# Run development server
bun run tauri dev

# Build for production
bun run tauri build
```

### Project Structure

```
omnimark/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   └── lib.rs          # Tauri commands & setup
│   ├── capabilities/       # Tauri permission configs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React frontend
│   ├── components/
│   │   ├── canvas/         # Drawing canvas components
│   │   ├── toolbar/        # Toolbar UI
│   │   ├── tabs/           # Tab bar and dialogs
│   │   ├── settings/       # Settings window
│   │   └── ui/             # Base UI components
│   ├── contexts/           # React contexts (settings, theme, tabs, etc.)
│   ├── core/               # Domain logic (Document, BrushEngine, Ruler, etc.)
│   ├── services/           # Singleton services (IO, Settings, Theme, Window)
│   ├── hooks/              # Custom React hooks
│   ├── workers/            # Web workers (clipboard encoding)
│   ├── lib/                # Utilities
│   ├── types/              # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── config/
│       └── theme.json      # Bundled theme configuration
└── package.json
```

## Customization

### Theming

OmniMark supports full UI theming. See [THEMING.md](THEMING.md) for details.

The theme file is located at:

- **User config**: `~/.config/omnimark/theme.json` (created on first run)
- **Bundled default**: `public/config/theme.json`

### Color Palettes

Edit the `palettes` section in `theme.json`:

```json
{
  "palettes": [
    {
      "name": "custom",
      "colors": ["#FF0000", "#00FF00", "#0000FF"]
    }
  ],
  "defaultPalette": "custom"
}
```

### Tool Defaults

Configure default tool settings in `theme.json`:

```json
{
  "tools": {
    "pen": {
      "minSize": 1,
      "maxSize": 20,
      "defaultSize": 3
    },
    "highlighter": {
      "opacity": 0.4,
      "minSize": 5,
      "maxSize": 50,
      "defaultSize": 20
    }
  }
}
```

## Building

### Linux

```bash
bun run tauri build
# Outputs:
#   - AppImage: src-tauri/target/release/bundle/appimage/*.AppImage
#   - .deb: src-tauri/target/release/bundle/deb/*.deb
```

## License

MIT License - Feel free to use, modify, and distribute!
