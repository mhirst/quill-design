(function () {
  'use strict';

  let selectionEnabled = false;
  let highlightEl = null;
  let selectedEl = null;
  let hoverEl = null;

  // ── Highlight overlay ──────────────────────────────────────────────────────
  function createHighlight(color, zIndex) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid ${color};
      background: ${color}22;
      border-radius: 3px;
      z-index: ${zIndex};
      transition: all 0.1s ease;
      box-sizing: border-box;
    `;
    document.body.appendChild(el);
    return el;
  }

  function positionHighlight(el, target) {
    if (!target) { el.style.display = 'none'; return; }
    const rect = target.getBoundingClientRect();
    el.style.display = 'block';
    el.style.top = rect.top + 'px';
    el.style.left = rect.left + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
  }

  // ── Descriptor builder ─────────────────────────────────────────────────────
  function buildDescriptor(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const classes = Array.from(el.classList)
      .slice(0, 4)
      .map(c => '.' + c)
      .join('');
    return tag + id + classes;
  }

  // ── Collected styles ───────────────────────────────────────────────────────
  function getComputedStyleSnapshot(el) {
    const cs = window.getComputedStyle(el);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      padding: cs.padding,
      margin: cs.margin,
      borderRadius: cs.borderRadius,
      display: cs.display,
    };
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  function onMouseOver(e) {
    if (!selectionEnabled) return;
    if (e.target === document.body || e.target === document.documentElement) return;
    hoverEl = e.target;
    positionHighlight(hoverHighlight, hoverEl);
  }

  function onClick(e) {
    if (!selectionEnabled) return;
    e.preventDefault();
    e.stopPropagation();

    selectedEl = e.target;
    hoverEl = null;
    hoverHighlight.style.display = 'none';
    positionHighlight(selectHighlight, selectedEl);

    const rect = selectedEl.getBoundingClientRect();

    window.parent.postMessage(
      {
        type: 'ELEMENT_SELECTED',
        payload: {
          tagName: selectedEl.tagName,
          id: selectedEl.id || null,
          className: selectedEl.className || '',
          innerText: (selectedEl.innerText || '').slice(0, 200),
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
          computedStyles: getComputedStyleSnapshot(selectedEl),
          descriptor: buildDescriptor(selectedEl),
        },
      },
      '*'
    );
  }

  // ── Message listener (from parent) ─────────────────────────────────────────
  window.addEventListener('message', function (e) {
    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'ENABLE_SELECTION_MODE') {
      selectionEnabled = true;
      document.body.style.cursor = 'crosshair';
    }

    if (msg.type === 'DISABLE_SELECTION_MODE') {
      selectionEnabled = false;
      document.body.style.cursor = '';
      if (hoverHighlight) hoverHighlight.style.display = 'none';
    }

    if (msg.type === 'CLEAR_SELECTION') {
      selectedEl = null;
      if (selectHighlight) selectHighlight.style.display = 'none';
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  var hoverHighlight = createHighlight('#818cf8', 9998);
  hoverHighlight.style.display = 'none';

  var selectHighlight = createHighlight('#6366f1', 9999);
  selectHighlight.style.display = 'none';

  // Label chip on selection highlight
  var chip = document.createElement('div');
  chip.style.cssText = `
    position: absolute;
    top: -22px;
    left: 0;
    background: #6366f1;
    color: white;
    font-size: 11px;
    font-family: monospace;
    padding: 2px 6px;
    border-radius: 3px 3px 0 0;
    white-space: nowrap;
    pointer-events: none;
  `;
  selectHighlight.appendChild(chip);

  // Update chip text when selection changes
  var origPostMessage = window.parent.postMessage.bind(window.parent);
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'ELEMENT_SELECTED') {
      chip.textContent = e.data.payload.descriptor;
    }
    if (e.data && e.data.type === 'CLEAR_SELECTION') {
      chip.textContent = '';
    }
  });

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
})();
