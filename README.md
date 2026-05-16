# Quill

**An AI-native design tool for the web, built on Claude.**

Quill is a lightweight, open-source design canvas that lets you create and iterate on UI designs using natural language — just describe what you want, and Claude generates it. You can also draw shapes directly, inspect and edit any element in real time, and export clean React (JSX) or PNG.

---

## Download

**[→ Download the latest release](https://github.com/mhirst/quill-design/releases/latest)**

Pre-built binaries for Windows, macOS, and Linux are available on the Releases page. No build step required — just download, install, and bring your own [Anthropic API key](https://console.anthropic.com/settings/keys).

---

## Features

- **AI generation** — describe a component or layout in plain English and Claude renders it on the canvas
- **Visual canvas** — draw rectangles, ellipses, text, and freehand vector paths with bezier curves
- **Node editing** — double-click any path to enter node edit mode and drag individual bezier points
- **Live inspect panel** — click any element to see and edit its properties (position, size, color, typography, opacity)
- **Layers panel** — a full layer tree with reordering, visibility, and lock controls
- **Multi-page support** — add pages and switch between them like a real design tool
- **Export** — copy any frame as JSX or export it as a PNG
- **Themes** — light and dark mode out of the box
- **History** — full undo/redo stack across all edits
- **Customizable** — clean, hackable codebase; bring your own Anthropic API key

---

## Tech Stack

- **Electron** + **Vite** — cross-platform desktop app with fast HMR dev experience
- **React 19** + **TypeScript** — fully typed renderer
- **Claude (Anthropic API)** — streaming AI generation via the Messages API
- **PostHog** — privacy-respecting usage analytics (respects Do Not Track)

---

## Getting Started

You'll need an [Anthropic API key](https://console.anthropic.com/settings/keys) (starts with `sk-ant-`). On first launch, Quill will walk you through entering it — your key is stored locally and never leaves your machine.

### Option A — Download a binary (recommended)

Go to [Releases](https://github.com/mhirst/quill-design/releases) and download the build for your platform:

| Platform | File |
|----------|------|
| Windows  | `QuillSetup.exe` |
| macOS    | `Quill.dmg` |
| Linux    | `quill-linux.zip` |

### Option B — Build from source

**Requirements:** Node.js 20+

```bash
git clone https://github.com/mhirst/quill-design.git
cd quill-design
npm install
npm start
```

> First start takes ~30 seconds while Vite compiles everything. Subsequent starts are faster.

### Option C — Browser dev mode (no Electron)

Faster for UI development — runs the renderer in Chrome with full DevTools:

```bash
# Terminal 1 — API backend
npm run dev

# Terminal 2 — Vite renderer
npm run dev:ui
```

Then open `http://localhost:5173`.

---

## Usage

1. **Describe** — type what you want in the chat bar: *"a mobile login screen with a gradient background"*
2. **Draw** — select a shape tool (rectangle, ellipse, text, pen) and draw directly on the canvas
3. **Edit** — click any element to inspect and edit its properties; drag handles to resize
4. **Export** — copy the design as React/JSX or download as PNG

---

## Releasing

Releases are built automatically by GitHub Actions when you push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This builds for Windows (`.exe`), macOS (`.dmg`), and Linux (`.zip`) and creates a draft GitHub Release with all artifacts attached. Publish the draft when ready.

---

## Contributing

Pull requests welcome. The codebase is a standard Electron + Vite app:

```
src/
├── main/          # Electron main process (IPC, Claude API calls, key storage)
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
