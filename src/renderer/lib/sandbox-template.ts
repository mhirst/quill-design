// Reads the selection agent source at build time via Vite's ?raw import
import selectionAgentSource from '../../iframe/selection-agent.js?raw';

export function buildSandboxDataUri(jsx: string): string {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
    #__error-display {
      display: none;
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      margin: 16px;
      font-family: monospace;
      font-size: 13px;
      color: #991b1b;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="__error-display"></div>

  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer } = React;

    // ── User component ──────────────────────────────────────────────────────
    ${jsx}
    // ───────────────────────────────────────────────────────────────────────

    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } catch (err) {
      const errorEl = document.getElementById('__error-display');
      errorEl.style.display = 'block';
      errorEl.textContent = err.message + '\\n\\n' + err.stack;
    }
  <\/script>

  <script>
    // Runtime error catcher
    window.addEventListener('error', function(e) {
      const errorEl = document.getElementById('__error-display');
      errorEl.style.display = 'block';
      errorEl.textContent = (e.message || String(e)) + (e.filename ? '\\n' + e.filename + ':' + e.lineno : '');
    });

    // Selection agent
    ${selectionAgentSource}
  <\/script>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
