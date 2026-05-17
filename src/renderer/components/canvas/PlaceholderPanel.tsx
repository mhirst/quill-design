/**
 * PlaceholderPanel — Realistic UI placeholder content generator for Quill.
 *
 * Generates ready-to-use placeholder shapes that look like real content:
 *   - Avatar stacks (circles with initials)
 *   - Skeleton loaders (gray animated rectangles)
 *   - Lorem ipsum text blocks (heading / body / caption)
 *   - Product cards with image + title + price + rating
 *   - User profile blocks
 *   - Navigation bars
 *   - Form fields (label + input + hint)
 *   - Notification items
 *   - Stats / metric cards
 *   - Table rows
 *   - Timeline items
 *
 * Inserts shapes at a sensible offset from current canvas center.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { defaultShape } from '../../lib/shapes';
import { X, Layers, Search } from 'lucide-react';
import { v4 as uuid } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaceholderDef {
  id: string;
  name: string;
  category: string;
  description: string;
  preview: string; // emoji for quick visual
  generate: (x: number, y: number) => Shape[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (shapes: Shape[], name: string) => void;
  canvasCenterX?: number;
  canvasCenterY?: number;
}

// ─── Shape builder helpers ────────────────────────────────────────────────────

function r(
  x: number, y: number, w: number, h: number,
  fill = '#e2e8f0', radius = 4,
  extra: Partial<Shape> = {}
): Shape {
  const s = defaultShape('rectangle', uuid());
  return { ...s, x, y, width: w, height: h, fill, borderRadius: radius, stroke: 'transparent', strokeWidth: 0, ...extra };
}

function t(
  x: number, y: number, w: number, h: number,
  text: string, fontSize = 14, fill = '#1e293b',
  extra: Partial<Shape> = {}
): Shape {
  const s = defaultShape('text', uuid());
  return { ...s, x, y, width: w, height: h, text, fontSize, color: fill, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, fontWeight: '400', ...extra };
}

function circ(x: number, y: number, d: number, fill = '#94a3b8', extra: Partial<Shape> = {}): Shape {
  const s = defaultShape('ellipse', uuid());
  return { ...s, x, y, width: d, height: d, fill, stroke: 'transparent', strokeWidth: 0, borderRadius: 9999, ...extra };
}

// Avatar colors
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444'];
const AVATAR_LABELS = ['JD','AB','MK','TS','LR','PW','ZO','CM'];

// Gray shades for skeleton
const SKEL_LIGHT = '#e2e8f0';
const SKEL_MED = '#cbd5e1';
const SKEL_DARK = '#94a3b8';

// ─── Placeholder generators ────────────────────────────────────────────────────

function avatarStack(x: number, y: number): Shape[] {
  const d = 40;
  const overlap = 12;
  return AVATAR_COLORS.slice(0, 5).map((color, i) => {
    const cx = x + i * (d - overlap);
    return {
      ...circ(cx, y, d, color),
      // Add border to separate overlapping avatars
      stroke: '#1e293b', strokeWidth: 2,
      name: `Avatar ${AVATAR_LABELS[i]}`,
    };
  });
}

function skeletonCard(x: number, y: number): Shape[] {
  return [
    r(x, y, 280, 200, '#1e293b', 12, { name: 'Card BG' }),
    r(x + 16, y + 16, 248, 108, SKEL_DARK, 8, { name: 'Image Skeleton' }),
    r(x + 16, y + 136, 160, 12, SKEL_MED, 6, { name: 'Title Skeleton' }),
    r(x + 16, y + 156, 200, 8, SKEL_LIGHT, 4, { name: 'Body Skeleton' }),
    r(x + 16, y + 172, 120, 8, SKEL_LIGHT, 4, { name: 'Body Skeleton 2' }),
  ];
}

function productCard(x: number, y: number): Shape[] {
  const shapes: Shape[] = [
    r(x, y, 220, 300, '#ffffff', 12, { name: 'Product Card' }),
    r(x, y, 220, 160, '#f1f5f9', 12, { name: 'Product Image BG' }),
    // Price tag
    r(x + 140, y + 128, 64, 24, '#6366f1', 6, { name: 'Price Badge' }),
    t(x + 148, y + 132, 48, 16, '$49.99', 11, '#ffffff', { fontWeight: '700' }),
    // Title
    t(x + 16, y + 176, 188, 18, 'Product Name Here', 14, '#0f172a', { fontWeight: '700' }),
    // Description
    t(x + 16, y + 200, 188, 12, 'Short product description goes here.', 11, '#64748b'),
    t(x + 16, y + 218, 140, 12, 'More details about this item.', 11, '#64748b'),
    // Rating
    t(x + 16, y + 242, 80, 14, '★★★★☆ 4.2', 12, '#f59e0b'),
    // Buy button
    r(x + 16, y + 264, 188, 22, '#6366f1', 11, { name: 'Buy Button' }),
    t(x + 50, y + 268, 120, 14, 'Add to Cart', 12, '#ffffff', { fontWeight: '600' }),
  ];
  return shapes;
}

function profileBlock(x: number, y: number): Shape[] {
  return [
    r(x, y, 280, 96, '#ffffff', 12, { name: 'Profile Block' }),
    circ(x + 16, y + 16, 64, '#6366f1', { name: 'Avatar' }),
    t(x + 16 + 24, y + 32 - 8, 50, 16, 'JD', 18, '#ffffff', { fontWeight: '700', textAlign: 'center' }),
    t(x + 96, y + 20, 168, 18, 'Jane Doe', 15, '#0f172a', { fontWeight: '700' }),
    t(x + 96, y + 40, 168, 14, 'Product Designer at Quill', 12, '#64748b'),
    r(x + 96, y + 62, 60, 22, '#f1f5f9', 11, { name: 'Follow Btn' }),
    t(x + 106, y + 66, 40, 14, '+ Follow', 11, '#475569'),
    r(x + 164, y + 62, 60, 22, '#6366f1', 11, { name: 'Message Btn' }),
    t(x + 174, y + 66, 40, 14, 'Message', 11, '#ffffff'),
  ];
}

function formFields(x: number, y: number): Shape[] {
  const fields: Shape[] = [];
  const fieldDefs = [
    { label: 'Email Address', placeholder: 'you@example.com', y: 0 },
    { label: 'Password', placeholder: '••••••••', y: 70 },
    { label: 'Full Name', placeholder: 'Jane Doe', y: 140 },
  ];
  for (const f of fieldDefs) {
    fields.push(
      t(x, y + f.y, 280, 14, f.label, 12, '#374151', { fontWeight: '600' }),
      r(x, y + f.y + 18, 280, 36, '#f9fafb', 8, { stroke: '#e5e7eb', strokeWidth: 1, name: `Input: ${f.label}` }),
      t(x + 12, y + f.y + 28, 250, 14, f.placeholder, 13, '#9ca3af'),
    );
  }
  fields.push(
    r(x, y + 224, 280, 40, '#6366f1', 8, { name: 'Submit Button' }),
    t(x + 80, y + 233, 120, 20, 'Sign In', 14, '#ffffff', { fontWeight: '700', textAlign: 'center' }),
  );
  return fields;
}

function notificationItem(x: number, y: number): Shape[] {
  return [
    r(x, y, 320, 64, '#ffffff', 8, { name: 'Notification' }),
    circ(x + 12, y + 12, 40, '#3b82f6', { name: 'Notif Avatar' }),
    t(x + 12 + 16, y + 20, 26, 14, 'JD', 12, '#ffffff', { fontWeight: '700' }),
    t(x + 64, y + 14, 220, 14, 'Jane Doe liked your post', 13, '#0f172a', { fontWeight: '600' }),
    t(x + 64, y + 32, 160, 12, '2 minutes ago', 11, '#94a3b8'),
    // Unread dot
    circ(x + 296, y + 22, 10, '#3b82f6', { name: 'Unread' }),
  ];
}

function statsRow(x: number, y: number): Shape[] {
  const stats = [
    { label: 'Users', value: '12.4K', delta: '+12%', color: '#22c55e' },
    { label: 'Revenue', value: '$48.2K', delta: '+8%', color: '#22c55e' },
    { label: 'Churn', value: '2.4%', delta: '-0.3%', color: '#ef4444' },
    { label: 'NPS', value: '72', delta: '+5', color: '#22c55e' },
  ];
  const shapes: Shape[] = [];
  stats.forEach((stat, i) => {
    const sx = x + i * 108;
    shapes.push(
      r(sx, y, 100, 72, '#ffffff', 10, { name: `Stat: ${stat.label}` }),
      t(sx + 10, y + 10, 80, 12, stat.label, 11, '#64748b'),
      t(sx + 10, y + 28, 80, 20, stat.value, 18, '#0f172a', { fontWeight: '800' }),
      t(sx + 10, y + 52, 80, 12, stat.delta, 11, stat.color, { fontWeight: '600' }),
    );
  });
  return shapes;
}

function tableRows(x: number, y: number): Shape[] {
  const shapes: Shape[] = [
    // Header
    r(x, y, 560, 36, '#f8fafc', 0, { name: 'Table Header' }),
    t(x + 16, y + 10, 120, 14, 'Name', 12, '#64748b', { fontWeight: '700' }),
    t(x + 160, y + 10, 120, 14, 'Status', 12, '#64748b', { fontWeight: '700' }),
    t(x + 320, y + 10, 80, 14, 'Date', 12, '#64748b', { fontWeight: '700' }),
    t(x + 440, y + 10, 80, 14, 'Amount', 12, '#64748b', { fontWeight: '700' }),
  ];
  const rows = [
    { name: 'Jane Doe', status: 'Active', date: 'May 14', amount: '$120.00', statusColor: '#22c55e' },
    { name: 'John Smith', status: 'Pending', date: 'May 12', amount: '$80.00', statusColor: '#f59e0b' },
    { name: 'Maria Garcia', status: 'Active', date: 'May 10', amount: '$240.00', statusColor: '#22c55e' },
    { name: 'Lee Wang', status: 'Inactive', date: 'May 8', amount: '$0.00', statusColor: '#ef4444' },
  ];
  rows.forEach((row, i) => {
    const ry = y + 36 + i * 40;
    shapes.push(
      r(x, ry, 560, 40, i % 2 === 0 ? '#ffffff' : '#f8fafc', 0, { name: `Row: ${row.name}` }),
      t(x + 16, ry + 12, 120, 14, row.name, 13, '#0f172a'),
      r(x + 160, ry + 10, 64, 20, `${row.statusColor}20`, 10),
      t(x + 174, ry + 13, 50, 14, row.status, 11, row.statusColor, { fontWeight: '600' }),
      t(x + 320, ry + 12, 80, 14, row.date, 12, '#64748b'),
      t(x + 440, ry + 12, 80, 14, row.amount, 12, '#0f172a', { fontWeight: '600' }),
    );
  });
  return shapes;
}

function timelineItems(x: number, y: number): Shape[] {
  const events = [
    { title: 'Account Created', time: 'May 14, 2024', desc: 'User signed up via email', color: '#22c55e' },
    { title: 'First Purchase', time: 'May 15, 2024', desc: 'Bought Premium plan $49/mo', color: '#6366f1' },
    { title: 'Support Ticket', time: 'May 18, 2024', desc: 'Asked about export features', color: '#f59e0b' },
    { title: 'Renewal', time: 'Jun 14, 2024', desc: 'Auto-renewed for another month', color: '#22c55e' },
  ];
  const shapes: Shape[] = [];
  events.forEach((ev, i) => {
    const ey = y + i * 68;
    // Timeline line
    if (i < events.length - 1) {
      shapes.push(r(x + 11, ey + 24, 2, 56, '#e2e8f0', 1, { name: 'Timeline Line' }));
    }
    // Dot
    shapes.push(circ(x, ey + 8, 24, ev.color, { name: `Event: ${ev.title}` }));
    shapes.push(t(x + 9, ey + 14, 16, 12, '✓', 11, '#ffffff', { fontWeight: '700' }));
    shapes.push(t(x + 36, ey + 8, 260, 14, ev.title, 13, '#0f172a', { fontWeight: '700' }));
    shapes.push(t(x + 36, ey + 25, 160, 12, ev.time, 11, '#94a3b8'));
    shapes.push(t(x + 36, y + i * 68 + 40, 260, 12, ev.desc, 11, '#64748b'));
  });
  return shapes;
}

function loremTextBlock(x: number, y: number): Shape[] {
  return [
    t(x, y, 400, 28, 'The quick brown fox jumps over the lazy dog', 22, '#0f172a', { fontWeight: '800' }),
    t(x, y + 36, 400, 16, 'SUBHEADING TEXT IN ALL CAPS HERE', 12, '#6366f1', { fontWeight: '700', letterSpacing: 8 }),
    t(x, y + 60, 400, 14, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', 14, '#374151'),
    t(x, y + 96, 400, 14, 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis.', 14, '#374151'),
    t(x, y + 132, 400, 12, 'Read more →', 12, '#6366f1', { fontWeight: '600' }),
  ];
}

function imageGrid(x: number, y: number): Shape[] {
  const colors = ['#e0e7ff','#fce7f3','#dcfce7','#fef3c7','#ffe4e6','#dbeafe'];
  const shapes: Shape[] = [];
  const positions = [
    [0, 0, 188, 188],
    [196, 0, 188, 92],
    [196, 100, 88, 88],
    [292, 100, 92, 88],
  ];
  positions.forEach(([px, py, pw, ph], i) => {
    shapes.push(r(x + px, y + py, pw, ph, colors[i] || '#e2e8f0', 8, { name: `Image ${i + 1}` }));
    shapes.push(t(x + px + pw / 2 - 16, y + py + ph / 2 - 8, 32, 16, '🖼', 20));
  });
  return shapes;
}

function chatMessages(x: number, y: number): Shape[] {
  const shapes: Shape[] = [
    r(x, y, 320, 320, '#f8fafc', 12, { name: 'Chat Container' }),
  ];
  const messages = [
    { text: 'Hey, can you review the designs?', mine: false, y: 16 },
    { text: "Sure! I'll take a look right now.", mine: true, y: 64 },
    { text: 'Let me know if anything needs changes.', mine: false, y: 112 },
    { text: 'Looks great! Just one small tweak.', mine: true, y: 160 },
    { text: 'Which part?', mine: false, y: 208 },
    { text: 'The spacing on the card grid.', mine: true, y: 256 },
  ];
  for (const msg of messages) {
    const bw = Math.min(180, msg.text.length * 7);
    const bx = msg.mine ? x + 320 - bw - 16 : x + 16;
    const bc = msg.mine ? '#6366f1' : '#ffffff';
    const tc = msg.mine ? '#ffffff' : '#0f172a';
    const br = msg.mine ? [12, 12, 2, 12] as [number, number, number, number] : [12, 12, 12, 2] as [number, number, number, number];
    shapes.push(
      r(bx, y + msg.y, bw, 36, bc, 0, { borderRadius: br, stroke: msg.mine ? 'transparent' : '#e5e7eb', strokeWidth: msg.mine ? 0 : 1, name: `Msg ${msg.mine ? 'Sent' : 'Recv'}` }),
      t(bx + 8, y + msg.y + 10, bw - 16, 14, msg.text, 12, tc),
    );
  }
  return shapes;
}

// ─── All placeholder definitions ─────────────────────────────────────────────

function makePlaceholders(): PlaceholderDef[] {
  return [
    {
      id: 'avatar-stack', name: 'Avatar Stack', category: 'People', description: '5 overlapping avatar circles', preview: '👤',
      generate: (x, y) => avatarStack(x, y),
    },
    {
      id: 'skeleton-card', name: 'Skeleton Card', category: 'Loading', description: 'Gray loading skeleton card', preview: '▣',
      generate: (x, y) => skeletonCard(x, y),
    },
    {
      id: 'product-card', name: 'Product Card', category: 'E-commerce', description: 'Image + title + price + CTA', preview: '🛒',
      generate: (x, y) => productCard(x, y),
    },
    {
      id: 'profile-block', name: 'User Profile', category: 'People', description: 'Avatar + name + role + buttons', preview: '🙂',
      generate: (x, y) => profileBlock(x, y),
    },
    {
      id: 'form-fields', name: 'Sign In Form', category: 'Forms', description: 'Email + password + submit', preview: '📝',
      generate: (x, y) => formFields(x, y),
    },
    {
      id: 'notification', name: 'Notification Item', category: 'Notifications', description: 'Avatar + text + unread dot', preview: '🔔',
      generate: (x, y) => notificationItem(x, y),
    },
    {
      id: 'stats-row', name: 'Stats Row', category: 'Dashboard', description: '4 metric cards with delta', preview: '📊',
      generate: (x, y) => statsRow(x, y),
    },
    {
      id: 'table', name: 'Data Table', category: 'Dashboard', description: 'Header + 4 data rows', preview: '⊞',
      generate: (x, y) => tableRows(x, y),
    },
    {
      id: 'timeline', name: 'Activity Timeline', category: 'Timeline', description: '4 events with dates + icons', preview: '📅',
      generate: (x, y) => timelineItems(x, y),
    },
    {
      id: 'lorem-text', name: 'Typography Block', category: 'Text', description: 'Heading + subheading + body text', preview: 'Aa',
      generate: (x, y) => loremTextBlock(x, y),
    },
    {
      id: 'image-grid', name: 'Image Gallery Grid', category: 'Media', description: 'Masonry image grid layout', preview: '🖼',
      generate: (x, y) => imageGrid(x, y),
    },
    {
      id: 'chat', name: 'Chat Messages', category: 'Communication', description: 'Back-and-forth chat bubbles', preview: '💬',
      generate: (x, y) => chatMessages(x, y),
    },
  ];
}

const ALL_PLACEHOLDERS = makePlaceholders();
const CATEGORIES = Array.from(new Set(ALL_PLACEHOLDERS.map(p => p.category)));

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PlaceholderPanel({ open, onClose, onInsert, canvasCenterX = 400, canvasCenterY = 300 }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [lastX, setLastX] = useState(canvasCenterX);
  const [lastY, setLastY] = useState(canvasCenterY);

  const filtered = useMemo(() => {
    return ALL_PLACEHOLDERS.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.category.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, activeCategory]);

  const handleInsert = useCallback((placeholder: PlaceholderDef) => {
    // Offset each insertion slightly so they don't pile up
    const x = lastX;
    const y = lastY;
    const shapes = placeholder.generate(x, y);
    onInsert(shapes, placeholder.name);
    setLastX(x + 32);
    setLastY(y + 32);
  }, [lastX, lastY, onInsert]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 48,
      left: 56,
      width: 300,
      maxHeight: 'calc(100vh - 64px)',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 300,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Placeholder Content</span>
        </div>
        <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--subtle)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search placeholders…"
            style={{
              width: '100%', paddingLeft: 26, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        {/* Category chips */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, background: activeCategory === 'all' ? '#6366f1' : 'transparent', border: activeCategory === 'all' ? 'none' : '1px solid var(--border)', color: activeCategory === 'all' ? '#fff' : 'var(--subtle)', cursor: 'pointer' }}
          >All</button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, background: activeCategory === cat ? '#6366f1' : 'transparent', border: activeCategory === cat ? 'none' : '1px solid var(--border)', color: activeCategory === cat ? '#fff' : 'var(--subtle)', cursor: 'pointer' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--subtle)', fontSize: 12 }}>
            No placeholders found
          </div>
        )}
        {filtered.map(p => (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              cursor: 'pointer', transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => handleInsert(p)}
          >
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 8, flexShrink: 0,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              {p.preview}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{p.description}</div>
            </div>

            {/* Insert indicator */}
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, flexShrink: 0 }}>
              + Insert
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid var(--border)', flexShrink: 0,
        fontSize: 10, color: 'var(--subtle)', textAlign: 'center',
      }}>
        Click any item to insert at canvas center
      </div>
    </div>
  );
}
