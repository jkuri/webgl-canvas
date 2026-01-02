# WebGL Canvas

A high-performance, Figma-like canvas editor built with React, TypeScript, and WebGL.

## Features

### Shape Creation

- **Rectangle** - Create rectangles with customizable corner radius
- **Ellipse** - Draw circles and ellipses
- **Line** - Draw lines with arrow markers
- **Path** - SVG path import support

### Canvas Tools

- **Select Tool** (`V`) - Select, move, resize, and rotate elements
- **Pan Tool** (`H` or `Space`) - Navigate the canvas
- **Zoom** - Scroll wheel to zoom in/out

### Smart Snapping (Figma-style)

- Edge-to-edge alignment guides
- Center alignment with diamond markers
- Gap distribution with distance labels
- 4px snap threshold
- Magenta visual guides

### Layers Panel

- Hierarchical layer view
- Drag selection support
- Group/Ungroup functionality
- Lock/Unlock layers
- Show/Hide visibility toggle
- Right-click context menu with all actions
- Inline layer renaming

### Properties Panel

- Position controls (X, Y, Rotation)
- Size controls (Width, Height)
- Appearance (Opacity, Corner Radius)
- Fill and Stroke color pickers

## Keyboard Shortcuts

| Shortcut | Action |
| -------- | ------ |
| `V` | Select tool |
| `H` | Pan tool |
| `Space` | Hold to pan |
| `⌘/Ctrl + A` | Select all |
| `⌘/Ctrl + C` | Copy |
| `⌘/Ctrl + V` | Paste |
| `⌘/Ctrl + D` | Duplicate |
| `⌘/Ctrl + G` | Group |
| `⌘/Ctrl + Shift + G` | Ungroup |
| `⌘/Ctrl + Shift + L` | Lock/Unlock |
| `⌘/Ctrl + Shift + H` | Show/Hide |
| `]` | Bring Forward |
| `[` | Send Backward |
| `⌘/Ctrl + ]` | Bring to Front |
| `⌘/Ctrl + [` | Send to Back |
| `Arrow Keys` | Move 1px |
| `Shift + Arrow` | Move 10px |
| `Delete/Backspace` | Delete selected |
| `Escape` | Clear selection |

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **WebGL** - Hardware-accelerated rendering
- **Zustand** - State management
- **Tailwind CSS 4** - Styling
- **Vite** - Build tool
- **Base UI** - Headless components
- **Biome** - Linting & formatting

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```txt
src/
├── components/         # React components
│   ├── canvas/        # Canvas-specific components
│   │   ├── webgl-canvas.tsx      # Main canvas component
│   │   ├── layers-panel.tsx      # Layers sidebar
│   │   ├── properties-panel.tsx  # Properties sidebar
│   │   ├── canvas-toolbar.tsx    # Bottom toolbar
│   │   ├── smart-guides.tsx      # Snap guides overlay
│   │   └── ...
│   └── ui/            # Shared UI components (shadcn)
├── core/              # Core functionality
│   ├── webgl-renderer.ts         # WebGL rendering engine
│   ├── hit-testing.ts            # Element hit detection
│   └── snapping.ts               # Smart snapping logic
├── hooks/             # Custom React hooks
│   ├── use-canvas-interactions.ts # Mouse/touch handling
│   ├── use-canvas-controls.ts     # Zoom/pan controls
│   └── use-hotkeys.ts             # Keyboard shortcuts
├── store/             # Zustand store
│   └── canvas-store.ts           # Global canvas state
├── types/             # TypeScript types
│   └── index.ts                  # Element type definitions
└── lib/               # Utilities
    ├── svg-import.ts             # SVG parsing
    └── utils.ts                  # Helper functions
```

## License

MIT
