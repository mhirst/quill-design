import React, { useState, useMemo, useCallback } from 'react';

// ─── Icon data ────────────────────────────────────────────────────────────────

export interface IconDef {
  name: string;
  category: string;
  tags: string[];
  path: string; // SVG path d attribute (viewBox 24x24)
}

export type IconCategory =
  | 'Interface'
  | 'Navigation'
  | 'Communication'
  | 'Media'
  | 'Files'
  | 'Data'
  | 'Weather'
  | 'Social'
  | 'Devices'
  | 'Shapes';

export const ICON_LIBRARY: IconDef[] = [
  // Interface
  { name: 'Home', category: 'Interface', tags: ['house', 'main', 'start'], path: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10' },
  { name: 'Settings', category: 'Interface', tags: ['gear', 'cog', 'config', 'options'], path: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
  { name: 'Search', category: 'Interface', tags: ['find', 'magnify', 'lookup', 'zoom'], path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { name: 'Bell', category: 'Interface', tags: ['notification', 'alert', 'alarm'], path: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0' },
  { name: 'Star', category: 'Interface', tags: ['favorite', 'bookmark', 'rating', 'like'], path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { name: 'Heart', category: 'Interface', tags: ['like', 'love', 'favorite'], path: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
  { name: 'Trash', category: 'Interface', tags: ['delete', 'remove', 'bin', 'waste'], path: 'M3 6h18 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2' },
  { name: 'Edit', category: 'Interface', tags: ['pencil', 'pen', 'write', 'modify'], path: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z' },
  { name: 'Plus', category: 'Interface', tags: ['add', 'create', 'new', 'insert'], path: 'M12 5v14 M5 12h14' },
  { name: 'Minus', category: 'Interface', tags: ['subtract', 'remove', 'decrease'], path: 'M5 12h14' },
  { name: 'X', category: 'Interface', tags: ['close', 'dismiss', 'cancel', 'cross'], path: 'M18 6L6 18 M6 6l12 12' },
  { name: 'Check', category: 'Interface', tags: ['tick', 'done', 'complete', 'ok'], path: 'M20 6L9 17l-5-5' },
  { name: 'Lock', category: 'Interface', tags: ['secure', 'private', 'protect', 'closed'], path: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M17 11V7a5 5 0 00-10 0v4' },
  { name: 'Unlock', category: 'Interface', tags: ['open', 'public', 'accessible'], path: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M17 11V7a5 5 0 00-9.9-1' },
  { name: 'Eye', category: 'Interface', tags: ['view', 'visible', 'see', 'watch'], path: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z' },
  { name: 'Download', category: 'Interface', tags: ['save', 'export', 'get', 'fetch'], path: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3' },
  { name: 'Upload', category: 'Interface', tags: ['send', 'import', 'submit', 'share'], path: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12' },
  { name: 'Share', category: 'Interface', tags: ['send', 'distribute', 'social', 'post'], path: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8 M16 6l-4-4-4 4 M12 2v13' },
  { name: 'Copy', category: 'Interface', tags: ['duplicate', 'clone', 'paste'], path: 'M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1' },
  { name: 'Filter', category: 'Interface', tags: ['sort', 'funnel', 'refine'], path: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z' },

  // Navigation
  { name: 'ChevronRight', category: 'Navigation', tags: ['arrow', 'next', 'forward', 'expand'], path: 'M9 18l6-6-6-6' },
  { name: 'ChevronLeft', category: 'Navigation', tags: ['arrow', 'back', 'previous', 'collapse'], path: 'M15 18l-6-6 6-6' },
  { name: 'ChevronUp', category: 'Navigation', tags: ['arrow', 'up', 'collapse', 'scroll'], path: 'M18 15l-6-6-6 6' },
  { name: 'ChevronDown', category: 'Navigation', tags: ['arrow', 'down', 'expand', 'dropdown'], path: 'M6 9l6 6 6-6' },
  { name: 'ArrowRight', category: 'Navigation', tags: ['next', 'forward', 'east'], path: 'M5 12h14 M12 5l7 7-7 7' },
  { name: 'ArrowLeft', category: 'Navigation', tags: ['back', 'previous', 'west'], path: 'M19 12H5 M12 19l-7-7 7-7' },
  { name: 'ArrowUp', category: 'Navigation', tags: ['north', 'up', 'scroll'], path: 'M12 19V5 M5 12l7-7 7 7' },
  { name: 'ArrowDown', category: 'Navigation', tags: ['south', 'down', 'scroll'], path: 'M12 5v14 M19 12l-7 7-7-7' },
  { name: 'Menu', category: 'Navigation', tags: ['hamburger', 'navigation', 'bars', 'sidebar'], path: 'M3 12h18 M3 6h18 M3 18h18' },
  { name: 'Grid', category: 'Navigation', tags: ['layout', 'table', 'tiles', 'apps'], path: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z' },

  // Communication
  { name: 'Mail', category: 'Communication', tags: ['email', 'message', 'envelope', 'inbox'], path: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6' },
  { name: 'MessageSquare', category: 'Communication', tags: ['chat', 'comment', 'bubble', 'talk'], path: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { name: 'Phone', category: 'Communication', tags: ['call', 'mobile', 'contact', 'dial'], path: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z' },
  { name: 'AtSign', category: 'Communication', tags: ['mention', 'email', 'handle', 'address'], path: 'M12 20a8 8 0 100-16 8 8 0 000 16z M12 14a2 2 0 100-4 2 2 0 000 4z M12 14v1.5a2.5 2.5 0 005 0V12' },
  { name: 'Send', category: 'Communication', tags: ['submit', 'forward', 'dispatch', 'share'], path: 'M22 2L11 13 M22 2L15 22l-4-9-9-4 22-7z' },

  // Media
  { name: 'Play', category: 'Media', tags: ['video', 'start', 'run', 'stream'], path: 'M5 3l14 9-14 9V3z' },
  { name: 'Pause', category: 'Media', tags: ['stop', 'hold', 'wait', 'suspend'], path: 'M6 4h4v16H6z M14 4h4v16h-4z' },
  { name: 'Volume2', category: 'Media', tags: ['sound', 'audio', 'speaker', 'music'], path: 'M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 010 14.14 M15.54 8.46a5 5 0 010 7.07' },
  { name: 'Image', category: 'Media', tags: ['photo', 'picture', 'gallery', 'icon'], path: 'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21' },
  { name: 'Film', category: 'Media', tags: ['movie', 'video', 'cinema', 'clip'], path: 'M2 8h20 M2 16h20 M6 2v20 M18 2v20 M2 2h20a2 2 0 012 2v16a2 2 0 01-2 2H2a2 2 0 01-2-2V4a2 2 0 012-2z' },
  { name: 'Mic', category: 'Media', tags: ['microphone', 'voice', 'record', 'audio'], path: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8' },
  { name: 'Camera', category: 'Media', tags: ['photo', 'capture', 'snapshot', 'picture'], path: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z' },

  // Files
  { name: 'File', category: 'Files', tags: ['document', 'page', 'paper'], path: 'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z M13 2v7h7' },
  { name: 'Folder', category: 'Files', tags: ['directory', 'storage', 'container'], path: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { name: 'FileText', category: 'Files', tags: ['document', 'notes', 'article', 'page'], path: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  { name: 'Link', category: 'Files', tags: ['url', 'chain', 'connect', 'href'], path: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71' },
  { name: 'Paperclip', category: 'Files', tags: ['attach', 'clip', 'file'], path: 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48' },

  // Data
  { name: 'BarChart', category: 'Data', tags: ['graph', 'stats', 'analytics', 'chart'], path: 'M12 20V10 M18 20V4 M6 20v-4' },
  { name: 'PieChart', category: 'Data', tags: ['donut', 'stats', 'analytics', 'chart'], path: 'M21.21 15.89A10 10 0 118 2.83 M22 12A10 10 0 0012 2v10z' },
  { name: 'TrendingUp', category: 'Data', tags: ['growth', 'increase', 'stats', 'analytics'], path: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6' },
  { name: 'Database', category: 'Data', tags: ['storage', 'server', 'records', 'sql'], path: 'M12 2C6.48 2 2 4.24 2 7s4.48 5 10 5 10-2.24 10-5-4.48-5-10-5z M2 7v5c0 2.76 4.48 5 10 5s10-2.24 10-5V7 M2 12v5c0 2.76 4.48 5 10 5s10-2.24 10-5v-5' },
  { name: 'Tag', category: 'Data', tags: ['label', 'category', 'price', 'badge'], path: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01' },

  // Weather
  { name: 'Sun', category: 'Weather', tags: ['sunny', 'day', 'clear', 'bright', 'light'], path: 'M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42' },
  { name: 'Cloud', category: 'Weather', tags: ['overcast', 'storage', 'sky', 'upload'], path: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z' },
  { name: 'CloudRain', category: 'Weather', tags: ['rain', 'wet', 'storm', 'drizzle'], path: 'M16 13v8 M8 13v8 M12 15v8 M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25' },
  { name: 'Wind', category: 'Weather', tags: ['breeze', 'air', 'gust', 'storm'], path: 'M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2' },

  // Social
  { name: 'User', category: 'Social', tags: ['person', 'profile', 'account', 'avatar'], path: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z' },
  { name: 'Users', category: 'Social', tags: ['group', 'team', 'people', 'community'], path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  { name: 'Globe', category: 'Social', tags: ['world', 'web', 'internet', 'earth'], path: 'M12 22a10 10 0 100-20 10 10 0 000 20z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z' },
  { name: 'MapPin', category: 'Social', tags: ['location', 'place', 'pin', 'map', 'marker'], path: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z' },

  // Devices
  { name: 'Smartphone', category: 'Devices', tags: ['mobile', 'phone', 'iphone', 'device'], path: 'M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z M12 18h.01' },
  { name: 'Monitor', category: 'Devices', tags: ['screen', 'desktop', 'display', 'computer'], path: 'M23 3H1v14h22V3z M8 21h8 M12 17v4' },
  { name: 'Laptop', category: 'Devices', tags: ['computer', 'macbook', 'notebook', 'device'], path: 'M3 14l1 7h16l1-7H3z M2 14h20 M5 6a2 2 0 012-2h10a2 2 0 012 2v8H5V6z' },
  { name: 'Printer', category: 'Devices', tags: ['print', 'office', 'fax', 'document'], path: 'M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z' },
  { name: 'Wifi', category: 'Devices', tags: ['wireless', 'network', 'signal', 'internet'], path: 'M5 12.55a11 11 0 0114.08 0 M1.42 9a16 16 0 0121.16 0 M8.53 16.11a6 6 0 016.95 0 M12 20h.01' },

  // Shapes
  { name: 'Circle', category: 'Shapes', tags: ['round', 'dot', 'ellipse', 'ring'], path: 'M12 22a10 10 0 100-20 10 10 0 000 20z' },
  { name: 'Square', category: 'Shapes', tags: ['rectangle', 'box', 'frame', 'border'], path: 'M3 3h18v18H3z' },
  { name: 'Triangle', category: 'Shapes', tags: ['arrow', 'play', 'delta', 'peak'], path: 'M12 2L2 22h20L12 2z' },
  { name: 'Hexagon', category: 'Shapes', tags: ['polygon', 'cell', 'bee', 'hex'], path: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { name: 'Diamond', category: 'Shapes', tags: ['rhombus', 'gem', 'card', 'suit'], path: 'M12 2L2 12l10 10 10-10z' },
  { name: 'Octagon', category: 'Shapes', tags: ['stop', 'polygon', 'sign', 'eight'], path: 'M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z' },
];

// ─── Search utility ───────────────────────────────────────────────────────────

export function searchIcons(query: string, category?: string): IconDef[] {
  const q = query.trim().toLowerCase();
  return ICON_LIBRARY.filter(icon => {
    const matchCategory = !category || category === 'All' || icon.category === category;
    if (!matchCategory) return false;
    if (!q) return true;
    return (
      icon.name.toLowerCase().includes(q) ||
      icon.category.toLowerCase().includes(q) ||
      icon.tags.some(t => t.includes(q))
    );
  });
}

export function getAllCategories(): string[] {
  const cats = Array.from(new Set(ICON_LIBRARY.map(i => i.category)));
  return ['All', ...cats.sort()];
}

// ─── SVG rendering helpers ────────────────────────────────────────────────────

export function renderIconSVG(icon: IconDef, size: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
}

export function iconToDataURI(icon: IconDef, size: number, color: string): string {
  const svg = renderIconSVG(icon, size, color);
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function buildSVGPath(icon: IconDef): string {
  return icon.path;
}

// ─── Export as CSS class ──────────────────────────────────────────────────────

export function exportIconCSS(icon: IconDef, color: string): string {
  const uri = iconToDataURI(icon, 24, color);
  const name = icon.name.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1);
  return `.icon-${name} {\n  display: inline-block;\n  width: 24px;\n  height: 24px;\n  background: url("${uri}") no-repeat center;\n  background-size: contain;\n}`;
}

export function exportIconSVGCode(icon: IconDef, size: number, color: string): string {
  return renderIconSVG(icon, size, color);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert?: (icon: IconDef, color: string, size: number) => void;
}

const SIZES = [16, 20, 24, 32, 48, 64];

export function IconSearchPanel({ open, onClose, onInsert }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [color, setColor] = useState('#e2e8f0');
  const [size, setSize] = useState(24);
  const [selected, setSelected] = useState<IconDef | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportType, setExportType] = useState<'svg' | 'css'>('svg');

  if (!open) return null;

  const results = useMemo(() => searchIcons(query, category), [query, category]);
  const categories = useMemo(() => getAllCategories(), []);

  const copyCode = useCallback(async () => {
    if (!selected) return;
    const code = exportType === 'svg'
      ? exportIconSVGCode(selected, size, color)
      : exportIconCSS(selected, color);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selected, exportType, size, color]);

  const handleInsert = () => {
    if (selected && onInsert) {
      onInsert(selected, color, size);
    }
  };

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, right: 16, width: 380,
    background: '#0f172a', border: '1px solid #1e293b',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#38bdf8' }}>✦ Icon Library</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {/* Search */}
        <input
          type="text"
          placeholder="Search icons…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', background: '#1e293b', border: '1px solid #334155',
            borderRadius: 8, color: '#e2e8f0', padding: '7px 12px',
            fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }}
          autoFocus
        />
        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
          {results.length} icon{results.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Category chips */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 14px',
        borderBottom: '1px solid #1e293b', overflowX: 'auto', flexShrink: 0,
      }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '3px 10px', fontSize: 11, borderRadius: 20, flexShrink: 0,
              background: category === cat ? '#0284c7' : '#1e293b',
              border: '1px solid ' + (category === cat ? '#38bdf8' : '#334155'),
              color: category === cat ? '#fff' : '#94a3b8', cursor: 'pointer',
            }}
          >{cat}</button>
        ))}
      </div>

      {/* Icon grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 12,
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
        alignContent: 'start',
      }}>
        {results.map(icon => {
          const isSelected = selected?.name === icon.name;
          return (
            <button
              key={icon.name}
              title={icon.name}
              onClick={() => setSelected(icon)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, padding: '8px 4px',
                background: isSelected ? '#0c4a6e' : '#1e293b',
                border: '1px solid ' + (isSelected ? '#38bdf8' : 'transparent'),
                borderRadius: 8, cursor: 'pointer', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#273548'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#1e293b'; }}
            >
              <svg
                viewBox="0 0 24 24"
                width="22" height="22"
                fill="none"
                stroke={isSelected ? '#38bdf8' : color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={icon.path} />
              </svg>
              <span style={{
                fontSize: 8, color: isSelected ? '#7dd3fc' : '#64748b',
                textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                width: '100%',
              }}>{icon.name}</span>
            </button>
          );
        })}
        {results.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: '#475569', fontSize: 13, textAlign: 'center', padding: 32 }}>
            No icons match "{query}"
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ borderTop: '1px solid #1e293b', padding: 14, flexShrink: 0, background: '#080f1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 56, height: 56, background: '#1e293b', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width={size > 48 ? 40 : size} height={size > 48 ? 40 : size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={selected.path} />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{selected.category}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{selected.tags.join(', ')}</div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 3 }}>Color</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ width: 32, height: 28, border: '1px solid #334155', borderRadius: 4, cursor: 'pointer', padding: 2, background: '#1e293b' }}
                />
                <input type="text" value={color} onChange={e => setColor(e.target.value)}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 3 }}>Size</label>
              <select
                value={size}
                onChange={e => setSize(Number(e.target.value))}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
              >
                {SIZES.map(s => <option key={s} value={s}>{s}×{s}</option>)}
              </select>
            </div>
          </div>

          {/* Export type */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['svg', 'css'] as const).map(t => (
              <button key={t} onClick={() => setExportType(t)}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6,
                  background: exportType === t ? '#0284c7' : '#1e293b',
                  border: '1px solid ' + (exportType === t ? '#38bdf8' : '#334155'),
                  color: exportType === t ? '#fff' : '#94a3b8', cursor: 'pointer',
                }}
              >{t.toUpperCase()}</button>
            ))}
          </div>

          {/* Code preview */}
          <pre style={{
            background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6,
            padding: '8px 10px', fontSize: 10, color: '#7dd3fc', overflowX: 'auto',
            maxHeight: 80, margin: '0 0 8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
          }}>
            {exportType === 'svg'
              ? exportIconSVGCode(selected, size, color).slice(0, 200) + '...'
              : exportIconCSS(selected, color).slice(0, 200) + '...'}
          </pre>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={copyCode} style={{
              flex: 1, padding: '7px 0', background: copied ? '#065f46' : '#1e293b',
              border: '1px solid ' + (copied ? '#10b981' : '#334155'),
              borderRadius: 8, color: copied ? '#6ee7b7' : '#94a3b8',
              fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
            }}>{copied ? '✓ Copied' : 'Copy Code'}</button>
            {onInsert && (
              <button onClick={handleInsert} style={{
                flex: 1, padding: '7px 0',
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>Insert to Canvas</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
