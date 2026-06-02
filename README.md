# Quill

**An AI-native design tool for the web.**

Quill is a lightweight, open-source design canvas that lets you create and iterate on UI designs using natural language — just describe what you want, and your AI of choice generates it. You can also draw shapes directly, inspect and edit any element in real time, and export clean React (JSX), SVG, HTML, or PNG.

---

## Getting Started

You'll need an API key for your chosen AI provider. On first launch, Quill will walk you through setting one up — your key is stored locally and never leaves your machine.

### Option A — Build from source

**Requirements:** Node.js 20+

```bash
git clone https://github.com/mhirst/quill-design.git
cd quill-design
npm install
npm start
```

> First start takes ~30 seconds while Vite compiles everything. Subsequent starts are faster.

### Option B — Browser dev mode (no Electron)

Faster for UI development — runs the renderer in Chrome with full DevTools:

```bash
# Terminal 1 — API backend
npm run dev

# Terminal 2 — Vite renderer
npm run dev:ui
```

Then open `http://localhost:5173`.

---

## Features

- **AI generation** — describe a component or layout in plain English; your AI streams it live onto the canvas
- **Multi-provider AI** — Claude, OpenAI, LM Studio, Ollama, or any OpenAI-compatible endpoint
- **Visual canvas** — draw rectangles, ellipses, text, and freehand vector paths with bezier curves
- **Node editing** — double-click any path to enter node edit mode and drag individual bezier points
- **Components / Symbols** — save any shape or group as a reusable component; edits to the master propagate to all instances
- **Gradient fills** — linear and radial gradients with a draggable stop editor
- **Alignment toolbar** — align and distribute selected shapes with one click
- **Live inspect panel** — click any element to see and edit its properties (position, size, color, typography, opacity)
- **Layers panel** — a full layer tree with reordering, visibility, and lock controls
- **Multi-page support** — add pages and switch between them like a real design tool
- **Export** — copy any frame as JSX, SVG, or HTML, or export as PNG
- **Themes** — light and dark mode out of the box
- **History** — full undo/redo stack across all edits

---

## Usage

1. **Describe** — type what you want in the chat bar: *"a mobile login screen with a gradient background"*
2. **Draw** — select a shape tool (rectangle, ellipse, text, pen) and draw directly on the canvas
3. **Edit** — click any element to inspect and edit its properties; drag handles to resize
4. **Export** — copy the design as JSX, SVG, HTML, or download as PNG

---

## Tech Stack

- **Electron** + **Vite** — cross-platform desktop app with fast HMR dev experience
- **React 19** + **TypeScript** — fully typed renderer
- **Anthropic / OpenAI SDK** — streaming AI generation; works with any OpenAI-compatible provider
- **PostHog** — privacy-respecting usage analytics (respects Do Not Track)

---

## Releasing

Releases are built automatically by GitHub Actions when you push a version tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

This builds for Windows (`.exe`), macOS (`.dmg`), and Linux (`.zip`) and creates a draft GitHub Release with all artifacts attached. Publish the draft when ready.

---

## Contributing

Pull requests welcome. The codebase is a standard Electron + Vite app:

```
src/
├── main/          # Electron main process (IPC, AI API calls, key storage)
├── preload/       # Context bridge
├── renderer/      # React app (canvas, tools, panels, hooks)
│   ├── components/
│   ├── hooks/
│   └── lib/
└── shared/        # Shared types and IPC channel names
```

---

## License

MIT
