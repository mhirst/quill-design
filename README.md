# Quill

**An AI-native design tool for the web, built on Claude.**

Quill is a lightweight, open-source design canvas that lets you create and iterate on UI designs using natural language — just describe what you want, and Claude generates it. You can also draw shapes directly, inspect and edit any element in real time, and export clean React (JSX) or PNG.

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
- **React 18** + **TypeScript** — fully typed renderer
- **Claude (Anthropic API)** — streaming AI generation via the Messages API
- **PostHog** — privacy-respecting usage analytics (respects Do Not Track)

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/settings/keys) (starts with `sk-ant-`)

### Install & run

```bash
git clone https://github.com/mhirst/quill-design.git
cd quill-design
npm install
npm start
```

On first launch, Quill will ask for your Anthropic API key. It's stored locally on your machine and never sent anywhere except to the Anthropic API.

### Alternative: browser dev mode

If you want to run the UI in Chrome without Electron (faster iteration, DevTools):

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend
npm run dev:ui
```

Then open `http://localhost:5173` in Chrome.

### Build a distributable

```bash
npm run make
```

The packaged app will be in `out/`. On Windows this produces a Squirrel installer (`QuillSetup.exe`). Mac/Linux support is planned.

---

## Usage

1. **Draw** — select a shape tool from the toolbar (rectangle, ellipse, text, pen) and draw on the canvas
2. **Describe** — open the AI panel and type what you want: *"a blue card with a shadow and rounded corners"*
3. **Edit** — click any shape to select it, then drag handles to resize or use the inspect panel to change properties
4. **Export** — click JSX to copy the design as React code, or PNG to download an image

---

## Configuration

Quill stores your API key in the system keychain via Electron's `safeStorage`. No config files to manage.

---

## Contributing

Pull requests welcome. The codebase is structured as a standard Electron app:

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
