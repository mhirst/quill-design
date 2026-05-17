/**
 * QuickInsertPanel — press I to open a searchable library of UI primitives.
 *
 * Each "element" is a function that returns a Shape[] (one or more shapes).
 * Selecting one inserts all shapes into the canvas at the given position.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { defaultShape, QUICK_SHAPE_DEFS, type Shape } from '../../lib/shapes';
import { X, Search } from 'lucide-react';

// ── Element factory helpers ────────────────────────────────────────────────────

function rect(overrides: Partial<Shape> & { x: number; y: number; width: number; height: number }): Shape {
  const base = defaultShape('rectangle', uuid());
  return { ...base, ...overrides };
}
function ellipse(overrides: Partial<Shape> & { x: number; y: number; width: number; height: number }): Shape {
  const base = defaultShape('ellipse', uuid());
  return { ...base, ...overrides };
}
function text(overrides: Partial<Shape> & { x: number; y: number; width: number; height: number; text: string }): Shape {
  const base = defaultShape('text', uuid());
  return { ...base, ...overrides };
}
function frame(overrides: Partial<Shape> & { x: number; y: number; width: number; height: number }): Shape {
  const base = defaultShape('frame', uuid());
  return { ...base, ...overrides };
}

// ── UI Primitive definitions ──────────────────────────────────────────────────

export interface UIElement {
  id: string;
  name: string;
  category: string;
  emoji: string;
  preview?: string; // optional description
  build: (x: number, y: number) => Shape[];
}

const ELEMENTS: UIElement[] = [
  // ── Buttons ─────────────────────────────────────────────────────────────────
  {
    id: 'btn-primary',
    name: 'Primary Button',
    category: 'Buttons',
    emoji: '▶',
    build: (x, y) => [
      rect({ x, y, width: 140, height: 40, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 8, name: 'Primary Button' }),
      text({ x: x + 14, y: y + 11, width: 112, height: 18, text: 'Click me', color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center', name: 'Button Label' }),
    ],
  },
  {
    id: 'btn-secondary',
    name: 'Secondary Button',
    category: 'Buttons',
    emoji: '⬜',
    build: (x, y) => [
      rect({ x, y, width: 140, height: 40, fill: 'transparent', stroke: '#6366f1', strokeWidth: 1.5, borderRadius: 8, name: 'Secondary Button' }),
      text({ x: x + 14, y: y + 11, width: 112, height: 18, text: 'Click me', color: '#6366f1', fontSize: 14, fontWeight: '600', textAlign: 'center', name: 'Button Label' }),
    ],
  },
  {
    id: 'btn-ghost',
    name: 'Ghost Button',
    category: 'Buttons',
    emoji: '👻',
    build: (x, y) => [
      rect({ x, y, width: 140, height: 40, fill: 'rgba(99,102,241,0.1)', stroke: 'transparent', strokeWidth: 0, borderRadius: 8, name: 'Ghost Button' }),
      text({ x: x + 14, y: y + 11, width: 112, height: 18, text: 'Click me', color: '#6366f1', fontSize: 14, fontWeight: '500', textAlign: 'center', name: 'Button Label' }),
    ],
  },
  {
    id: 'btn-danger',
    name: 'Danger Button',
    category: 'Buttons',
    emoji: '🔴',
    build: (x, y) => [
      rect({ x, y, width: 140, height: 40, fill: '#ef4444', stroke: 'transparent', strokeWidth: 0, borderRadius: 8, name: 'Danger Button' }),
      text({ x: x + 14, y: y + 11, width: 112, height: 18, text: 'Delete', color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center', name: 'Button Label' }),
    ],
  },
  {
    id: 'btn-icon',
    name: 'Icon Button',
    category: 'Buttons',
    emoji: '⊞',
    build: (x, y) => [
      rect({ x, y, width: 40, height: 40, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 8, name: 'Icon Button' }),
      text({ x: x + 10, y: y + 10, width: 20, height: 20, text: '+', color: '#ffffff', fontSize: 18, fontWeight: '600', textAlign: 'center', name: 'Icon' }),
    ],
  },
  {
    id: 'btn-pill',
    name: 'Pill Button',
    category: 'Buttons',
    emoji: '💊',
    build: (x, y) => [
      rect({ x, y, width: 120, height: 36, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 9999, name: 'Pill Button' }),
      text({ x: x + 16, y: y + 10, width: 88, height: 16, text: 'Action', color: '#ffffff', fontSize: 13, fontWeight: '600', textAlign: 'center', name: 'Button Label' }),
    ],
  },

  // ── Inputs ──────────────────────────────────────────────────────────────────
  {
    id: 'input-text',
    name: 'Text Input',
    category: 'Inputs',
    emoji: '✏️',
    build: (x, y) => [
      rect({ x, y, width: 280, height: 44, fill: '#0f0f1a', stroke: '#334155', strokeWidth: 1, borderRadius: 8, name: 'Text Input' }),
      text({ x: x + 14, y: y + 14, width: 200, height: 16, text: 'Enter text...', color: '#475569', fontSize: 13, fontWeight: '400', name: 'Placeholder' }),
    ],
  },
  {
    id: 'input-search',
    name: 'Search Input',
    category: 'Inputs',
    emoji: '🔍',
    build: (x, y) => [
      rect({ x, y, width: 280, height: 44, fill: '#0f0f1a', stroke: '#334155', strokeWidth: 1, borderRadius: 22, name: 'Search Input' }),
      text({ x: x + 44, y: y + 14, width: 180, height: 16, text: 'Search...', color: '#475569', fontSize: 13, fontWeight: '400', name: 'Placeholder' }),
      ellipse({ x: x + 14, y: y + 14, width: 16, height: 16, fill: '#475569', stroke: 'transparent', strokeWidth: 0, name: 'Search Icon' }),
    ],
  },
  {
    id: 'input-labeled',
    name: 'Labeled Input',
    category: 'Inputs',
    emoji: '📝',
    build: (x, y) => [
      text({ x, y, width: 280, height: 14, text: 'Email address', color: '#94a3b8', fontSize: 11, fontWeight: '600', letterSpacing: 5, name: 'Label' }),
      rect({ x, y: y + 20, width: 280, height: 44, fill: '#0f0f1a', stroke: '#334155', strokeWidth: 1, borderRadius: 8, name: 'Input Field' }),
      text({ x: x + 14, y: y + 34, width: 220, height: 16, text: 'you@example.com', color: '#475569', fontSize: 13, fontWeight: '400', name: 'Placeholder' }),
    ],
  },
  {
    id: 'input-checkbox',
    name: 'Checkbox',
    category: 'Inputs',
    emoji: '☑️',
    build: (x, y) => [
      rect({ x, y, width: 18, height: 18, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Checkbox Checked' }),
      text({ x: x + 2, y: y + 2, width: 14, height: 14, text: '✓', color: '#ffffff', fontSize: 11, fontWeight: '700', textAlign: 'center', name: 'Check' }),
      text({ x: x + 26, y: y + 1, width: 120, height: 16, text: 'Remember me', color: '#e2e8f0', fontSize: 13, name: 'Checkbox Label' }),
    ],
  },
  {
    id: 'input-toggle',
    name: 'Toggle Switch',
    category: 'Inputs',
    emoji: '🔘',
    build: (x, y) => [
      rect({ x, y, width: 44, height: 24, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 12, name: 'Toggle Track' }),
      ellipse({ x: x + 22, y: y + 2, width: 20, height: 20, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0, name: 'Toggle Thumb' }),
    ],
  },
  {
    id: 'input-radio',
    name: 'Radio Group',
    category: 'Inputs',
    emoji: '⚪',
    build: (x, y) => [
      ellipse({ x, y: y + 2, width: 16, height: 16, fill: 'transparent', stroke: '#6366f1', strokeWidth: 2, name: 'Radio Active' }),
      ellipse({ x: x + 4, y: y + 6, width: 8, height: 8, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, name: 'Radio Dot' }),
      text({ x: x + 24, y: y + 2, width: 120, height: 14, text: 'Option A', color: '#e2e8f0', fontSize: 13, name: 'Radio Label 1' }),
      ellipse({ x, y: y + 28, width: 16, height: 16, fill: 'transparent', stroke: '#475569', strokeWidth: 1.5, name: 'Radio Inactive' }),
      text({ x: x + 24, y: y + 30, width: 120, height: 14, text: 'Option B', color: '#94a3b8', fontSize: 13, name: 'Radio Label 2' }),
    ],
  },

  // ── Cards ───────────────────────────────────────────────────────────────────
  {
    id: 'card-basic',
    name: 'Basic Card',
    category: 'Cards',
    emoji: '🃏',
    build: (x, y) => [
      rect({ x, y, width: 280, height: 160, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 12, shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowColor: '#00000040', name: 'Card' }),
      text({ x: x + 20, y: y + 20, width: 200, height: 20, text: 'Card Title', color: '#f1f5f9', fontSize: 16, fontWeight: '600', name: 'Card Title' }),
      text({ x: x + 20, y: y + 48, width: 240, height: 40, text: 'Card description text goes here to explain the content.', color: '#94a3b8', fontSize: 12, lineHeight: 1.6, name: 'Card Body' }),
      rect({ x: x + 20, y: y + 112, width: 100, height: 32, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 6, name: 'Card CTA' }),
      text({ x: x + 20, y: y + 120, width: 100, height: 16, text: 'Learn more', color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'center', name: 'CTA Label' }),
    ],
  },
  {
    id: 'card-image',
    name: 'Image Card',
    category: 'Cards',
    emoji: '🖼️',
    build: (x, y) => [
      rect({ x, y, width: 240, height: 260, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 12, shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowColor: '#00000040', name: 'Image Card' }),
      rect({ x: x + 0, y: y + 0, width: 240, height: 140, fill: '#334155', stroke: 'transparent', strokeWidth: 0, borderRadius: 12, name: 'Card Image Placeholder' }),
      text({ x: x + 84, y: y + 60, width: 72, height: 20, text: '🖼', color: '#64748b', fontSize: 28, textAlign: 'center', name: 'Image Icon' }),
      text({ x: x + 16, y: y + 156, width: 200, height: 18, text: 'Card Title', color: '#f1f5f9', fontSize: 15, fontWeight: '600', name: 'Card Title' }),
      text({ x: x + 16, y: y + 180, width: 208, height: 32, text: 'Short description of this card item.', color: '#94a3b8', fontSize: 12, lineHeight: 1.6, name: 'Card Body' }),
      text({ x: x + 16, y: y + 228, width: 80, height: 14, text: 'Read more →', color: '#6366f1', fontSize: 12, fontWeight: '600', name: 'Card Link' }),
    ],
  },
  {
    id: 'card-stat',
    name: 'Stat Card',
    category: 'Cards',
    emoji: '📊',
    build: (x, y) => [
      rect({ x, y, width: 180, height: 100, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 10, shadow: true, shadowX: 0, shadowY: 4, shadowBlur: 16, shadowColor: '#00000030', name: 'Stat Card' }),
      text({ x: x + 16, y: y + 16, width: 148, height: 12, text: 'TOTAL REVENUE', color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 8, name: 'Stat Label' }),
      text({ x: x + 16, y: y + 36, width: 148, height: 32, text: '$48,295', color: '#f1f5f9', fontSize: 26, fontWeight: '700', name: 'Stat Value' }),
      text({ x: x + 16, y: y + 74, width: 148, height: 12, text: '↑ 12.5% from last month', color: '#10b981', fontSize: 11, name: 'Stat Change' }),
    ],
  },
  {
    id: 'card-profile',
    name: 'Profile Card',
    category: 'Cards',
    emoji: '👤',
    build: (x, y) => [
      rect({ x, y, width: 200, height: 200, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 12, shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 20, shadowColor: '#00000040', name: 'Profile Card' }),
      ellipse({ x: x + 72, y: y + 24, width: 56, height: 56, fill: '#334155', stroke: '#6366f1', strokeWidth: 2, name: 'Avatar' }),
      text({ x: x + 72, y: y + 42, width: 56, height: 20, text: '😊', color: '#94a3b8', fontSize: 22, textAlign: 'center', name: 'Avatar Icon' }),
      text({ x: x + 16, y: y + 96, width: 168, height: 18, text: 'Alex Johnson', color: '#f1f5f9', fontSize: 15, fontWeight: '600', textAlign: 'center', name: 'Name' }),
      text({ x: x + 16, y: y + 118, width: 168, height: 14, text: 'Product Designer', color: '#94a3b8', fontSize: 12, textAlign: 'center', name: 'Role' }),
      rect({ x: x + 40, y: y + 148, width: 120, height: 30, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 6, name: 'Follow Button' }),
      text({ x: x + 40, y: y + 156, width: 120, height: 14, text: 'Follow', color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'center', name: 'Follow Label' }),
    ],
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  {
    id: 'nav-topbar',
    name: 'Top Navigation',
    category: 'Navigation',
    emoji: '📍',
    build: (x, y) => [
      rect({ x, y, width: 480, height: 60, fill: '#0f0f1a', stroke: '#1e293b', strokeWidth: 0, borderRadius: 0, name: 'Nav Bar' }),
      rect({ x: x + 16, y: y + 18, width: 24, height: 24, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Logo' }),
      text({ x: x + 48, y: y + 22, width: 60, height: 16, text: 'AppName', color: '#f1f5f9', fontSize: 14, fontWeight: '700', name: 'Brand' }),
      text({ x: x + 160, y: y + 22, width: 60, height: 16, text: 'Home', color: '#94a3b8', fontSize: 13, textAlign: 'center', name: 'Nav Item 1' }),
      text({ x: x + 228, y: y + 22, width: 60, height: 16, text: 'About', color: '#94a3b8', fontSize: 13, textAlign: 'center', name: 'Nav Item 2' }),
      text({ x: x + 296, y: y + 22, width: 60, height: 16, text: 'Pricing', color: '#6366f1', fontSize: 13, fontWeight: '600', textAlign: 'center', name: 'Nav Active' }),
      rect({ x: x + 404, y: y + 16, width: 64, height: 28, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 6, name: 'CTA Button' }),
      text({ x: x + 404, y: y + 22, width: 64, height: 16, text: 'Sign up', color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'center', name: 'CTA Label' }),
    ],
  },
  {
    id: 'nav-sidebar',
    name: 'Sidebar Menu',
    category: 'Navigation',
    emoji: '☰',
    build: (x, y) => {
      const items = ['Dashboard', 'Analytics', 'Users', 'Settings', 'Help'];
      const shapes: Shape[] = [
        rect({ x, y, width: 200, height: 300, fill: '#0f0f1a', stroke: '#1e293b', strokeWidth: 1, borderRadius: 12, name: 'Sidebar' }),
        text({ x: x + 16, y: y + 16, width: 120, height: 18, text: 'Menu', color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 8, name: 'Menu Label' }),
      ];
      items.forEach((item, i) => {
        const isActive = i === 0;
        shapes.push(rect({ x: x + 8, y: y + 44 + i * 44, width: 184, height: 36, fill: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', stroke: 'transparent', strokeWidth: 0, borderRadius: 8, name: `Nav ${item}` }));
        shapes.push(text({ x: x + 24, y: y + 54 + i * 44, width: 140, height: 16, text: item, color: isActive ? '#6366f1' : '#94a3b8', fontSize: 13, fontWeight: isActive ? '600' : '400', name: `Nav Label ${item}` }));
      });
      return shapes;
    },
  },
  {
    id: 'nav-breadcrumb',
    name: 'Breadcrumb',
    category: 'Navigation',
    emoji: '🍞',
    build: (x, y) => [
      text({ x, y, width: 50, height: 16, text: 'Home', color: '#6366f1', fontSize: 13, name: 'BC Home' }),
      text({ x: x + 54, y, width: 10, height: 16, text: '/', color: '#475569', fontSize: 13, textAlign: 'center', name: 'BC Sep 1' }),
      text({ x: x + 68, y, width: 70, height: 16, text: 'Products', color: '#6366f1', fontSize: 13, name: 'BC Products' }),
      text({ x: x + 142, y, width: 10, height: 16, text: '/', color: '#475569', fontSize: 13, textAlign: 'center', name: 'BC Sep 2' }),
      text({ x: x + 156, y, width: 80, height: 16, text: 'Detail', color: '#94a3b8', fontSize: 13, name: 'BC Current' }),
    ],
  },
  {
    id: 'nav-tabs',
    name: 'Tab Bar',
    category: 'Navigation',
    emoji: '📁',
    build: (x, y) => {
      const tabs = ['Overview', 'Analytics', 'Reports', 'Settings'];
      const shapes: Shape[] = [
        rect({ x, y, width: 360, height: 44, fill: '#0f0f1a', stroke: '#1e293b', strokeWidth: 1, borderRadius: 10, name: 'Tab Container' }),
      ];
      tabs.forEach((tab, i) => {
        const isActive = i === 0;
        const tw = 80;
        shapes.push(rect({ x: x + 4 + i * tw, y: y + 4, width: tw - 4, height: 36, fill: isActive ? '#1e1e3f' : 'transparent', stroke: isActive ? 'rgba(99,102,241,0.3)' : 'transparent', strokeWidth: 1, borderRadius: 7, name: `Tab ${tab}` }));
        shapes.push(text({ x: x + 4 + i * tw, y: y + 14, width: tw - 4, height: 16, text: tab, color: isActive ? '#6366f1' : '#64748b', fontSize: 12, fontWeight: isActive ? '600' : '400', textAlign: 'center', name: `Tab Label ${tab}` }));
      });
      return shapes;
    },
  },

  // ── Badges & Tags ────────────────────────────────────────────────────────────
  {
    id: 'badge-primary',
    name: 'Badge',
    category: 'Badges',
    emoji: '🏷️',
    build: (x, y) => [
      rect({ x, y, width: 56, height: 22, fill: 'rgba(99,102,241,0.15)', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Badge' }),
      text({ x, y: y + 4, width: 56, height: 14, text: 'New', color: '#6366f1', fontSize: 11, fontWeight: '700', textAlign: 'center', letterSpacing: 3, name: 'Badge Text' }),
    ],
  },
  {
    id: 'badge-success',
    name: 'Success Badge',
    category: 'Badges',
    emoji: '✅',
    build: (x, y) => [
      rect({ x, y, width: 68, height: 22, fill: 'rgba(16,185,129,0.12)', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Success Badge' }),
      text({ x, y: y + 4, width: 68, height: 14, text: 'Active', color: '#10b981', fontSize: 11, fontWeight: '700', textAlign: 'center', name: 'Badge Text' }),
    ],
  },
  {
    id: 'badge-error',
    name: 'Error Badge',
    category: 'Badges',
    emoji: '❌',
    build: (x, y) => [
      rect({ x, y, width: 64, height: 22, fill: 'rgba(239,68,68,0.12)', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Error Badge' }),
      text({ x, y: y + 4, width: 64, height: 14, text: 'Failed', color: '#ef4444', fontSize: 11, fontWeight: '700', textAlign: 'center', name: 'Badge Text' }),
    ],
  },
  {
    id: 'badge-tag',
    name: 'Tag',
    category: 'Badges',
    emoji: '#️⃣',
    build: (x, y) => [
      rect({ x, y, width: 60, height: 26, fill: '#0f172a', stroke: '#334155', strokeWidth: 1, borderRadius: 13, name: 'Tag' }),
      text({ x: x + 10, y: y + 6, width: 40, height: 14, text: 'design', color: '#94a3b8', fontSize: 11, textAlign: 'center', name: 'Tag Label' }),
    ],
  },
  {
    id: 'badge-notification',
    name: 'Notification Dot',
    category: 'Badges',
    emoji: '🔴',
    build: (x, y) => [
      ellipse({ x, y, width: 20, height: 20, fill: '#ef4444', stroke: 'transparent', strokeWidth: 0, name: 'Notification Dot' }),
      text({ x, y: y + 4, width: 20, height: 12, text: '3', color: '#ffffff', fontSize: 10, fontWeight: '700', textAlign: 'center', name: 'Count' }),
    ],
  },

  // ── Feedback ─────────────────────────────────────────────────────────────────
  {
    id: 'feedback-alert',
    name: 'Alert Banner',
    category: 'Feedback',
    emoji: '⚠️',
    build: (x, y) => [
      rect({ x, y, width: 360, height: 52, fill: 'rgba(245,158,11,0.1)', stroke: 'rgba(245,158,11,0.3)', strokeWidth: 1, borderRadius: 8, name: 'Alert' }),
      text({ x: x + 16, y: y + 8, width: 24, height: 24, text: '⚠', color: '#f59e0b', fontSize: 18, textAlign: 'center', name: 'Alert Icon' }),
      text({ x: x + 46, y: y + 10, width: 280, height: 14, text: 'Warning: This action cannot be undone.', color: '#f59e0b', fontSize: 13, fontWeight: '600', name: 'Alert Title' }),
      text({ x: x + 46, y: y + 28, width: 280, height: 12, text: 'Please review before proceeding.', color: '#d97706', fontSize: 11, name: 'Alert Body' }),
    ],
  },
  {
    id: 'feedback-success',
    name: 'Success Toast',
    category: 'Feedback',
    emoji: '🎉',
    build: (x, y) => [
      rect({ x, y, width: 300, height: 56, fill: '#0f1a13', stroke: '#166534', strokeWidth: 1, borderRadius: 10, shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 20, shadowColor: '#00000040', name: 'Success Toast' }),
      ellipse({ x: x + 14, y: y + 18, width: 20, height: 20, fill: '#10b981', stroke: 'transparent', strokeWidth: 0, name: 'Success Icon BG' }),
      text({ x: x + 14, y: y + 20, width: 20, height: 16, text: '✓', color: '#ffffff', fontSize: 12, fontWeight: '700', textAlign: 'center', name: 'Check' }),
      text({ x: x + 44, y: y + 12, width: 230, height: 14, text: 'Changes saved successfully!', color: '#f1f5f9', fontSize: 13, fontWeight: '600', name: 'Toast Title' }),
      text({ x: x + 44, y: y + 30, width: 200, height: 12, text: 'Your work has been backed up.', color: '#94a3b8', fontSize: 11, name: 'Toast Body' }),
    ],
  },
  {
    id: 'feedback-progress',
    name: 'Progress Bar',
    category: 'Feedback',
    emoji: '📶',
    build: (x, y) => [
      rect({ x, y: y + 12, width: 280, height: 8, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Progress Track' }),
      rect({ x, y: y + 12, width: 196, height: 8, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Progress Fill' }),
      text({ x, y, width: 200, height: 12, text: 'Upload progress', color: '#94a3b8', fontSize: 11, fontWeight: '500', name: 'Progress Label' }),
      text({ x: x + 248, y, width: 32, height: 12, text: '70%', color: '#6366f1', fontSize: 11, fontWeight: '600', textAlign: 'right', name: 'Progress Value' }),
    ],
  },
  {
    id: 'feedback-skeleton',
    name: 'Skeleton Loader',
    category: 'Feedback',
    emoji: '💀',
    build: (x, y) => [
      ellipse({ x, y, width: 48, height: 48, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, name: 'Skeleton Avatar' }),
      rect({ x: x + 60, y: y + 4, width: 140, height: 14, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Skeleton Name' }),
      rect({ x: x + 60, y: y + 26, width: 90, height: 10, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Skeleton Sub' }),
      rect({ x, y: y + 60, width: 260, height: 10, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Skeleton Line 1' }),
      rect({ x, y: y + 78, width: 240, height: 10, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Skeleton Line 2' }),
      rect({ x, y: y + 96, width: 200, height: 10, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, borderRadius: 4, name: 'Skeleton Line 3' }),
    ],
  },

  // ── Data display ─────────────────────────────────────────────────────────────
  {
    id: 'data-table-row',
    name: 'Table Row',
    category: 'Data',
    emoji: '📋',
    build: (x, y) => {
      const cols = ['Name', 'Status', 'Date', 'Action'];
      const colW = [160, 90, 100, 80];
      const shapes: Shape[] = [
        rect({ x, y, width: colW.reduce((a, b) => a + b, 0), height: 44, fill: '#0f0f1a', stroke: '#1e293b', strokeWidth: 1, borderRadius: 0, name: 'Table Row' }),
      ];
      let cx = x;
      cols.forEach((col, i) => {
        shapes.push(text({ x: cx + 12, y: y + 14, width: colW[i] - 24, height: 16, text: col === 'Status' ? '• Active' : col === 'Action' ? 'Edit' : `Row ${col}`, color: col === 'Status' ? '#10b981' : col === 'Action' ? '#6366f1' : '#e2e8f0', fontSize: 12, fontWeight: col === 'Action' ? '600' : '400', name: `Cell ${col}` }));
        cx += colW[i];
      });
      return shapes;
    },
  },
  {
    id: 'data-avatar-list',
    name: 'Avatar Stack',
    category: 'Data',
    emoji: '👥',
    build: (x, y) => {
      const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981'];
      const shapes: Shape[] = [];
      colors.forEach((color, i) => {
        shapes.push(ellipse({ x: x + i * 24, y, width: 36, height: 36, fill: color, stroke: '#0f0f1a', strokeWidth: 2, name: `Avatar ${i + 1}` }));
        shapes.push(text({ x: x + i * 24, y: y + 10, width: 36, height: 16, text: String.fromCharCode(65 + i), color: '#ffffff', fontSize: 13, fontWeight: '600', textAlign: 'center', name: `Avatar Initial ${i + 1}` }));
      });
      shapes.push(ellipse({ x: x + 4 * 24, y, width: 36, height: 36, fill: '#1e293b', stroke: '#0f0f1a', strokeWidth: 2, name: 'Avatar More' }));
      shapes.push(text({ x: x + 4 * 24, y: y + 10, width: 36, height: 16, text: '+5', color: '#94a3b8', fontSize: 11, fontWeight: '600', textAlign: 'center', name: 'Avatar Count' }));
      return shapes;
    },
  },
  {
    id: 'data-chart-bar',
    name: 'Bar Chart',
    category: 'Data',
    emoji: '📊',
    build: (x, y) => {
      const bars = [60, 85, 40, 70, 55, 90, 48];
      const maxH = 80;
      const shapes: Shape[] = [
        rect({ x, y, width: bars.length * 32 + 8, height: maxH + 30, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Chart Container' }),
      ];
      bars.forEach((val, i) => {
        const h = (val / 100) * maxH;
        shapes.push(rect({ x: x + 8 + i * 32, y: y + maxH - h, width: 24, height: h, fill: i === 5 ? '#6366f1' : 'rgba(99,102,241,0.4)', stroke: 'transparent', strokeWidth: 0, borderRadius: [3, 3, 0, 0], name: `Bar ${i + 1}` }));
      });
      return shapes;
    },
  },

  // ── Layout helpers ──────────────────────────────────────────────────────────
  {
    id: 'layout-divider',
    name: 'Divider',
    category: 'Layout',
    emoji: '─',
    build: (x, y) => [
      rect({ x, y, width: 280, height: 1, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, borderRadius: 0, name: 'Divider' }),
    ],
  },
  {
    id: 'layout-spacer',
    name: 'Spacer Block',
    category: 'Layout',
    emoji: '⬜',
    build: (x, y) => [
      rect({ x, y, width: 100, height: 40, fill: 'rgba(99,102,241,0.05)', stroke: '#334155', strokeWidth: 1, borderRadius: 4, name: 'Spacer' }),
      text({ x, y: y + 14, width: 100, height: 12, text: 'spacer', color: '#334155', fontSize: 10, textAlign: 'center', letterSpacing: 3, name: 'Spacer Label' }),
    ],
  },
  {
    id: 'layout-grid-2col',
    name: '2-Column Grid',
    category: 'Layout',
    emoji: '⚏',
    build: (x, y) => [
      rect({ x, y, width: 140, height: 120, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 8, name: 'Col 1' }),
      rect({ x: x + 152, y, width: 140, height: 120, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 8, name: 'Col 2' }),
    ],
  },
  {
    id: 'layout-grid-3col',
    name: '3-Column Grid',
    category: 'Layout',
    emoji: '⊞',
    build: (x, y) => [
      rect({ x, y, width: 90, height: 100, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 8, name: 'Col 1' }),
      rect({ x: x + 102, y, width: 90, height: 100, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 8, name: 'Col 2' }),
      rect({ x: x + 204, y, width: 90, height: 100, fill: '#1a1a2e', stroke: '#1e293b', strokeWidth: 1, borderRadius: 8, name: 'Col 3' }),
    ],
  },
  {
    id: 'layout-hero',
    name: 'Hero Section',
    category: 'Layout',
    emoji: '🦸',
    build: (x, y) => [
      rect({ x, y, width: 480, height: 280, fill: '#0f0f1a', stroke: 'transparent', strokeWidth: 0, borderRadius: 0, name: 'Hero BG' }),
      rect({ x: x + 60, y: y + 20, width: 100, height: 24, fill: 'rgba(99,102,241,0.15)', stroke: 'transparent', strokeWidth: 0, borderRadius: 12, name: 'Hero Badge' }),
      text({ x: x + 60, y: y + 28, width: 100, height: 12, text: '✦ NEW FEATURE', color: '#6366f1', fontSize: 9, fontWeight: '700', letterSpacing: 5, textAlign: 'center', name: 'Hero Badge Text' }),
      text({ x: x + 40, y: y + 60, width: 400, height: 44, text: 'Build something amazing', color: '#f1f5f9', fontSize: 32, fontWeight: '800', textAlign: 'center', name: 'Hero Headline' }),
      text({ x: x + 80, y: y + 116, width: 320, height: 36, text: 'The fastest way to design beautiful products with an intuitive workflow.', color: '#94a3b8', fontSize: 14, lineHeight: 1.6, textAlign: 'center', name: 'Hero Subline' }),
      rect({ x: x + 136, y: y + 170, width: 120, height: 40, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 8, name: 'Hero CTA Primary' }),
      text({ x: x + 136, y: y + 182, width: 120, height: 16, text: 'Get started', color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center', name: 'CTA Label' }),
      rect({ x: x + 268, y: y + 170, width: 100, height: 40, fill: 'transparent', stroke: '#334155', strokeWidth: 1, borderRadius: 8, name: 'Hero CTA Secondary' }),
      text({ x: x + 268, y: y + 182, width: 100, height: 16, text: 'Learn more', color: '#94a3b8', fontSize: 14, textAlign: 'center', name: 'CTA Label 2' }),
    ],
  },

  // ── Typography ───────────────────────────────────────────────────────────────
  {
    id: 'type-heading',
    name: 'Heading',
    category: 'Typography',
    emoji: 'H',
    build: (x, y) => [
      text({ x, y, width: 300, height: 40, text: 'Section Heading', color: '#f1f5f9', fontSize: 28, fontWeight: '700', name: 'Heading' }),
    ],
  },
  {
    id: 'type-paragraph',
    name: 'Paragraph',
    category: 'Typography',
    emoji: '¶',
    build: (x, y) => [
      text({ x, y, width: 340, height: 60, text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', color: '#94a3b8', fontSize: 14, lineHeight: 1.6, name: 'Paragraph' }),
    ],
  },
  {
    id: 'type-code',
    name: 'Code Block',
    category: 'Typography',
    emoji: '</>',
    build: (x, y) => [
      rect({ x, y, width: 320, height: 80, fill: '#0a0a14', stroke: '#1e293b', strokeWidth: 1, borderRadius: 8, name: 'Code Block' }),
      text({ x: x + 16, y: y + 14, width: 288, height: 52, text: 'const greet = (name) => {\n  return `Hello, ${name}!`;\n};', color: '#10b981', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.6, name: 'Code' }),
    ],
  },
  {
    id: 'type-quote',
    name: 'Blockquote',
    category: 'Typography',
    emoji: '💬',
    build: (x, y) => [
      rect({ x, y, width: 4, height: 60, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 2, name: 'Quote Bar' }),
      text({ x: x + 16, y, width: 280, height: 48, text: '"Design is not just what it looks like. Design is how it works."', color: '#e2e8f0', fontSize: 15, fontStyle: 'italic', lineHeight: 1.6, name: 'Quote Text' }),
      text({ x: x + 16, y: y + 52, width: 200, height: 14, text: '— Steve Jobs', color: '#64748b', fontSize: 12, name: 'Quote Author' }),
    ],
  },

  // ── Geometric Shapes ─────────────────────────────────────────────────────────
  ...QUICK_SHAPE_DEFS.map(def => ({
    id: def.id,
    name: def.label.split(' ').slice(1).join(' '),
    category: 'Geometric',
    emoji: def.label.split(' ')[0],
    build: (x: number, y: number) => [def.make(uuid(), x, y)],
  })),

  // ── Patterns (multi-shape UI patterns) ─────────────────────────────────────
  {
    id: 'pattern-login-form',
    name: 'Login Form',
    category: 'Patterns',
    emoji: '🔐',
    preview: 'Email + password form with submit button',
    build: (x, y) => {
      const bg = rect({ x, y, width: 320, height: 340, fill: '#1a1a2e', stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, borderRadius: 16, name: 'Login Card' });
      const title = text({ x: x + 32, y: y + 32, width: 256, height: 32, text: 'Sign in', color: '#fff', fontSize: 22, fontWeight: '700', name: 'Login Title' });
      const sub = text({ x: x + 32, y: y + 68, width: 256, height: 20, text: 'Enter your credentials to continue', color: 'rgba(255,255,255,0.5)', fontSize: 12, name: 'Login Subtitle' });
      const emailLabel = text({ x: x + 32, y: y + 108, width: 100, height: 16, text: 'Email', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500', name: 'Email Label' });
      const emailInput = rect({ x: x + 32, y: y + 128, width: 256, height: 40, fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, borderRadius: 8, name: 'Email Input' });
      const emailPlaceholder = text({ x: x + 44, y: y + 140, width: 220, height: 16, text: 'you@example.com', color: 'rgba(255,255,255,0.3)', fontSize: 13, name: 'Email Placeholder' });
      const pwLabel = text({ x: x + 32, y: y + 184, width: 100, height: 16, text: 'Password', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500', name: 'Password Label' });
      const pwInput = rect({ x: x + 32, y: y + 204, width: 256, height: 40, fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, borderRadius: 8, name: 'Password Input' });
      const pwPlaceholder = text({ x: x + 44, y: y + 216, width: 220, height: 16, text: '••••••••', color: 'rgba(255,255,255,0.3)', fontSize: 13, name: 'Password Placeholder' });
      const btn = rect({ x: x + 32, y: y + 268, width: 256, height: 44, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 10, name: 'Sign In Button' });
      const btnText = text({ x: x + 32, y: y + 280, width: 256, height: 20, text: 'Sign in →', color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center', name: 'Button Text' });
      return [bg, title, sub, emailLabel, emailInput, emailPlaceholder, pwLabel, pwInput, pwPlaceholder, btn, btnText];
    },
  },
  {
    id: 'pattern-pricing-card',
    name: 'Pricing Card',
    category: 'Patterns',
    emoji: '💳',
    preview: 'Pro pricing card with features list',
    build: (x, y) => {
      const bg = rect({ x, y, width: 240, height: 360, fill: 'linear-gradient(135deg, #6366f1, #a855f7)', fillType: 'linear-gradient' as const, gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }], gradientAngle: 135, stroke: 'transparent', strokeWidth: 0, borderRadius: 16, name: 'Pricing Card' });
      const badge = rect({ x: x + 80, y: y + 20, width: 80, height: 24, fill: 'rgba(255,255,255,0.2)', stroke: 'transparent', strokeWidth: 0, borderRadius: 12, name: 'Popular Badge' });
      const badgeText = text({ x: x + 80, y: y + 26, width: 80, height: 14, text: '⭐ Popular', color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' });
      const planName = text({ x: x + 20, y: y + 60, width: 200, height: 24, text: 'Pro', color: '#fff', fontSize: 20, fontWeight: '800' });
      const price = text({ x: x + 20, y: y + 90, width: 200, height: 44, text: '$29', color: '#fff', fontSize: 40, fontWeight: '800' });
      const perMonth = text({ x: x + 68, y: y + 126, width: 120, height: 16, text: 'per month', color: 'rgba(255,255,255,0.7)', fontSize: 12 });
      const divider = rect({ x: x + 20, y: y + 152, width: 200, height: 1, fill: 'rgba(255,255,255,0.2)', stroke: 'transparent', strokeWidth: 0 });
      const features = ['Unlimited projects', 'Custom domains', 'Priority support', 'Advanced analytics', 'Team collaboration'].map((f, i) =>
        text({ x: x + 28, y: y + 168 + i * 28, width: 192, height: 20, text: `✓  ${f}`, color: 'rgba(255,255,255,0.9)', fontSize: 12 })
      );
      const btn = rect({ x: x + 20, y: y + 312, width: 200, height: 40, fill: '#fff', stroke: 'transparent', strokeWidth: 0, borderRadius: 10, name: 'CTA Button' });
      const btnText = text({ x: x + 20, y: y + 322, width: 200, height: 20, text: 'Get started', color: '#6366f1', fontSize: 13, fontWeight: '700', textAlign: 'center' });
      return [bg, badge, badgeText, planName, price, perMonth, divider, ...features, btn, btnText];
    },
  },
  {
    id: 'pattern-testimonial',
    name: 'Testimonial Card',
    category: 'Patterns',
    emoji: '💬',
    preview: 'Quote card with avatar and attribution',
    build: (x, y) => {
      const bg = rect({ x, y, width: 320, height: 180, fill: '#1e1e2e', stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, borderRadius: 12, name: 'Testimonial Card' });
      const quote = text({ x: x + 20, y: y + 20, width: 20, height: 24, text: '"', color: '#6366f1', fontSize: 32, fontWeight: '800' });
      const body = text({ x: x + 20, y: y + 48, width: 280, height: 64, text: 'This tool has completely transformed how our team designs. Absolutely incredible.', color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6 });
      const avatar = ellipse({ x: x + 20, y: y + 128, width: 36, height: 36, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, name: 'Avatar' });
      const initial = text({ x: x + 20, y: y + 138, width: 36, height: 16, text: 'JD', color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' });
      const name = text({ x: x + 64, y: y + 130, width: 200, height: 18, text: 'Jane Doe', color: '#fff', fontSize: 13, fontWeight: '700' });
      const role = text({ x: x + 64, y: y + 148, width: 200, height: 16, text: 'Head of Design, Acme Corp', color: 'rgba(255,255,255,0.5)', fontSize: 11 });
      return [bg, quote, body, avatar, initial, name, role];
    },
  },
  {
    id: 'pattern-empty-state',
    name: 'Empty State',
    category: 'Patterns',
    emoji: '📭',
    preview: 'Centered empty state with illustration',
    build: (x, y) => {
      const container = rect({ x, y, width: 360, height: 280, fill: 'rgba(255,255,255,0.03)', stroke: 'rgba(255,255,255,0.07)', strokeWidth: 1, borderRadius: 16, name: 'Empty State' });
      const icon = text({ x: x + 140, y: y + 52, width: 80, height: 64, text: '📭', fontSize: 48, textAlign: 'center', color: 'rgba(255,255,255,0.4)', name: 'Icon' });
      const heading = text({ x: x + 40, y: y + 132, width: 280, height: 28, text: 'Nothing here yet', color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' });
      const desc = text({ x: x + 60, y: y + 164, width: 240, height: 36, text: 'Add your first item to get started with this section.', color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 });
      const btn = rect({ x: x + 110, y: y + 216, width: 140, height: 40, fill: '#6366f1', stroke: 'transparent', strokeWidth: 0, borderRadius: 8, name: 'CTA Button' });
      const btnText = text({ x: x + 110, y: y + 228, width: 140, height: 16, text: '+ Add item', color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' });
      return [container, icon, heading, desc, btn, btnText];
    },
  },
  {
    id: 'pattern-notification',
    name: 'Notification Toast',
    category: 'Patterns',
    emoji: '🔔',
    preview: 'Success/error notification toast',
    build: (x, y) => {
      const bg = rect({ x, y, width: 320, height: 64, fill: '#1a1a2e', stroke: 'rgba(34,197,94,0.4)', strokeWidth: 1, borderRadius: 10, name: 'Toast', shadows: [{ x: 0, y: 8, blur: 24, color: 'rgba(0,0,0,0.3)', inset: false }], shadow: true });
      const accent = rect({ x, y, width: 4, height: 64, fill: '#22c55e', stroke: 'transparent', strokeWidth: 0, borderRadius: 10, name: 'Accent Bar' });
      const icon = text({ x: x + 16, y: y + 22, width: 24, height: 24, text: '✓', color: '#22c55e', fontSize: 16, fontWeight: '800' });
      const title = text({ x: x + 48, y: y + 16, width: 240, height: 16, text: 'Success!', color: '#fff', fontSize: 13, fontWeight: '700' });
      const sub = text({ x: x + 48, y: y + 34, width: 240, height: 14, text: 'Your changes have been saved.', color: 'rgba(255,255,255,0.6)', fontSize: 12 });
      const closeBtn = text({ x: x + 292, y: y + 22, width: 20, height: 20, text: '✕', color: 'rgba(255,255,255,0.4)', fontSize: 12 });
      return [bg, accent, icon, title, sub, closeBtn];
    },
  },
];

// ── Category list ────────────────────────────────────────────────────────────

const CATEGORIES = Array.from(new Set(ELEMENTS.map(e => e.category)));

// ── QuickInsertPanel ─────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (shapes: Shape[]) => void;
  insertX?: number;
  insertY?: number;
}

export function QuickInsertPanel({ open, onClose, onInsert, insertX = 200, insertY = 200 }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveCategory(null);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return ELEMENTS.filter(el => {
      if (activeCategory && el.category !== activeCategory) return false;
      if (!q) return true;
      return el.name.toLowerCase().includes(q) || el.category.toLowerCase().includes(q);
    });
  }, [query, activeCategory]);

  const handleInsert = useCallback((el: UIElement) => {
    const shapes = el.build(insertX, insertY);
    onInsert(shapes);
    onClose();
  }, [insertX, insertY, onInsert, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
          width: 660,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                Quick Insert
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                Click to insert a UI element at canvas center · Press <kbd style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px', fontSize: 10 }}>Esc</kbd> to close
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <Search size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search elements…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 13, minWidth: 0,
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0, overflowX: 'auto',
        }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding: '4px 10px', borderRadius: 20,
              border: activeCategory === null ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border)',
              background: activeCategory === null ? 'rgba(99,102,241,0.12)' : 'none',
              color: activeCategory === null ? 'var(--accent)' : 'var(--muted)',
              fontSize: 11, fontWeight: activeCategory === null ? 600 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.1s',
            }}
          >All</button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              style={{
                padding: '4px 10px', borderRadius: 20,
                border: activeCategory === cat ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border)',
                background: activeCategory === cat ? 'rgba(99,102,241,0.12)' : 'none',
                color: activeCategory === cat ? 'var(--accent)' : 'var(--muted)',
                fontSize: 11, fontWeight: activeCategory === cat ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.1s',
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Elements grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              No elements found for "{query}"
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {filtered.map(el => (
                <button
                  key={el.id}
                  onClick={() => handleInsert(el)}
                  title={`Insert ${el.name}`}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 8px 10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 10, cursor: 'pointer',
                    transition: 'all 0.12s',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
                    e.currentTarget.style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Emoji icon */}
                  <div style={{
                    width: 36, height: 36,
                    background: 'rgba(99,102,241,0.1)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: el.emoji.length > 2 ? 12 : 18,
                    fontFamily: el.emoji.length <= 2 ? 'inherit' : 'system-ui',
                    color: el.emoji.length <= 2 ? 'var(--accent)' : 'inherit',
                    fontWeight: el.emoji.length <= 2 ? '700' : '400',
                    letterSpacing: '-0.03em',
                  }}>
                    {el.emoji}
                  </div>
                  {/* Name */}
                  <span style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    lineHeight: 1.3,
                    fontWeight: 500,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    textAlign: 'center',
                    display: 'block',
                  }}>
                    {el.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
            {filtered.length} element{filtered.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
            Press <kbd style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px', fontSize: 9 }}>I</kbd> to open · Double-click shapes to rename
          </span>
        </div>
      </div>
    </div>
  );
}
