(function () {
  'use strict';

  let selectionEnabled = false;
  let selectedEl = null;
  let hoverEl = null;

  // ── Highlight overlays ─────────────────────────────────────────────────────
  function createHighlight(color, zIndex) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid ${color};
      background: ${color}18;
      border-radius: 3px;
      z-index: ${zIndex};
      box-sizing: border-box;
      transition: top 0.05s, left 0.05s, width 0.05s, height 0.05s;
    `;
    document.body.appendChild(el);
    return el;
  }

  function positionHighlight(overlay, target) {
    if (!target) { overlay.style.display = 'none'; return; }
    const rect = target.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    // Reposition chip above the highlight, clamped to viewport
    if (overlay === selectHighlight && chip) {
      var chipTop = Math.max(0, rect.top - 22);
      var chipLeft = Math.max(0, rect.left);
      chip.style.top = chipTop + 'px';
      chip.style.left = chipLeft + 'px';
    }
  }

  // ── SVG-safe className ─────────────────────────────────────────────────────
  function getClassName(el) {
    if (el.className && typeof el.className === 'object' && 'baseVal' in el.className) {
      return el.className.baseVal || '';
    }
    return typeof el.className === 'string' ? el.className : '';
  }

  function setClassName(el, cls) {
    if (el.className && typeof el.className === 'object' && 'baseVal' in el.className) {
      el.className.baseVal = cls;
    } else {
      el.className = cls;
    }
  }

  // ── Descriptor ─────────────────────────────────────────────────────────────
  function buildDescriptor(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const classList = getClassName(el).split(/\s+/).filter(Boolean);
    const classes = classList.slice(0, 4).map(c => '.' + c).join('');
    return tag + id + classes;
  }

  // ── Computed styles snapshot ───────────────────────────────────────────────
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
      flexDirection: cs.flexDirection,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      gap: cs.gap,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      borderWidth: cs.borderWidth,
      borderColor: cs.borderColor,
      opacity: cs.opacity,
      width: cs.width,
      height: cs.height,
      position: cs.position,
      top: cs.top,
      left: cs.left,
    };
  }

  // ── Send selection to parent ───────────────────────────────────────────────
  function sendSelection(el) {
    selectedEl = el;
    positionHighlight(selectHighlight, selectedEl);
    chip.textContent = buildDescriptor(selectedEl);
    chip.style.display = 'block';

    const rect = el.getBoundingClientRect();
    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      payload: {
        tagName: String(el.tagName),
        id: el.id ? String(el.id) : null,
        className: getClassName(el),
        innerText: (el.innerText || el.textContent || '').slice(0, 200),
        rect: { top: Number(rect.top), left: Number(rect.left), width: Number(rect.width), height: Number(rect.height) },
        computedStyles: getComputedStyleSnapshot(el),
        descriptor: buildDescriptor(el),
      },
    }, '*');
  }

  // ── Drag-to-move state ─────────────────────────────────────────────────────
  let dragEl = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartRect = null;
  let isDragging = false;
  const DRAG_THRESHOLD = 4; // px before we commit to a drag

  function onMouseDown(e) {
    if (!selectionEnabled) return;
    if (!selectedEl) return;
    // Only drag on the already-selected element
    if (e.target !== selectedEl && !selectedEl.contains(e.target)) return;
    dragEl = selectedEl;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartRect = dragEl.getBoundingClientRect();
    isDragging = false;
    document.addEventListener('mousemove', onDragMove, true);
    document.addEventListener('mouseup', onDragEnd, true);
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!dragEl) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    if (!isDragging && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
    isDragging = true;

    // Show drag cursor
    document.body.style.cursor = 'grabbing';

    // Live visual feedback: translate the element
    dragEl.style.transform = `translate(${dx}px, ${dy}px)`;
    dragEl.style.zIndex = '9997';
    dragEl.style.outline = '2px dashed #818cf8';

    window.parent.postMessage({ type: 'ELEMENT_DRAGGING', dx, dy }, '*');
  }

  function onDragEnd(e) {
    document.removeEventListener('mousemove', onDragMove, true);
    document.removeEventListener('mouseup', onDragEnd, true);
    document.body.style.cursor = selectionEnabled ? 'crosshair' : '';

    if (!dragEl || !isDragging) {
      dragEl = null;
      isDragging = false;
      return;
    }

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    // Reset the visual transform
    dragEl.style.transform = '';
    dragEl.style.zIndex = '';
    dragEl.style.outline = '';

    // Send final delta to parent for class patching
    window.parent.postMessage({
      type: 'ELEMENT_DRAG_END',
      dx: Math.round(dx),
      dy: Math.round(dy),
      className: getClassName(dragEl),
      descriptor: buildDescriptor(dragEl),
    }, '*');

    dragEl = null;
    isDragging = false;
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  function onMouseOver(e) {
    if (!selectionEnabled) return;
    if (e.target === document.body || e.target === document.documentElement) return;
    if (isDragging) return;
    hoverEl = e.target;
    positionHighlight(hoverHighlight, hoverEl);
  }

  // Prevent focus on any element while selection mode is active
  function onMouseDownGlobal(e) {
    if (!selectionEnabled) return;
    e.preventDefault(); // stops focus on inputs, buttons, etc.
  }

  function onClick(e) {
    if (!selectionEnabled) return;
    if (isDragging) return; // drag ended, suppress click
    e.preventDefault();
    e.stopPropagation();
    hoverEl = null;
    hoverHighlight.style.display = 'none';
    sendSelection(e.target);
  }

  // ── Layer tree ─────────────────────────────────────────────────────────────
  var SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'HTML', 'META', 'LINK', 'TITLE']);

  function buildDomTree(node, path, depth) {
    if (depth > 6) return null;
    if (node.nodeType !== 1) return null;
    if (SKIP_TAGS.has(node.tagName)) return null;

    var children = [];
    var childIndex = 0;
    for (var i = 0; i < node.childNodes.length; i++) {
      var subtree = buildDomTree(node.childNodes[i], path + '.' + childIndex, depth + 1);
      if (subtree) { children.push(subtree); childIndex++; }
    }

    return {
      tag: node.tagName.toLowerCase(),
      id: node.id || null,
      className: getClassName(node),
      path: path,
      children: children,
    };
  }

  // ── Message listener ───────────────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'ENABLE_SELECTION_MODE') {
      selectionEnabled = true;
      document.body.style.cursor = 'crosshair';
      selectionStyleTag.disabled = false;
    }

    if (msg.type === 'DISABLE_SELECTION_MODE') {
      selectionEnabled = false;
      document.body.style.cursor = '';
      selectionStyleTag.disabled = true;
      if (hoverHighlight) hoverHighlight.style.display = 'none';
    }

    if (msg.type === 'CLEAR_SELECTION') {
      selectedEl = null;
      chip.textContent = '';
      chip.style.display = 'none';
      if (selectHighlight) selectHighlight.style.display = 'none';
    }

    if (msg.type === 'GET_LAYER_TREE') {
      var tree = buildDomTree(document.body, '0', 0);
      window.parent.postMessage({ type: 'LAYER_TREE_RESPONSE', tree: tree }, '*');
    }

    if (msg.type === 'HIGHLIGHT_BY_PATH') {
      var parts = msg.path.split('.');
      var current = document.body;
      for (var i = 1; i < parts.length; i++) {
        var idx = parseInt(parts[i], 10);
        var elementChildren = [];
        for (var j = 0; j < current.childNodes.length; j++) {
          if (current.childNodes[j].nodeType === 1) elementChildren.push(current.childNodes[j]);
        }
        current = elementChildren[idx];
        if (!current) break;
      }
      if (current && current !== document.body) sendSelection(current);
    }

    if (msg.type === 'PATCH_ELEMENT_CLASSES') {
      if (selectedEl) {
        setClassName(selectedEl, msg.newClasses);
        positionHighlight(selectHighlight, selectedEl);
        chip.textContent = buildDescriptor(selectedEl);
      }
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  // Suppress all focus rings while selection mode is active so clicking
  // interactive elements (inputs, buttons) doesn't show native outlines.
  var selectionStyleTag = document.createElement('style');
  selectionStyleTag.textContent = '* { outline: none !important; }';
  selectionStyleTag.disabled = true;
  document.head.appendChild(selectionStyleTag);

  var hoverHighlight = createHighlight('#818cf8', 9998);
  hoverHighlight.style.display = 'none';

  var selectHighlight = createHighlight('#6366f1', 9999);
  selectHighlight.style.display = 'none';

  var chip = document.createElement('div');
  chip.style.cssText = `
    position: fixed; display: none;
    background: #6366f1; color: white;
    font-size: 11px; font-family: monospace;
    padding: 2px 8px; border-radius: 4px 4px 0 0;
    white-space: nowrap; pointer-events: none;
    font-weight: 500; z-index: 10000;
    max-width: 260px; overflow: hidden; text-overflow: ellipsis;
  `;
  document.body.appendChild(chip);

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('mousedown', onMouseDownGlobal, true);
  document.addEventListener('mousedown', onMouseDown, true);
})();
