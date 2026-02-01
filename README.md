# OmniMark

A cross-platform image annotation tool inspired by the Windows Snipping Tool. Built with Tauri, React, and TypeScript.

## Features

- **Pen Tool**: Draw freehand lines with adjustable size
- **Highlighter Tool**: Semi-transparent highlighting for emphasizing areas
- **Area Tool**: Rectangle/rounded rectangle highlighting with border
- **Ruler Overlay**: Movable, rotatable ruler with Ctrl+R (scroll to rotate, drag to move)
- **Undo/Redo**: Full history support (Ctrl+Z / Ctrl+Shift+Z)
- **Auto-Copy**: Automatically copies annotated image to clipboard after each stroke
- **Save**: Save annotated images as PNG, JPEG, or WebP

## Keyboard Shortcuts

| Shortcut       | Action                     |
| -------------- | -------------------------- |
| `Ctrl+O`       | Open image                 |
| `Ctrl+S`       | Save image                 |
| `Ctrl+C`       | Copy to clipboard          |
| `Ctrl+Z`       | Undo                       |
| `Ctrl+Shift+Z` | Redo                       |
| `Ctrl+R`       | Toggle ruler               |
| `1`            | Pen tool                   |
| `2`            | Highlighter tool           |
| `3`            | Area tool                  |
| `Shift + drag` | Snap drawing to ruler line |

## Tech Stack

- **Framework**: Tauri 2.x (Rust backend + Web frontend)
- **Frontend**: React 19 + TypeScript
- **Styling**: TailwindCSS + ShadCN/ui components
- **Canvas**: HTML5 Canvas API
- **Build Target**: AppImage (Linux), .deb (Linux)

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
OmniMark/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                # React frontend
│   ├── components/
│   │   ├── canvas/     # Drawing canvas components
│   │   ├── toolbar/    # Toolbar UI
│   │   └── ui/         # ShadCN components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities
│   ├── types/          # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── config/
│       └── palette.json  # Color palette config
└── package.json
```

## Customization

### Color Palettes

Edit `public/config/palette.json` to customize color palettes:

```json
{
  "palettes": [
    {
      "name": "custom",
      "colors": ["#FF0000", "#00FF00", "#0000FF"]
    }
  ]
}
```

### Default Settings

Tool defaults can be configured in the same JSON file:

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

### AppImage (Linux)

```bash
bun run tauri build
# Output: src-tauri/target/release/bundle/appimage/*.AppImage
```

### .deb (Linux)

```bash
bun run tauri build
# Output: src-tauri/target/release/bundle/deb/*.deb
```

## License

MIT License - Feel free to use, modify, and distribute!

## Future Features

- Screenshot functionality
- Circle area selection
- Text annotations
- Arrow annotations
- Custom color picker
- Config file in user directory
- Multi-platform support (Windows, macOS)
