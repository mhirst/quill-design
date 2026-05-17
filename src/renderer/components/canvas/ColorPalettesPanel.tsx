/**
 * ColorPalettesPanel
 * A floating panel giving designers instant access to popular color palettes:
 * Tailwind CSS v3, Material Design 3, IBM Carbon, Radix UI, and curated pastels.
 *
 * Click any swatch → applies to current selection fill (via onApplyColor).
 * Hover → shows hex value + copy button.
 * Search input filters palette names / hex values.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Search, Copy, Check } from 'lucide-react';

// ─── Palette data ─────────────────────────────────────────────────────────────

interface Palette {
  name: string;
  family: string;
  colors: { label: string; hex: string }[];
}

const TAILWIND: Palette[] = [
  { family: 'Tailwind', name: 'Slate', colors: [
    { label: '50', hex: '#f8fafc' }, { label: '100', hex: '#f1f5f9' }, { label: '200', hex: '#e2e8f0' },
    { label: '300', hex: '#cbd5e1' }, { label: '400', hex: '#94a3b8' }, { label: '500', hex: '#64748b' },
    { label: '600', hex: '#475569' }, { label: '700', hex: '#334155' }, { label: '800', hex: '#1e293b' },
    { label: '900', hex: '#0f172a' }, { label: '950', hex: '#020617' },
  ]},
  { family: 'Tailwind', name: 'Gray', colors: [
    { label: '50', hex: '#f9fafb' }, { label: '100', hex: '#f3f4f6' }, { label: '200', hex: '#e5e7eb' },
    { label: '300', hex: '#d1d5db' }, { label: '400', hex: '#9ca3af' }, { label: '500', hex: '#6b7280' },
    { label: '600', hex: '#4b5563' }, { label: '700', hex: '#374151' }, { label: '800', hex: '#1f2937' },
    { label: '900', hex: '#111827' }, { label: '950', hex: '#030712' },
  ]},
  { family: 'Tailwind', name: 'Red', colors: [
    { label: '50', hex: '#fef2f2' }, { label: '100', hex: '#fee2e2' }, { label: '200', hex: '#fecaca' },
    { label: '300', hex: '#fca5a5' }, { label: '400', hex: '#f87171' }, { label: '500', hex: '#ef4444' },
    { label: '600', hex: '#dc2626' }, { label: '700', hex: '#b91c1c' }, { label: '800', hex: '#991b1b' },
    { label: '900', hex: '#7f1d1d' }, { label: '950', hex: '#450a0a' },
  ]},
  { family: 'Tailwind', name: 'Orange', colors: [
    { label: '50', hex: '#fff7ed' }, { label: '100', hex: '#ffedd5' }, { label: '200', hex: '#fed7aa' },
    { label: '300', hex: '#fdba74' }, { label: '400', hex: '#fb923c' }, { label: '500', hex: '#f97316' },
    { label: '600', hex: '#ea580c' }, { label: '700', hex: '#c2410c' }, { label: '800', hex: '#9a3412' },
    { label: '900', hex: '#7c2d12' }, { label: '950', hex: '#431407' },
  ]},
  { family: 'Tailwind', name: 'Yellow', colors: [
    { label: '50', hex: '#fefce8' }, { label: '100', hex: '#fef9c3' }, { label: '200', hex: '#fef08a' },
    { label: '300', hex: '#fde047' }, { label: '400', hex: '#facc15' }, { label: '500', hex: '#eab308' },
    { label: '600', hex: '#ca8a04' }, { label: '700', hex: '#a16207' }, { label: '800', hex: '#854d0e' },
    { label: '900', hex: '#713f12' }, { label: '950', hex: '#422006' },
  ]},
  { family: 'Tailwind', name: 'Green', colors: [
    { label: '50', hex: '#f0fdf4' }, { label: '100', hex: '#dcfce7' }, { label: '200', hex: '#bbf7d0' },
    { label: '300', hex: '#86efac' }, { label: '400', hex: '#4ade80' }, { label: '500', hex: '#22c55e' },
    { label: '600', hex: '#16a34a' }, { label: '700', hex: '#15803d' }, { label: '800', hex: '#166534' },
    { label: '900', hex: '#14532d' }, { label: '950', hex: '#052e16' },
  ]},
  { family: 'Tailwind', name: 'Teal', colors: [
    { label: '50', hex: '#f0fdfa' }, { label: '100', hex: '#ccfbf1' }, { label: '200', hex: '#99f6e4' },
    { label: '300', hex: '#5eead4' }, { label: '400', hex: '#2dd4bf' }, { label: '500', hex: '#14b8a6' },
    { label: '600', hex: '#0d9488' }, { label: '700', hex: '#0f766e' }, { label: '800', hex: '#115e59' },
    { label: '900', hex: '#134e4a' }, { label: '950', hex: '#042f2e' },
  ]},
  { family: 'Tailwind', name: 'Blue', colors: [
    { label: '50', hex: '#eff6ff' }, { label: '100', hex: '#dbeafe' }, { label: '200', hex: '#bfdbfe' },
    { label: '300', hex: '#93c5fd' }, { label: '400', hex: '#60a5fa' }, { label: '500', hex: '#3b82f6' },
    { label: '600', hex: '#2563eb' }, { label: '700', hex: '#1d4ed8' }, { label: '800', hex: '#1e40af' },
    { label: '900', hex: '#1e3a8a' }, { label: '950', hex: '#172554' },
  ]},
  { family: 'Tailwind', name: 'Indigo', colors: [
    { label: '50', hex: '#eef2ff' }, { label: '100', hex: '#e0e7ff' }, { label: '200', hex: '#c7d2fe' },
    { label: '300', hex: '#a5b4fc' }, { label: '400', hex: '#818cf8' }, { label: '500', hex: '#6366f1' },
    { label: '600', hex: '#4f46e5' }, { label: '700', hex: '#4338ca' }, { label: '800', hex: '#3730a3' },
    { label: '900', hex: '#312e81' }, { label: '950', hex: '#1e1b4b' },
  ]},
  { family: 'Tailwind', name: 'Violet', colors: [
    { label: '50', hex: '#f5f3ff' }, { label: '100', hex: '#ede9fe' }, { label: '200', hex: '#ddd6fe' },
    { label: '300', hex: '#c4b5fd' }, { label: '400', hex: '#a78bfa' }, { label: '500', hex: '#8b5cf6' },
    { label: '600', hex: '#7c3aed' }, { label: '700', hex: '#6d28d9' }, { label: '800', hex: '#5b21b6' },
    { label: '900', hex: '#4c1d95' }, { label: '950', hex: '#2e1065' },
  ]},
  { family: 'Tailwind', name: 'Pink', colors: [
    { label: '50', hex: '#fdf2f8' }, { label: '100', hex: '#fce7f3' }, { label: '200', hex: '#fbcfe8' },
    { label: '300', hex: '#f9a8d4' }, { label: '400', hex: '#f472b6' }, { label: '500', hex: '#ec4899' },
    { label: '600', hex: '#db2777' }, { label: '700', hex: '#be185d' }, { label: '800', hex: '#9d174d' },
    { label: '900', hex: '#831843' }, { label: '950', hex: '#500724' },
  ]},
  { family: 'Tailwind', name: 'Rose', colors: [
    { label: '50', hex: '#fff1f2' }, { label: '100', hex: '#ffe4e6' }, { label: '200', hex: '#fecdd3' },
    { label: '300', hex: '#fda4af' }, { label: '400', hex: '#fb7185' }, { label: '500', hex: '#f43f5e' },
    { label: '600', hex: '#e11d48' }, { label: '700', hex: '#be123c' }, { label: '800', hex: '#9f1239' },
    { label: '900', hex: '#881337' }, { label: '950', hex: '#4c0519' },
  ]},
];

const MATERIAL: Palette[] = [
  { family: 'Material', name: 'Red', colors: [
    { label: '50', hex: '#ffebee' }, { label: '100', hex: '#ffcdd2' }, { label: '200', hex: '#ef9a9a' },
    { label: '300', hex: '#e57373' }, { label: '400', hex: '#ef5350' }, { label: '500', hex: '#f44336' },
    { label: '600', hex: '#e53935' }, { label: '700', hex: '#d32f2f' }, { label: '800', hex: '#c62828' },
    { label: '900', hex: '#b71c1c' }, { label: 'A100', hex: '#ff8a80' }, { label: 'A200', hex: '#ff5252' },
    { label: 'A400', hex: '#ff1744' }, { label: 'A700', hex: '#d50000' },
  ]},
  { family: 'Material', name: 'Purple', colors: [
    { label: '50', hex: '#f3e5f5' }, { label: '100', hex: '#e1bee7' }, { label: '200', hex: '#ce93d8' },
    { label: '300', hex: '#ba68c8' }, { label: '400', hex: '#ab47bc' }, { label: '500', hex: '#9c27b0' },
    { label: '600', hex: '#8e24aa' }, { label: '700', hex: '#7b1fa2' }, { label: '800', hex: '#6a1b9a' },
    { label: '900', hex: '#4a148c' }, { label: 'A100', hex: '#ea80fc' }, { label: 'A200', hex: '#e040fb' },
    { label: 'A400', hex: '#d500f9' }, { label: 'A700', hex: '#aa00ff' },
  ]},
  { family: 'Material', name: 'Indigo', colors: [
    { label: '50', hex: '#e8eaf6' }, { label: '100', hex: '#c5cae9' }, { label: '200', hex: '#9fa8da' },
    { label: '300', hex: '#7986cb' }, { label: '400', hex: '#5c6bc0' }, { label: '500', hex: '#3f51b5' },
    { label: '600', hex: '#3949ab' }, { label: '700', hex: '#303f9f' }, { label: '800', hex: '#283593' },
    { label: '900', hex: '#1a237e' }, { label: 'A100', hex: '#8c9eff' }, { label: 'A200', hex: '#536dfe' },
    { label: 'A400', hex: '#3d5afe' }, { label: 'A700', hex: '#304ffe' },
  ]},
  { family: 'Material', name: 'Blue', colors: [
    { label: '50', hex: '#e3f2fd' }, { label: '100', hex: '#bbdefb' }, { label: '200', hex: '#90caf9' },
    { label: '300', hex: '#64b5f6' }, { label: '400', hex: '#42a5f5' }, { label: '500', hex: '#2196f3' },
    { label: '600', hex: '#1e88e5' }, { label: '700', hex: '#1976d2' }, { label: '800', hex: '#1565c0' },
    { label: '900', hex: '#0d47a1' }, { label: 'A100', hex: '#82b1ff' }, { label: 'A200', hex: '#448aff' },
    { label: 'A400', hex: '#2979ff' }, { label: 'A700', hex: '#2962ff' },
  ]},
  { family: 'Material', name: 'Teal', colors: [
    { label: '50', hex: '#e0f2f1' }, { label: '100', hex: '#b2dfdb' }, { label: '200', hex: '#80cbc4' },
    { label: '300', hex: '#4db6ac' }, { label: '400', hex: '#26a69a' }, { label: '500', hex: '#009688' },
    { label: '600', hex: '#00897b' }, { label: '700', hex: '#00796b' }, { label: '800', hex: '#00695c' },
    { label: '900', hex: '#004d40' }, { label: 'A100', hex: '#a7ffeb' }, { label: 'A200', hex: '#64ffda' },
    { label: 'A400', hex: '#1de9b6' }, { label: 'A700', hex: '#00bfa5' },
  ]},
  { family: 'Material', name: 'Green', colors: [
    { label: '50', hex: '#e8f5e9' }, { label: '100', hex: '#c8e6c9' }, { label: '200', hex: '#a5d6a7' },
    { label: '300', hex: '#81c784' }, { label: '400', hex: '#66bb6a' }, { label: '500', hex: '#4caf50' },
    { label: '600', hex: '#43a047' }, { label: '700', hex: '#388e3c' }, { label: '800', hex: '#2e7d32' },
    { label: '900', hex: '#1b5e20' }, { label: 'A100', hex: '#b9f6ca' }, { label: 'A200', hex: '#69f0ae' },
    { label: 'A400', hex: '#00e676' }, { label: 'A700', hex: '#00c853' },
  ]},
  { family: 'Material', name: 'Orange', colors: [
    { label: '50', hex: '#fff3e0' }, { label: '100', hex: '#ffe0b2' }, { label: '200', hex: '#ffcc80' },
    { label: '300', hex: '#ffb74d' }, { label: '400', hex: '#ffa726' }, { label: '500', hex: '#ff9800' },
    { label: '600', hex: '#fb8c00' }, { label: '700', hex: '#f57c00' }, { label: '800', hex: '#ef6c00' },
    { label: '900', hex: '#e65100' }, { label: 'A100', hex: '#ffd180' }, { label: 'A200', hex: '#ffab40' },
    { label: 'A400', hex: '#ff9100' }, { label: 'A700', hex: '#ff6d00' },
  ]},
  { family: 'Material', name: 'Pink', colors: [
    { label: '50', hex: '#fce4ec' }, { label: '100', hex: '#f8bbd0' }, { label: '200', hex: '#f48fb1' },
    { label: '300', hex: '#f06292' }, { label: '400', hex: '#ec407a' }, { label: '500', hex: '#e91e63' },
    { label: '600', hex: '#d81b60' }, { label: '700', hex: '#c2185b' }, { label: '800', hex: '#ad1457' },
    { label: '900', hex: '#880e4f' }, { label: 'A100', hex: '#ff80ab' }, { label: 'A200', hex: '#ff4081' },
    { label: 'A400', hex: '#f50057' }, { label: 'A700', hex: '#c51162' },
  ]},
];

const RADIX: Palette[] = [
  { family: 'Radix', name: 'Crimson', colors: [
    { label: '1', hex: '#fffcfd' }, { label: '2', hex: '#fff7f9' }, { label: '3', hex: '#feecf0' },
    { label: '4', hex: '#fdd8e0' }, { label: '5', hex: '#fcc1cb' }, { label: '6', hex: '#f9a5b3' },
    { label: '7', hex: '#f382a1' }, { label: '8', hex: '#e54f81' }, { label: '9', hex: '#e93d82' },
    { label: '10', hex: '#de3778' }, { label: '11', hex: '#cb1d63' }, { label: '12', hex: '#621639' },
  ]},
  { family: 'Radix', name: 'Violet', colors: [
    { label: '1', hex: '#fdfcfe' }, { label: '2', hex: '#faf8ff' }, { label: '3', hex: '#f4f0fe' },
    { label: '4', hex: '#ede9fe' }, { label: '5', hex: '#e4deff' }, { label: '6', hex: '#d7cff9' },
    { label: '7', hex: '#c4b8f3' }, { label: '8', hex: '#aa99ec' }, { label: '9', hex: '#6e56cf' },
    { label: '10', hex: '#644fc1' }, { label: '11', hex: '#5746af' }, { label: '12', hex: '#20134b' },
  ]},
  { family: 'Radix', name: 'Blue', colors: [
    { label: '1', hex: '#fbfdff' }, { label: '2', hex: '#f5faff' }, { label: '3', hex: '#eaf4ff' },
    { label: '4', hex: '#daecff' }, { label: '5', hex: '#c8e1ff' }, { label: '6', hex: '#b4d2fb' },
    { label: '7', hex: '#96bef6' }, { label: '8', hex: '#6aa3ee' }, { label: '9', hex: '#0091ff' },
    { label: '10', hex: '#0880e8' }, { label: '11', hex: '#0870d0' }, { label: '12', hex: '#113264' },
  ]},
  { family: 'Radix', name: 'Jade', colors: [
    { label: '1', hex: '#fbfefd' }, { label: '2', hex: '#f4fbf7' }, { label: '3', hex: '#e6f7ed' },
    { label: '4', hex: '#d6f1e3' }, { label: '5', hex: '#c3e9d7' }, { label: '6', hex: '#acdec8' },
    { label: '7', hex: '#8bcebb' }, { label: '8', hex: '#56ba9f' }, { label: '9', hex: '#29a383' },
    { label: '10', hex: '#26997b' }, { label: '11', hex: '#208368' }, { label: '12', hex: '#1d3b31' },
  ]},
  { family: 'Radix', name: 'Amber', colors: [
    { label: '1', hex: '#fefdfb' }, { label: '2', hex: '#fefbe9' }, { label: '3', hex: '#fff7c2' },
    { label: '4', hex: '#ffee9c' }, { label: '5', hex: '#fbe577' }, { label: '6', hex: '#f3d673' },
    { label: '7', hex: '#e9c162' }, { label: '8', hex: '#e2a336' }, { label: '9', hex: '#ffc53d' },
    { label: '10', hex: '#ffba18' }, { label: '11', hex: '#ab6400' }, { label: '12', hex: '#4f3422' },
  ]},
  { family: 'Radix', name: 'Tomato', colors: [
    { label: '1', hex: '#fffcfc' }, { label: '2', hex: '#fff8f7' }, { label: '3', hex: '#feebe7' },
    { label: '4', hex: '#ffddd6' }, { label: '5', hex: '#ffcdc2' }, { label: '6', hex: '#fdb9aa' },
    { label: '7', hex: '#f59e91' }, { label: '8', hex: '#ec7c71' }, { label: '9', hex: '#e54d2e' },
    { label: '10', hex: '#db4324' }, { label: '11', hex: '#ca3214' }, { label: '12', hex: '#341711' },
  ]},
];

const IBM: Palette[] = [
  { family: 'IBM', name: 'Blue', colors: [
    { label: '10', hex: '#edf5ff' }, { label: '20', hex: '#d0e2ff' }, { label: '30', hex: '#a6c8ff' },
    { label: '40', hex: '#78a9ff' }, { label: '50', hex: '#4589ff' }, { label: '60', hex: '#0f62fe' },
    { label: '70', hex: '#0043ce' }, { label: '80', hex: '#002d9c' }, { label: '90', hex: '#001d6c' },
    { label: '100', hex: '#001141' },
  ]},
  { family: 'IBM', name: 'Purple', colors: [
    { label: '10', hex: '#f6f2ff' }, { label: '20', hex: '#e8daff' }, { label: '30', hex: '#d4bbff' },
    { label: '40', hex: '#be95ff' }, { label: '50', hex: '#a56eff' }, { label: '60', hex: '#8a3ffc' },
    { label: '70', hex: '#6929c4' }, { label: '80', hex: '#491d8b' }, { label: '90', hex: '#31135e' },
    { label: '100', hex: '#1c0f30' },
  ]},
  { family: 'IBM', name: 'Cyan', colors: [
    { label: '10', hex: '#e5f6ff' }, { label: '20', hex: '#bae6ff' }, { label: '30', hex: '#82cfff' },
    { label: '40', hex: '#33b1ff' }, { label: '50', hex: '#1192e8' }, { label: '60', hex: '#0072c3' },
    { label: '70', hex: '#00539a' }, { label: '80', hex: '#003a6d' }, { label: '90', hex: '#012749' },
    { label: '100', hex: '#061727' },
  ]},
  { family: 'IBM', name: 'Teal', colors: [
    { label: '10', hex: '#d9fbfb' }, { label: '20', hex: '#9ef0f0' }, { label: '30', hex: '#3ddbd9' },
    { label: '40', hex: '#08bdba' }, { label: '50', hex: '#009d9a' }, { label: '60', hex: '#007d79' },
    { label: '70', hex: '#005d5d' }, { label: '80', hex: '#004144' }, { label: '90', hex: '#022b30' },
    { label: '100', hex: '#081a1c' },
  ]},
  { family: 'IBM', name: 'Green', colors: [
    { label: '10', hex: '#defbe6' }, { label: '20', hex: '#a7f0ba' }, { label: '30', hex: '#6fdc8c' },
    { label: '40', hex: '#42be65' }, { label: '50', hex: '#24a148' }, { label: '60', hex: '#198038' },
    { label: '70', hex: '#0e6027' }, { label: '80', hex: '#044317' }, { label: '90', hex: '#022d0d' },
    { label: '100', hex: '#071908' },
  ]},
  { family: 'IBM', name: 'Red', colors: [
    { label: '10', hex: '#fff1f1' }, { label: '20', hex: '#ffd7d9' }, { label: '30', hex: '#ffb3b8' },
    { label: '40', hex: '#ff8389' }, { label: '50', hex: '#fa4d56' }, { label: '60', hex: '#da1e28' },
    { label: '70', hex: '#a2191f' }, { label: '80', hex: '#750e13' }, { label: '90', hex: '#520408' },
    { label: '100', hex: '#2d0709' },
  ]},
  { family: 'IBM', name: 'Magenta', colors: [
    { label: '10', hex: '#fff0f7' }, { label: '20', hex: '#ffd6e8' }, { label: '30', hex: '#ffafd2' },
    { label: '40', hex: '#ff7eb6' }, { label: '50', hex: '#ee538b' }, { label: '60', hex: '#d12771' },
    { label: '70', hex: '#9f1853' }, { label: '80', hex: '#740937' }, { label: '90', hex: '#510224' },
    { label: '100', hex: '#2a0a18' },
  ]},
  { family: 'IBM', name: 'Orange', colors: [
    { label: '10', hex: '#fff2e8' }, { label: '20', hex: '#ffd9be' }, { label: '30', hex: '#ffb784' },
    { label: '40', hex: '#ff832b' }, { label: '50', hex: '#eb6200' }, { label: '60', hex: '#ba4e00' },
    { label: '70', hex: '#8a3800' }, { label: '80', hex: '#5e2900' }, { label: '90', hex: '#3e1a00' },
    { label: '100', hex: '#231000' },
  ]},
];

const PASTELS: Palette[] = [
  { family: 'Pastel', name: 'Warm', colors: [
    { label: 'Blush', hex: '#ffd6d6' }, { label: 'Peach', hex: '#ffccb6' }, { label: 'Apricot', hex: '#ffdab9' },
    { label: 'Lemon', hex: '#fffacd' }, { label: 'Butter', hex: '#fef3c7' }, { label: 'Sand', hex: '#fde8c8' },
    { label: 'Rose', hex: '#fce4ec' }, { label: 'Flamingo', hex: '#f9d0d0' }, { label: 'Coral', hex: '#f4cfc6' },
    { label: 'Lavender', hex: '#e8d5f5' }, { label: 'Lilac', hex: '#dcd3f5' }, { label: 'Mist', hex: '#f0eafb' },
  ]},
  { family: 'Pastel', name: 'Cool', colors: [
    { label: 'Sky', hex: '#dbeafe' }, { label: 'Powder', hex: '#d1ecff' }, { label: 'Ice', hex: '#e0f2fe' },
    { label: 'Mint', hex: '#d1fae5' }, { label: 'Sage', hex: '#dcf5e7' }, { label: 'Seafoam', hex: '#ccf2f0' },
    { label: 'Periwinkle', hex: '#d4d4f9' }, { label: 'Slate', hex: '#dde6f5' }, { label: 'Steel', hex: '#e2eaf5' },
    { label: 'Teal', hex: '#ccf0ee' }, { label: 'Aqua', hex: '#c4f0f4' }, { label: 'Fog', hex: '#e4e9f7' },
  ]},
  { family: 'Pastel', name: 'Neutral', colors: [
    { label: 'Pearl', hex: '#f5f5f5' }, { label: 'Cream', hex: '#faf7f2' }, { label: 'Ivory', hex: '#fffff0' },
    { label: 'Eggshell', hex: '#f0ebe3' }, { label: 'Linen', hex: '#faf0e6' }, { label: 'Alabaster', hex: '#f2f0eb' },
    { label: 'Mushroom', hex: '#e8e0d5' }, { label: 'Stone', hex: '#d6cfc5' }, { label: 'Warm Gray', hex: '#d4cfc8' },
    { label: 'Cool Gray', hex: '#d0d5dd' }, { label: 'Ash', hex: '#c8cdd5' }, { label: 'Smoke', hex: '#e8e8e8' },
  ]},
];

const ALL_PALETTES = [...TAILWIND, ...MATERIAL, ...IBM, ...RADIX, ...PASTELS];
const FAMILIES = ['All', 'Tailwind', 'Material', 'IBM', 'Radix', 'Pastel'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 0;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onApplyColor?: (hex: string) => void;
}

export function ColorPalettesPanel({ open, onClose, onApplyColor }: Props) {
  const [family, setFamily] = useState('All');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [hoveredColor, setHoveredColor] = useState<{ hex: string; label: string; name: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard handling
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  // Filter palettes
  const q = search.toLowerCase();
  const filtered = ALL_PALETTES.filter(p => {
    if (family !== 'All' && p.family !== family) return false;
    if (!q) return true;
    if (p.name.toLowerCase().includes(q) || p.family.toLowerCase().includes(q)) return true;
    return p.colors.some(c => c.hex.toLowerCase().includes(q) || c.label.toLowerCase().includes(q));
  });

  const copyColor = (hex: string) => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopied(hex);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'auto',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      <div
        style={{
          position: 'relative',
          marginTop: 48, marginRight: 8,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          width: 340,
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 14px 0',
          flexShrink: 0,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#ec4899)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            Color Palettes
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search palettes or hex…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--panel-alt)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '5px 8px 5px 26px',
                fontSize: 11, color: 'var(--text)', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Family filter pills */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 14px',
          overflowX: 'auto', flexShrink: 0,
          scrollbarWidth: 'none',
        }}>
          {FAMILIES.map(f => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              style={{
                background: family === f ? 'var(--accent)' : 'var(--panel-alt)',
                color: family === f ? '#fff' : 'var(--muted)',
                border: '1px solid',
                borderColor: family === f ? 'var(--accent)' : 'var(--border)',
                borderRadius: 20, padding: '3px 9px',
                fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.1s',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Hovered color preview bar */}
        <div style={{
          height: 36, flexShrink: 0,
          background: hoveredColor ? hoveredColor.hex : 'var(--panel-alt)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 14px',
          gap: 8, transition: 'background 0.1s',
        }}>
          {hoveredColor ? (
            <>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: luminance(hoveredColor.hex) > 0.3 ? '#000' : '#fff',
                fontFamily: 'monospace',
              }}>
                {hoveredColor.hex.toUpperCase()}
              </span>
              <span style={{
                fontSize: 10,
                color: luminance(hoveredColor.hex) > 0.3 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
              }}>
                {hoveredColor.name} {hoveredColor.label}
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => copyColor(hoveredColor.hex)}
                style={{
                  background: luminance(hoveredColor.hex) > 0.3 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)',
                  border: 'none', borderRadius: 5, cursor: 'pointer',
                  padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 600,
                  color: luminance(hoveredColor.hex) > 0.3 ? '#000' : '#fff',
                }}
              >
                {copied === hoveredColor.hex ? <Check size={10} /> : <Copy size={10} />}
                {copied === hoveredColor.hex ? 'Copied' : 'Copy'}
              </button>
              {onApplyColor && (
                <button
                  onClick={() => onApplyColor(hoveredColor.hex)}
                  style={{
                    background: luminance(hoveredColor.hex) > 0.3 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)',
                    border: 'none', borderRadius: 5, cursor: 'pointer',
                    padding: '3px 7px',
                    fontSize: 10, fontWeight: 600,
                    color: luminance(hoveredColor.hex) > 0.3 ? '#000' : '#fff',
                  }}
                >
                  Apply
                </button>
              )}
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
              Hover a swatch to preview · Click to apply
            </span>
          )}
        </div>

        {/* Palette list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 14px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>
              No palettes match "{search}"
            </div>
          ) : (
            filtered.map(palette => (
              <PaletteRow
                key={`${palette.family}-${palette.name}`}
                palette={palette}
                onHover={setHoveredColor}
                onLeave={() => setHoveredColor(null)}
                onCopy={copyColor}
                onApply={onApplyColor}
                copiedHex={copied}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--subtle)', display: 'flex',
          justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span>{filtered.reduce((n, p) => n + p.colors.length, 0)} swatches</span>
          <span>Tailwind · Material · IBM · Radix · Pastel</span>
        </div>
      </div>
    </div>
  );
}

// ─── PaletteRow ───────────────────────────────────────────────────────────────

interface PaletteRowProps {
  palette: Palette;
  onHover: (info: { hex: string; label: string; name: string }) => void;
  onLeave: () => void;
  onCopy: (hex: string) => void;
  onApply?: (hex: string) => void;
  copiedHex: string | null;
}

function PaletteRow({ palette, onHover, onLeave, onCopy, onApply, copiedHex }: PaletteRowProps) {
  return (
    <div style={{ marginBottom: 10 }}>
      {/* Row label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em' }}>
          {palette.name}
        </span>
        <span style={{ fontSize: 9, color: 'var(--subtle)', fontWeight: 500 }}>
          {palette.family}
        </span>
      </div>

      {/* Swatches row */}
      <div style={{ display: 'flex', gap: 2 }}>
        {palette.colors.map(c => (
          <SwatchCell
            key={c.hex + c.label}
            hex={c.hex}
            label={c.label}
            paletteName={palette.name}
            onHover={onHover}
            onLeave={onLeave}
            onCopy={onCopy}
            onApply={onApply}
            isCopied={copiedHex === c.hex}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SwatchCell ───────────────────────────────────────────────────────────────

interface SwatchCellProps {
  hex: string;
  label: string;
  paletteName: string;
  onHover: (info: { hex: string; label: string; name: string }) => void;
  onLeave: () => void;
  onCopy: (hex: string) => void;
  onApply?: (hex: string) => void;
  isCopied: boolean;
}

function SwatchCell({ hex, label, paletteName, onHover, onLeave, onCopy, onApply }: SwatchCellProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    if (onApply) {
      onApply(hex);
    } else {
      onCopy(hex);
    }
  };

  return (
    <button
      title={`${paletteName} ${label} — ${hex}`}
      onClick={handleClick}
      onMouseEnter={() => { setHovered(true); onHover({ hex, label, name: paletteName }); }}
      onMouseLeave={() => { setHovered(false); onLeave(); }}
      style={{
        flex: 1,
        minWidth: 0,
        height: 28,
        background: hex,
        border: 'none',
        cursor: 'pointer',
        borderRadius: 3,
        transform: hovered ? 'scaleY(1.15) translateY(-1px)' : 'scaleY(1)',
        transition: 'transform 0.1s',
        outline: hovered ? `2px solid var(--accent)` : 'none',
        outlineOffset: 1,
        position: 'relative',
      }}
    />
  );
}
