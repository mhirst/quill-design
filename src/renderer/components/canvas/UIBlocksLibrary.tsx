/**
 * UIBlocksLibrary — Curated library of insertable UI wireframe blocks.
 *
 * One-click insert of common UI patterns as grouped shapes on the canvas:
 * - Navigation bars, hero sections, cards, forms, tables, lists
 * - Mobile: tab bars, app headers, chat bubbles
 * - Data viz: stat cards, chart placeholders, KPI blocks
 * - E-commerce: product cards, pricing tables, checkout forms
 *
 * Each block is defined as a factory function returning Shape[] with
 * proper parentId / grouping relationships.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { defaultShape } from '../../lib/shapes';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface UIBlock {
  id: string;
  name: string;
  category: string;
  description: string;
  emoji: string;
  width: number;
  height: number;
  /** Factory: returns shapes to insert, positioned at (offsetX, offsetY) */
  build: (offsetX: number, offsetY: number) => Shape[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Insert all shapes of a block onto the canvas */
  onInsert: (shapes: Shape[], blockName: string) => void;
}

// ── Color tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  muted: '#94a3b8',
  text: '#1e293b',
  textLight: '#64748b',
  accent: '#6366f1',
  accentLight: '#e0e7ff',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  dark: '#0f172a',
  darkSurface: '#1e293b',
};

// ── Shape factory helpers ─────────────────────────────────────────────────────

let _idCounter = 1000;
function uid() { return `blk${++_idCounter}`; }

function rect(
  x: number, y: number, w: number, h: number,
  overrides: Partial<Shape> = {}
): Shape {
  const id = uid();
  const base = defaultShape('rectangle',id);
  return {
    ...base,
    id,
    x, y, width: w, height: h,
    fill: C.surface,
    stroke: 'transparent',
    borderRadius: 0,
    shadow: false,
    ...overrides,
  };
}

function text(
  x: number, y: number, w: number, h: number,
  label: string,
  overrides: Partial<Shape> = {}
): Shape {
  const id = uid();
  const base = defaultShape('text', id);
  return {
    ...base,
    id,
    x, y, width: w, height: h,
    text: label,
    fontSize: 14,
    fontWeight: '400',
    color: C.text,
    fill: 'transparent',
    stroke: 'transparent',
    ...overrides,
  };
}

function ellipse(
  x: number, y: number, w: number, h: number,
  overrides: Partial<Shape> = {}
): Shape {
  const id = uid();
  const base = defaultShape('ellipse', id);
  return {
    ...base,
    id,
    x, y, width: w, height: h,
    fill: C.muted,
    stroke: 'transparent',
    shadow: false,
    ...overrides,
  };
}

function group(children: Shape[], label?: string): Shape {
  const groupId = uid();
  const xs = children.map(c => c.x);
  const ys = children.map(c => c.y);
  const x2s = children.map(c => c.x + c.width);
  const y2s = children.map(c => c.y + c.height);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...x2s);
  const maxY = Math.max(...y2s);

  const groupShape: Shape = {
    ...defaultShape('rectangle',groupId),
    id: groupId,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    fill: 'transparent',
    stroke: 'transparent',
    isGroup: true,
    name: label ?? 'Group',
    shadow: false,
  };

  // Set parentId on children
  const childrenWithParent = children.map(c => ({ ...c, parentId: groupId }));
  return groupShape;
  // Note: returns group shape; children must be inserted separately with parentId
}

// ── UI Block definitions ──────────────────────────────────────────────────────

function buildNavbar(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  // Background bar
  const bg = rect(ox, oy, 800, 64, { fill: C.surface, stroke: C.border, strokeWidth: 1, name: 'Navbar' });
  shapes.push(bg);

  // Logo placeholder
  const logo = rect(ox + 24, oy + 16, 120, 32, { fill: C.accent, borderRadius: 6, name: 'Logo' });
  shapes.push(logo);

  // Nav items
  ['Home', 'About', 'Services', 'Contact'].forEach((label, i) => {
    shapes.push(text(ox + 200 + i * 100, oy + 22, 80, 20, label, { fontSize: 14, color: C.textLight }));
  });

  // CTA button
  const cta = rect(ox + 700, oy + 16, 76, 32, { fill: C.accent, borderRadius: 8, name: 'CTA Button' });
  shapes.push(cta);
  shapes.push(text(ox + 716, oy + 23, 44, 18, 'Sign In', { fontSize: 12, color: '#ffffff', fontWeight: '600' }));

  // Group all with parentId
  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 800, height: 64, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Navbar', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildHeroSection(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  // Background
  shapes.push(rect(ox, oy, 800, 480, {
    fill: C.dark,
    name: 'Hero BG',
  }));

  // Decorative blob
  shapes.push(ellipse(ox + 500, oy + 100, 300, 300, {
    fill: C.accent,
    fillOpacity: 0.15,
  }));

  // Eyebrow text
  shapes.push(text(ox + 80, oy + 120, 200, 24, '✦ NEW RELEASE', { fontSize: 11, color: C.accent, fontWeight: '700', letterSpacing: 12 }));

  // Headline
  shapes.push(text(ox + 80, oy + 160, 520, 80, 'Build something amazing today', { fontSize: 42, fontWeight: '800', color: '#ffffff', lineHeight: 1.15 }));

  // Subtext
  shapes.push(text(ox + 80, oy + 264, 440, 56, 'A platform for teams to design, develop, and ship products faster than ever before.', { fontSize: 16, color: C.muted, lineHeight: 1.6 }));

  // CTA buttons
  shapes.push(rect(ox + 80, oy + 348, 160, 48, { fill: C.accent, borderRadius: 10, name: 'Primary CTA' }));
  shapes.push(text(ox + 124, oy + 361, 72, 22, 'Get Started', { fontSize: 15, fontWeight: '600', color: '#fff' }));
  shapes.push(rect(ox + 256, oy + 348, 140, 48, { fill: 'transparent', stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1.5, borderRadius: 10, name: 'Secondary CTA' }));
  shapes.push(text(ox + 286, oy + 361, 80, 22, 'See Demo →', { fontSize: 15, color: 'rgba(255,255,255,0.7)' }));

  // Image placeholder
  shapes.push(rect(ox + 520, oy + 80, 260, 320, { fill: 'rgba(99,102,241,0.15)', borderRadius: 12, stroke: 'rgba(99,102,241,0.2)', strokeWidth: 1, name: 'Hero Image' }));
  shapes.push(text(ox + 590, oy + 220, 120, 40, '🖼\nImage', { fontSize: 14, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }));

  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 800, height: 480, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Hero Section', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildCard(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  // Card bg
  shapes.push(rect(ox, oy, 280, 340, { fill: C.surface, borderRadius: 12, shadow: true, shadowX: 0, shadowY: 4, shadowBlur: 16, shadowColor: 'rgba(0,0,0,0.08)', name: 'Card' }));

  // Image placeholder
  shapes.push(rect(ox, oy, 280, 160, { fill: C.accentLight, borderRadius: 0, name: 'Card Image', fillType: 'linear-gradient', gradientAngle: 135, gradientStops: [{ color: '#818cf8', position: 0 }, { color: '#6366f1', position: 1 }] }));

  // Rounded corners on image
  shapes.push(rect(ox + 8, oy + 8, 48, 48, { fill: 'rgba(255,255,255,0.2)', borderRadius: 24, name: 'Avatar' }));
  shapes.push(text(ox + 20, oy + 18, 24, 24, '◉', { fontSize: 20, color: 'white' }));

  // Tag
  shapes.push(rect(ox + 20, oy + 176, 64, 20, { fill: C.accentLight, borderRadius: 6, name: 'Tag' }));
  shapes.push(text(ox + 30, oy + 179, 44, 14, 'Design', { fontSize: 10, color: C.accent, fontWeight: '600' }));

  // Title
  shapes.push(text(ox + 20, oy + 208, 240, 48, 'Design systems at scale: a practical guide', { fontSize: 16, fontWeight: '700', color: C.text, lineHeight: 1.4}));

  // Author row
  shapes.push(ellipse(ox + 20, oy + 272, 28, 28, { fill: C.muted }));
  shapes.push(text(ox + 56, oy + 277, 120, 18, 'Sarah Chen · 5 min', { fontSize: 11, color: C.textLight }));

  // Action button
  shapes.push(rect(ox + 20, oy + 296, 240, 32, { fill: C.accent, borderRadius: 8, name: 'Read Button' }));
  shapes.push(text(ox + 100, oy + 305, 80, 14, 'Read Article', { fontSize: 12, fontWeight: '600', color: '#fff' }));

  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 280, height: 340, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Article Card', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildPricingCard(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  // Background
  shapes.push(rect(ox, oy, 260, 420, { fill: C.dark, borderRadius: 16, shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 32, shadowColor: 'rgba(99,102,241,0.3)', name: 'Pricing Card' }));

  // Popular badge
  shapes.push(rect(ox + 80, oy - 12, 100, 24, { fill: C.accent, borderRadius: 12, name: 'Badge' }));
  shapes.push(text(ox + 95, oy - 6, 70, 16, '✦ POPULAR', { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 8 }));

  // Plan name
  shapes.push(text(ox + 24, oy + 28, 160, 28, 'Pro Plan', { fontSize: 20, fontWeight: '800', color: '#fff' }));

  // Price
  shapes.push(text(ox + 24, oy + 68, 160, 56, '$29', { fontSize: 40, fontWeight: '900', color: '#fff' }));
  shapes.push(text(ox + 80, oy + 100, 80, 20, '/month', { fontSize: 12, color: C.muted }));

  // Features list
  const features = ['Unlimited projects', '50GB storage', 'Team collaboration', 'Priority support', 'Analytics dashboard'];
  features.forEach((feat, i) => {
    shapes.push(text(ox + 44, oy + 148 + i * 32, 180, 20, '✓  ' + feat, { fontSize: 12, color: 'rgba(255,255,255,0.75)' }));
    shapes.push(rect(ox + 24, oy + 150 + i * 32, 16, 16, { fill: C.success, borderRadius: 8, name: 'Check' }));
  });

  // CTA
  shapes.push(rect(ox + 20, oy + 356, 220, 44, { fill: C.accent, borderRadius: 10, name: 'CTA' }));
  shapes.push(text(ox + 72, oy + 369, 116, 18, 'Start Free Trial', { fontSize: 13, fontWeight: '700', color: '#fff' }));

  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 260, height: 420, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Pricing Card', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildFormPanel(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  // Panel bg
  shapes.push(rect(ox, oy, 400, 520, { fill: C.surface, borderRadius: 16, shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowColor: 'rgba(0,0,0,0.08)' }));

  // Header
  shapes.push(text(ox + 32, oy + 32, 200, 28, 'Create Account', { fontSize: 22, fontWeight: '800', color: C.text }));
  shapes.push(text(ox + 32, oy + 64, 280, 20, 'Join thousands of happy users', { fontSize: 14, color: C.textLight }));

  // Fields
  const fields = [
    { label: 'Full name', y: 112, placeholder: 'John Doe' },
    { label: 'Email address', y: 192, placeholder: 'john@example.com' },
    { label: 'Password', y: 272, placeholder: '••••••••' },
  ];
  fields.forEach(f => {
    shapes.push(text(ox + 32, oy + f.y, 120, 18, f.label, { fontSize: 12, fontWeight: '600', color: C.textLight }));
    shapes.push(rect(ox + 32, oy + f.y + 22, 336, 44, { fill: C.bg, stroke: C.border, strokeWidth: 1.5, borderRadius: 8 }));
    shapes.push(text(ox + 52, oy + f.y + 35, 240, 18, f.placeholder, { fontSize: 14, color: '#c8d3df' }));
  });

  // Remember me
  shapes.push(rect(ox + 32, oy + 360, 16, 16, { fill: C.accent, borderRadius: 4 }));
  shapes.push(text(ox + 56, oy + 360, 200, 16, 'Remember me for 30 days', { fontSize: 12, color: C.textLight }));

  // Submit button
  shapes.push(rect(ox + 32, oy + 396, 336, 48, { fill: C.accent, borderRadius: 10 }));
  shapes.push(text(ox + 148, oy + 411, 104, 18, 'Create Account', { fontSize: 15, fontWeight: '700', color: '#fff' }));

  // Login link
  shapes.push(text(ox + 120, oy + 464, 160, 18, 'Already have an account? Sign in', { fontSize: 12, color: C.accent, textAlign: 'center' }));

  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 400, height: 520, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Signup Form', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildStatCard(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  const stats = [
    { label: 'Total Revenue', value: '$48,234', change: '+12.5%', color: C.success, icon: '💰' },
    { label: 'Active Users', value: '8,429', change: '+8.1%', color: C.accent, icon: '👥' },
    { label: 'Orders', value: '1,234', change: '-2.3%', color: C.warning, icon: '📦' },
    { label: 'Conversion', value: '3.24%', change: '+0.8%', color: C.success, icon: '📈' },
  ];

  stats.forEach((stat, i) => {
    const sx = ox + (i % 2) * 220;
    const sy = oy + Math.floor(i / 2) * 100;

    shapes.push(rect(sx, sy, 200, 88, { fill: C.surface, borderRadius: 10, shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.06)' }));
    shapes.push(text(sx + 16, sy + 14, 120, 16, stat.label, { fontSize: 11, color: C.textLight }));
    shapes.push(text(sx + 16, sy + 36, 140, 28, stat.value, { fontSize: 22, fontWeight: '800', color: C.text }));
    shapes.push(rect(sx + 16, sy + 66, 60, 16, {
      fill: stat.change.startsWith('+') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      borderRadius: 4
    }));
    shapes.push(text(sx + 24, sy + 68, 44, 12, stat.change, { fontSize: 10, color: stat.change.startsWith('+') ? C.success : C.danger, fontWeight: '600' }));
    shapes.push(text(sx + 160, sy + 16, 28, 28, stat.icon, { fontSize: 20 }));
  });

  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 440, height: 212, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Stat Cards', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildMobileApp(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  // Phone frame
  shapes.push(rect(ox, oy, 320, 640, { fill: C.dark, borderRadius: 36, shadow: true, shadowX: 0, shadowY: 24, shadowBlur: 48, shadowColor: 'rgba(0,0,0,0.4)' }));

  // Screen
  shapes.push(rect(ox + 8, oy + 8, 304, 624, { fill: C.surface, borderRadius: 30 }));

  // Status bar
  shapes.push(text(ox + 24, oy + 20, 60, 16, '9:41', { fontSize: 12, fontWeight: '700', color: C.text }));

  // App header
  shapes.push(text(ox + 24, oy + 56, 200, 28, 'Good morning, Alex 👋', { fontSize: 16, fontWeight: '700', color: C.text }));

  // Avatar
  shapes.push(ellipse(ox + 268, oy + 56, 36, 36, { fill: C.accentLight }));
  shapes.push(text(ox + 276, oy + 64, 20, 20, '😊', { fontSize: 16 }));

  // Balance card
  shapes.push(rect(ox + 16, oy + 104, 288, 120, { fill: C.accent, borderRadius: 16, fillType: 'linear-gradient', gradientAngle: 135, gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#8b5cf6', position: 1 }] }));
  shapes.push(text(ox + 28, oy + 120, 160, 18, 'Total Balance', { fontSize: 12, color: 'rgba(255,255,255,0.7)' }));
  shapes.push(text(ox + 28, oy + 144, 200, 36, '$12,450.00', { fontSize: 26, fontWeight: '800', color: '#fff' }));
  shapes.push(text(ox + 28, oy + 188, 120, 16, '↑ +2.4% this week', { fontSize: 11, color: 'rgba(255,255,255,0.7)' }));

  // Quick actions
  const actions = ['Send', 'Receive', 'Cards', 'More'];
  actions.forEach((a, i) => {
    const ax = ox + 16 + i * 72;
    shapes.push(rect(ax, oy + 244, 56, 56, { fill: C.accentLight, borderRadius: 16 }));
    shapes.push(text(ax + 16, oy + 256, 24, 24, ['↑', '↓', '💳', '⋮'][i], { fontSize: 16, color: C.accent }));
    shapes.push(text(ax + 4, oy + 306, 48, 16, a, { fontSize: 10, color: C.textLight, textAlign: 'center' }));
  });

  // Recent transactions header
  shapes.push(text(ox + 24, oy + 340, 160, 20, 'Recent Transactions', { fontSize: 14, fontWeight: '700', color: C.text }));

  // Transaction items
  [
    { icon: '🛒', name: 'Supermarket', date: 'Today', amount: '-$34.50' },
    { icon: '☕', name: 'Coffee Shop', date: 'Yesterday', amount: '-$4.80' },
    { icon: '💰', name: 'Salary', date: 'Jan 15', amount: '+$4,200' },
  ].forEach((tx, i) => {
    const ty = oy + 374 + i * 64;
    shapes.push(ellipse(ox + 24, ty, 40, 40, { fill: C.accentLight }));
    shapes.push(text(ox + 30, ty + 12, 28, 20, tx.icon, { fontSize: 16 }));
    shapes.push(text(ox + 76, ty + 8, 140, 18, tx.name, { fontSize: 13, fontWeight: '600', color: C.text }));
    shapes.push(text(ox + 76, ty + 28, 100, 16, tx.date, { fontSize: 11, color: C.muted }));
    shapes.push(text(ox + 220, ty + 12, 80, 18, tx.amount, { fontSize: 13, fontWeight: '700', color: tx.amount.startsWith('+') ? C.success : C.text, textAlign: 'right' }));
  });

  // Tab bar
  shapes.push(rect(ox + 8, oy + 567, 304, 57, { fill: C.surface, borderRadius: 0 }));
  const tabs = ['🏠', '📊', '🔔', '👤'];
  tabs.forEach((icon, i) => {
    shapes.push(text(ox + 44 + i * 68, oy + 578, 32, 32, icon, { fontSize: 20 }));
    if (i === 0) shapes.push(rect(ox + 50 + i * 68, oy + 610, 20, 3, { fill: C.accent, borderRadius: 2 }));
  });

  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 320, height: 640, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Mobile App', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildDashboardLayout(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  // Main frame
  shapes.push(rect(ox, oy, 900, 600, { fill: '#f1f5f9', borderRadius: 0 }));

  // Sidebar
  shapes.push(rect(ox, oy, 200, 600, { fill: C.dark }));
  shapes.push(text(ox + 20, oy + 24, 120, 28, 'Dashboard', { fontSize: 16, fontWeight: '800', color: '#fff' }));
  ['Overview', 'Analytics', 'Reports', 'Users', 'Settings'].forEach((item, i) => {
    shapes.push(rect(ox + 8, oy + 80 + i * 44, 184, 36, { fill: i === 0 ? 'rgba(99,102,241,0.3)' : 'transparent', borderRadius: 8 }));
    shapes.push(text(ox + 28, oy + 88 + i * 44, 140, 20, item, { fontSize: 13, color: i === 0 ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: i === 0 ? '600' : '400' }));
  });

  // Top bar
  shapes.push(rect(ox + 200, oy, 700, 56, { fill: C.surface, shadow: false, stroke: C.border, strokeWidth: 1 }));
  shapes.push(text(ox + 224, oy + 18, 200, 20, 'Analytics Overview', { fontSize: 16, fontWeight: '700', color: C.text }));

  // Date filter
  shapes.push(rect(ox + 588, oy + 12, 120, 32, { fill: C.bg, stroke: C.border, strokeWidth: 1, borderRadius: 6 }));
  shapes.push(text(ox + 600, oy + 19, 96, 18, '📅 Last 30 days', { fontSize: 11, color: C.textLight }));

  // Stat cards row
  const statData = [
    { label: 'Revenue', value: '$48K', color: C.accent },
    { label: 'Users', value: '8.4K', color: C.success },
    { label: 'Orders', value: '1.2K', color: C.warning },
    { label: 'CAC', value: '$24', color: C.danger },
  ];
  statData.forEach((s, i) => {
    shapes.push(rect(ox + 216 + i * 164, oy + 72, 152, 72, { fill: C.surface, borderRadius: 10, shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.06)' }));
    shapes.push(text(ox + 232 + i * 164, oy + 86, 100, 16, s.label, { fontSize: 11, color: C.textLight }));
    shapes.push(text(ox + 232 + i * 164, oy + 106, 120, 28, s.value, { fontSize: 22, fontWeight: '800', color: s.color }));
  });

  // Chart area
  shapes.push(rect(ox + 216, oy + 160, 460, 280, { fill: C.surface, borderRadius: 12, shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.06)' }));
  shapes.push(text(ox + 232, oy + 176, 200, 20, 'Revenue Chart', { fontSize: 13, fontWeight: '700', color: C.text }));

  // Chart bars (simplified)
  const barData = [0.4, 0.65, 0.5, 0.8, 0.6, 0.9, 0.75, 0.55, 0.7, 0.85, 0.9, 1.0];
  barData.forEach((h, i) => {
    shapes.push(rect(ox + 248 + i * 34, oy + 380 - h * 160, 22, h * 160, { fill: C.accentLight, borderRadius: 4 }));
    shapes.push(rect(ox + 250 + i * 34, oy + 380 - h * 160, 18, h * 160, { fill: C.accent, borderRadius: 4, fillOpacity: 0.8 }));
  });

  // Side panel
  shapes.push(rect(ox + 688, oy + 160, 212, 280, { fill: C.surface, borderRadius: 12, shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.06)' }));
  shapes.push(text(ox + 704, oy + 176, 160, 20, 'Top Countries', { fontSize: 13, fontWeight: '700', color: C.text }));
  [['🇺🇸 United States', '42%'], ['🇬🇧 United Kingdom', '18%'], ['🇩🇪 Germany', '12%'], ['🇫🇷 France', '8%']].forEach(([country, pct], i) => {
    shapes.push(text(ox + 704, oy + 210 + i * 44, 140, 16, country, { fontSize: 12, color: C.text }));
    shapes.push(rect(ox + 704, oy + 228 + i * 44, 180, 6, { fill: '#e2e8f0', borderRadius: 3 }));
    shapes.push(rect(ox + 704, oy + 228 + i * 44, 180 * parseInt(pct) / 100, 6, { fill: C.accent, borderRadius: 3 }));
  });

  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 900, height: 600, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Dashboard Layout', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

function buildTableRow(ox: number, oy: number): Shape[] {
  const shapes: Shape[] = [];
  const groupId = uid();

  const cols = ['Name', 'Role', 'Status', 'Joined', 'Actions'];
  const widths = [200, 140, 100, 100, 120];
  let cx = ox;

  // Header
  shapes.push(rect(ox, oy, 660, 44, { fill: C.bg, borderRadius: 0 }));
  cols.forEach((col, i) => {
    shapes.push(text(cx + 12, oy + 14, widths[i] - 16, 16, col, { fontSize: 11, fontWeight: '700', color: C.textLight, letterSpacing: 4 }));
    cx += widths[i];
  });

  // Data rows
  const rows = [
    { name: 'Alice Johnson', avatar: '🧑', role: 'Designer', status: 'Active', joined: 'Jan 2024' },
    { name: 'Bob Chen', avatar: '👨', role: 'Developer', status: 'Inactive', joined: 'Feb 2024' },
    { name: 'Carol Davis', avatar: '👩', role: 'Manager', status: 'Active', joined: 'Mar 2024' },
  ];

  rows.forEach((row, ri) => {
    const ry = oy + 44 + ri * 52;
    shapes.push(rect(ox, ry, 660, 52, { fill: ri % 2 === 0 ? C.surface : C.bg, stroke: C.border, strokeWidth: 0.5 }));

    // Avatar + name
    shapes.push(ellipse(ox + 12, ry + 12, 28, 28, { fill: C.accentLight }));
    shapes.push(text(ox + 17, ry + 17, 18, 18, row.avatar, { fontSize: 14 }));
    shapes.push(text(ox + 48, ry + 10, 140, 16, row.name, { fontSize: 13, fontWeight: '600', color: C.text }));
    shapes.push(text(ox + 48, ry + 28, 140, 14, row.role + '@company.com', { fontSize: 10, color: C.muted }));

    // Role
    shapes.push(text(ox + 212, ry + 18, 116, 16, row.role, { fontSize: 13, color: C.text }));

    // Status badge
    const isActive = row.status === 'Active';
    shapes.push(rect(ox + 352, ry + 14, 72, 22, { fill: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', borderRadius: 11 }));
    shapes.push(text(ox + 370, ry + 18, 36, 14, row.status, { fontSize: 11, fontWeight: '600', color: isActive ? C.success : C.danger }));

    // Joined
    shapes.push(text(ox + 452, ry + 18, 88, 16, row.joined, { fontSize: 12, color: C.textLight }));

    // Actions
    shapes.push(text(ox + 552, ry + 18, 40, 16, 'Edit', { fontSize: 12, color: C.accent, fontWeight: '600' }));
    shapes.push(text(ox + 598, ry + 18, 40, 16, 'Delete', { fontSize: 12, color: C.danger }));
  });

  const totalH = 44 + rows.length * 52;
  const grp: Shape = { ...defaultShape('rectangle',groupId), id: groupId, x: ox, y: oy, width: 660, height: totalH, fill: 'transparent', stroke: 'transparent', isGroup: true, name: 'Data Table', shadow: false };
  return [grp, ...shapes.map(s => ({ ...s, parentId: groupId }))];
}

// ── Block catalog ─────────────────────────────────────────────────────────────

const BLOCKS: UIBlock[] = [
  {
    id: 'navbar',
    name: 'Navigation Bar',
    category: 'Layout',
    description: 'Top nav with logo, links, and CTA',
    emoji: '≡',
    width: 800, height: 64,
    build: buildNavbar,
  },
  {
    id: 'hero',
    name: 'Hero Section',
    category: 'Layout',
    description: 'Full-width hero with headline and CTA',
    emoji: '🚀',
    width: 800, height: 480,
    build: buildHeroSection,
  },
  {
    id: 'article-card',
    name: 'Article Card',
    category: 'Cards',
    description: 'Blog/article card with image and meta',
    emoji: '📰',
    width: 280, height: 340,
    build: buildCard,
  },
  {
    id: 'pricing-card',
    name: 'Pricing Card',
    category: 'Cards',
    description: 'Dark premium pricing card with features',
    emoji: '💎',
    width: 260, height: 420,
    build: buildPricingCard,
  },
  {
    id: 'signup-form',
    name: 'Signup Form',
    category: 'Forms',
    description: 'Complete account creation form',
    emoji: '✍',
    width: 400, height: 520,
    build: buildFormPanel,
  },
  {
    id: 'stat-cards',
    name: 'Stat Cards',
    category: 'Data',
    description: '4 KPI metric cards in a 2×2 grid',
    emoji: '📊',
    width: 440, height: 212,
    build: buildStatCard,
  },
  {
    id: 'mobile-app',
    name: 'Mobile Banking App',
    category: 'Mobile',
    description: 'Full banking app screen wireframe',
    emoji: '📱',
    width: 320, height: 640,
    build: buildMobileApp,
  },
  {
    id: 'dashboard',
    name: 'Analytics Dashboard',
    category: 'Data',
    description: 'Full dashboard with sidebar, charts, tables',
    emoji: '🖥',
    width: 900, height: 600,
    build: buildDashboardLayout,
  },
  {
    id: 'data-table',
    name: 'Data Table',
    category: 'Data',
    description: 'User table with avatars, status, actions',
    emoji: '⊞',
    width: 660, height: 200,
    build: buildTableRow,
  },
];

const CATEGORIES = [...new Set(BLOCKS.map(b => b.category))];

// ── Main Panel ────────────────────────────────────────────────────────────────

export function UIBlocksLibrary({ open, onClose, onInsert }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [inserting, setInserting] = useState<string | null>(null);

  const filteredBlocks = useMemo(() => {
    let list = BLOCKS;
    if (selectedCategory !== 'All') list = list.filter(b => b.category === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.category.toLowerCase().includes(q));
    }
    return list;
  }, [selectedCategory, searchQuery]);

  const handleInsert = useCallback((block: UIBlock) => {
    const shapes = block.build(120, 120);
    setInserting(block.id);
    onInsert(shapes, block.name);
    setTimeout(() => setInserting(null), 600);
  }, [onInsert]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 720,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg,rgba(12,12,22,0.99),rgba(18,10,28,0.99))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          color: '#e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>⊞ UI Blocks Library</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                Insert pre-built UI patterns · {BLOCKS.length} blocks available
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#e2e8f0',
              fontSize: 13,
              outline: 'none',
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['All', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: `1px solid ${selectedCategory === cat ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                  background: selectedCategory === cat ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.02)',
                  color: selectedCategory === cat ? '#c7d2fe' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Block grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {filteredBlocks.map(block => (
              <div
                key={block.id}
                onClick={() => handleInsert(block)}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: `1px solid ${inserting === block.id ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.06)'}`,
                  background: inserting === block.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.4)';
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.07)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                {/* Block preview area */}
                <div style={{
                  width: '100%',
                  height: 80,
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                  fontSize: 32,
                  border: '1px solid rgba(255,255,255,0.04)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Size badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    fontSize: 8,
                    color: '#334155',
                    fontFamily: 'monospace',
                  }}>
                    {block.width}×{block.height}
                  </div>
                  <span>{block.emoji}</span>
                </div>

                {/* Info */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                  {block.name}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
                  {block.description}
                </div>

                {/* Category tag */}
                <div style={{
                  marginTop: 8,
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  fontSize: 9,
                  color: '#818cf8',
                  fontWeight: 600,
                }}>
                  {block.category}
                </div>

                {/* Insert indicator */}
                {inserting === block.id && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 10,
                    background: 'rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                  }}>
                    ✓
                  </div>
                )}
              </div>
            ))}

            {filteredBlocks.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
                No blocks found for "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
