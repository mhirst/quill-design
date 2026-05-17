/**
 * TemplateGallery — Browse and insert pre-built design templates.
 *
 * Provides categorized template layouts (UI screens, cards, forms, dashboards,
 * marketing, social) that generate complete shape arrangements on the canvas.
 *
 * Shortcut: ⌘⇧⌥T
 */

import React, { useState, useMemo } from 'react';
import { defaultShape } from '../../lib/shapes';
import type { Shape } from '../../lib/shapes';
import { v4 as uuid } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'ui' | 'cards' | 'forms' | 'data' | 'marketing' | 'social' | 'mobile';

interface Template {
  id: string;
  name: string;
  description: string;
  category: Category;
  tags: string[];
  preview: string; // SVG string for thumbnail
  build: (x: number, y: number) => Partial<Shape>[];
}

// ─── Shape builder helpers ────────────────────────────────────────────────────

function rect(x: number, y: number, w: number, h: number, fill: string, extra?: Partial<Shape>): Partial<Shape> {
  return { x, y, width: w, height: h, fill, fillType: 'solid' as const, type: 'rectangle', borderRadius: 0, ...extra };
}

function text(x: number, y: number, w: number, h: number, content: string, extra?: Partial<Shape>): Partial<Shape> {
  return { x, y, width: w, height: h, type: 'text', text: content, fill: 'transparent', fillType: 'solid' as const, color: '#e2e8f0', fontSize: 14, fontWeight: '400', ...extra };
}

function circle(cx: number, cy: number, r: number, fill: string, extra?: Partial<Shape>): Partial<Shape> {
  return { x: cx - r, y: cy - r, width: r * 2, height: r * 2, fill, fillType: 'solid' as const, type: 'ellipse', ...extra };
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  // ── Hero Section ─────────────────────────────────────────────────────────
  {
    id: 'hero-dark',
    name: 'Hero Section',
    description: 'Full-width dark hero with headline, subtitle, and CTA buttons',
    category: 'marketing',
    tags: ['landing', 'hero', 'dark'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="20" y="28" width="80" height="8" rx="2" fill="#6366f1"/><rect x="20" y="44" width="120" height="5" rx="2" fill="#2d2d4a"/><rect x="20" y="54" width="100" height="5" rx="2" fill="#2d2d4a"/><rect x="20" y="68" width="40" height="12" rx="4" fill="#6366f1"/><rect x="66" y="68" width="36" height="12" rx="4" fill="none" stroke="#6366f1" stroke-width="1"/></svg>`,
    build: (ox, oy) => [
      rect(ox, oy, 800, 480, '#0f0f1a', { name: 'Hero Background', borderRadius: 12 }),
      rect(ox + 60, oy + 80, 400, 6, '#6366f1', { name: 'Eyebrow Tag', borderRadius: 3 }),
      text(ox + 60, oy + 104, 680, 72, 'Build Amazing\nThings Faster', { name: 'Headline', fontSize: 56, fontWeight: '800', color: '#ffffff', lineHeight: 1.15 }),
      text(ox + 60, oy + 196, 480, 60, 'The all-in-one design tool that helps teams collaborate,\ncreate, and ship beautiful products.', { name: 'Subtitle', fontSize: 18, color: '#94a3b8', lineHeight: 1.6 }),
      rect(ox + 60, oy + 280, 160, 52, '#6366f1', { name: 'Primary CTA', borderRadius: 10 }),
      text(ox + 60, oy + 280, 160, 52, 'Get Started Free', { name: 'CTA Label', fontSize: 15, fontWeight: '600', color: '#ffffff' }),
      rect(ox + 232, oy + 280, 148, 52, 'transparent', { name: 'Secondary CTA', borderRadius: 10, stroke: '#6366f1', strokeWidth: 2 }),
      text(ox + 232, oy + 280, 148, 52, 'Watch Demo →', { name: 'Secondary Label', fontSize: 15, fontWeight: '600', color: '#6366f1' }),
      rect(ox + 440, oy + 48, 300, 384, '#1a1a2e', { name: 'App Preview Frame', borderRadius: 16 }),
      rect(ox + 456, oy + 72, 268, 336, '#0d0d1a', { name: 'App Preview Screen', borderRadius: 10 }),
    ],
  },

  // ── Feature Cards Row ─────────────────────────────────────────────────────
  {
    id: 'feature-cards',
    name: 'Feature Cards',
    description: '3-column feature highlights with icons and descriptions',
    category: 'marketing',
    tags: ['features', 'cards', 'grid'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="8" y="20" width="44" height="60" rx="4" fill="#1e1e2e" stroke="#2d2d3d" stroke-width="0.5"/><circle cx="30" cy="38" r="8" fill="#6366f133"/><rect x="15" y="52" width="30" height="4" rx="2" fill="#4a5568"/><rect x="15" y="60" width="24" height="3" rx="1" fill="#2d2d4a"/><rect x="59" y="20" width="44" height="60" rx="4" fill="#1e1e2e" stroke="#2d2d3d" stroke-width="0.5"/><circle cx="81" cy="38" r="8" fill="#10b98133"/><rect x="66" y="52" width="30" height="4" rx="2" fill="#4a5568"/><rect x="66" y="60" width="24" height="3" rx="1" fill="#2d2d4a"/><rect x="110" y="20" width="44" height="60" rx="4" fill="#1e1e2e" stroke="#2d2d3d" stroke-width="0.5"/><circle cx="132" cy="38" r="8" fill="#f59e0b33"/><rect x="117" y="52" width="30" height="4" rx="2" fill="#4a5568"/><rect x="117" y="60" width="24" height="3" rx="1" fill="#2d2d4a"/></svg>`,
    build: (ox, oy) => {
      const cards: Partial<Shape>[] = [];
      const features = [
        { icon: '⚡', title: 'Lightning Fast', desc: 'Optimized for performance with real-time collaboration and instant sync across all devices.', color: '#6366f1' },
        { icon: '🔒', title: 'Secure by Default', desc: 'Enterprise-grade encryption and access controls keep your data safe at every step.', color: '#10b981' },
        { icon: '🎨', title: 'Beautiful Design', desc: 'Crafted with care for every pixel. Smooth animations and thoughtful interactions throughout.', color: '#f59e0b' },
      ];
      features.forEach((f, i) => {
        const cx = ox + i * 280;
        cards.push(rect(cx, oy, 260, 200, '#1e1e2e', { name: `Feature Card ${i+1}`, borderRadius: 12, stroke: '#2d2d3d', strokeWidth: 1 }));
        cards.push(rect(cx + 24, oy + 28, 48, 48, `${f.color}22`, { name: `Icon Bg ${i+1}`, borderRadius: 10 }));
        cards.push(text(cx + 24, oy + 28, 48, 48, f.icon, { name: `Icon ${i+1}`, fontSize: 24, color: f.color }));
        cards.push(text(cx + 24, oy + 94, 212, 24, f.title, { name: `Feature Title ${i+1}`, fontSize: 18, fontWeight: '700', color: '#e2e8f0' }));
        cards.push(text(cx + 24, oy + 124, 212, 60, f.desc, { name: `Feature Desc ${i+1}`, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }));
      });
      return cards;
    },
  },

  // ── Pricing Card ──────────────────────────────────────────────────────────
  {
    id: 'pricing-card',
    name: 'Pricing Cards',
    description: 'Three-tier pricing layout with highlighted popular plan',
    category: 'ui',
    tags: ['pricing', 'saas', 'cards'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="6" y="15" width="44" height="70" rx="4" fill="#1e1e2e" stroke="#2d2d3d" stroke-width="0.5"/><rect x="58" y="10" width="46" height="80" rx="4" fill="#6366f1"/><rect x="110" y="15" width="44" height="70" rx="4" fill="#1e1e2e" stroke="#2d2d3d" stroke-width="0.5"/><rect x="63" y="18" width="36" height="5" rx="2" fill="rgba(255,255,255,0.8)"/><rect x="67" y="32" width="28" height="8" rx="2" fill="rgba(255,255,255,0.9)"/><rect x="63" y="50" width="36" height="4" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="63" y="58" width="36" height="4" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="63" y="72" width="36" height="10" rx="3" fill="white"/></svg>`,
    build: (ox, oy) => {
      const shapes: Partial<Shape>[] = [];
      const plans = [
        { name: 'Starter', price: '$0', period: '/month', features: ['5 projects', '10GB storage', 'Basic analytics', 'Email support'], cta: 'Get Started', accent: '#6b7280', bg: '#1e1e2e', featured: false },
        { name: 'Pro', price: '$49', period: '/month', features: ['Unlimited projects', '100GB storage', 'Advanced analytics', 'Priority support', 'Custom domains'], cta: 'Start Free Trial', accent: '#ffffff', bg: '#6366f1', featured: true },
        { name: 'Enterprise', price: '$199', period: '/month', features: ['Everything in Pro', '1TB storage', 'White-label', 'Dedicated manager', 'SLA guarantee'], cta: 'Contact Sales', accent: '#6b7280', bg: '#1e1e2e', featured: false },
      ];
      plans.forEach((plan, i) => {
        const cx = ox + i * 260;
        const cy = plan.featured ? oy : oy + 24;
        const h = plan.featured ? 480 : 432;
        shapes.push(rect(cx, cy, 240, h, plan.bg, { name: `${plan.name} Card`, borderRadius: 16, stroke: plan.featured ? 'none' : '#2d2d3d', strokeWidth: 1 }));
        if (plan.featured) {
          shapes.push(rect(cx + 60, cy - 14, 120, 28, '#4f46e5', { name: 'Popular Badge', borderRadius: 14 }));
          shapes.push(text(cx + 60, cy - 14, 120, 28, 'Most Popular', { name: 'Badge Text', fontSize: 11, fontWeight: '700', color: '#ffffff' }));
        }
        shapes.push(text(cx + 24, cy + 32, 192, 24, plan.name, { name: `${plan.name} Label`, fontSize: 16, fontWeight: '700', color: plan.featured ? '#ffffff' : '#e2e8f0' }));
        shapes.push(text(cx + 24, cy + 68, 120, 48, plan.price, { name: `${plan.name} Price`, fontSize: 40, fontWeight: '800', color: plan.featured ? '#ffffff' : '#e2e8f0' }));
        shapes.push(text(cx + 24 + (plan.price.length * 22), cy + 90, 80, 24, plan.period, { name: `${plan.name} Period`, fontSize: 14, color: plan.featured ? 'rgba(255,255,255,0.7)' : '#94a3b8' }));
        plan.features.forEach((feat, fi) => {
          shapes.push(text(cx + 24, cy + 140 + fi * 36, 192, 24, `✓  ${feat}`, { name: `Feature ${fi+1}`, fontSize: 13, color: plan.featured ? 'rgba(255,255,255,0.85)' : '#94a3b8' }));
        });
        shapes.push(rect(cx + 24, cy + h - 68, 192, 48, plan.featured ? '#ffffff' : '#6366f1', { name: `${plan.name} CTA`, borderRadius: 10 }));
        shapes.push(text(cx + 24, cy + h - 68, 192, 48, plan.cta, { name: `${plan.name} CTA Label`, fontSize: 14, fontWeight: '700', color: plan.featured ? '#6366f1' : '#ffffff' }));
      });
      return shapes;
    },
  },

  // ── Dashboard Layout ──────────────────────────────────────────────────────
  {
    id: 'dashboard',
    name: 'Dashboard Layout',
    description: 'Full admin dashboard with sidebar, stats, and chart areas',
    category: 'data',
    tags: ['dashboard', 'admin', 'analytics'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect width="32" height="100" fill="#1e1e2e"/><rect x="4" y="8" width="24" height="6" rx="2" fill="#6366f1"/><rect x="4" y="22" width="24" height="4" rx="1" fill="#2d2d4a"/><rect x="4" y="32" width="24" height="4" rx="1" fill="#2d2d4a"/><rect x="4" y="42" width="24" height="4" rx="1" fill="#2d2d4a"/><rect x="36" y="8" width="118" height="14" rx="2" fill="#1e1e2e"/><rect x="36" y="28" width="56" height="28" rx="3" fill="#1e1e2e"/><rect x="98" y="28" width="56" height="28" rx="3" fill="#1e1e2e"/><rect x="36" y="62" width="118" height="30" rx="3" fill="#1e1e2e"/><rect x="42" y="72" width="8" height="14" rx="1" fill="#6366f133"/><rect x="54" y="68" width="8" height="18" rx="1" fill="#6366f155"/><rect x="66" y="65" width="8" height="21" rx="1" fill="#6366f177"/><rect x="78" y="70" width="8" height="16" rx="1" fill="#6366f1aa"/><rect x="90" y="63" width="8" height="23" rx="1" fill="#6366f1"/></svg>`,
    build: (ox, oy) => {
      const shapes: Partial<Shape>[] = [];
      // Outer frame
      shapes.push(rect(ox, oy, 1200, 800, '#0f0f1a', { name: 'Dashboard Frame', borderRadius: 16 }));
      // Sidebar
      shapes.push(rect(ox, oy, 220, 800, '#1a1a2e', { name: 'Sidebar', borderRadius: 0 }));
      shapes.push(rect(ox + 16, oy + 20, 188, 36, '#6366f1', { name: 'Logo Area', borderRadius: 8 }));
      shapes.push(text(ox + 16, oy + 20, 188, 36, '⬟ Quill Design', { name: 'Logo', fontSize: 15, fontWeight: '700', color: '#ffffff' }));
      ['Dashboard', 'Analytics', 'Projects', 'Team', 'Settings'].forEach((item, i) => {
        const active = i === 0;
        shapes.push(rect(ox + 12, oy + 80 + i * 52, 196, 40, active ? 'rgba(99,102,241,0.15)' : 'transparent', { name: `Nav ${item}`, borderRadius: 8 }));
        shapes.push(text(ox + 12, oy + 80 + i * 52, 196, 40, item, { name: `Nav Label ${item}`, fontSize: 13, fontWeight: active ? '600' : '400', color: active ? '#6366f1' : '#64748b' }));
      });
      // Top bar
      shapes.push(rect(ox + 220, oy, 980, 64, '#0f0f1a', { name: 'Top Bar' }));
      shapes.push(text(ox + 244, oy + 16, 300, 32, 'Overview', { name: 'Page Title', fontSize: 22, fontWeight: '700', color: '#e2e8f0' }));
      shapes.push(rect(ox + 1060, oy + 14, 36, 36, '#1e1e2e', { name: 'Avatar', borderRadius: 18 }));
      // Stats row
      const stats = [
        { label: 'Total Revenue', value: '$84,291', change: '+12.5%', color: '#10b981' },
        { label: 'Active Users', value: '24,182', change: '+8.2%', color: '#6366f1' },
        { label: 'Conversion', value: '3.64%', change: '-1.1%', color: '#ef4444' },
        { label: 'Avg. Session', value: '4m 32s', change: '+22s', color: '#f59e0b' },
      ];
      stats.forEach((s, i) => {
        const sx = ox + 244 + i * 236;
        shapes.push(rect(sx, oy + 88, 220, 112, '#1e1e2e', { name: `Stat ${s.label}`, borderRadius: 12 }));
        shapes.push(text(sx + 20, oy + 108, 180, 18, s.label, { name: `Stat Label ${i}`, fontSize: 12, color: '#64748b' }));
        shapes.push(text(sx + 20, oy + 130, 180, 36, s.value, { name: `Stat Value ${i}`, fontSize: 28, fontWeight: '700', color: '#e2e8f0' }));
        shapes.push(text(sx + 20, oy + 168, 180, 20, s.change, { name: `Stat Change ${i}`, fontSize: 12, fontWeight: '600', color: s.color }));
      });
      // Main chart
      shapes.push(rect(ox + 244, oy + 220, 620, 300, '#1e1e2e', { name: 'Revenue Chart', borderRadius: 12 }));
      shapes.push(text(ox + 268, oy + 244, 300, 24, 'Revenue Over Time', { name: 'Chart Title', fontSize: 16, fontWeight: '600', color: '#e2e8f0' }));
      // Bar chart simulation
      [0.4, 0.65, 0.5, 0.8, 0.6, 0.9, 0.75, 0.95, 0.7, 0.85].forEach((h, i) => {
        shapes.push(rect(ox + 278 + i * 56, oy + 470 - Math.round(h * 160), 40, Math.round(h * 160), '#6366f1', {
          name: `Bar ${i}`, borderRadius: 4, fillOpacity: 0.7 + i * 0.03
        }));
      });
      // Side panel
      shapes.push(rect(ox + 884, oy + 220, 316, 300, '#1e1e2e', { name: 'Recent Activity', borderRadius: 12 }));
      shapes.push(text(ox + 908, oy + 244, 268, 24, 'Recent Activity', { name: 'Activity Title', fontSize: 16, fontWeight: '600', color: '#e2e8f0' }));
      ['User signed up', 'Payment received', 'Bug reported', 'Feature shipped', 'Meeting scheduled'].forEach((activity, i) => {
        shapes.push(circle(ox + 928, oy + 290 + i * 44, 10, ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'][i]));
        shapes.push(text(ox + 948, oy + 280 + i * 44, 220, 20, activity, { name: `Activity ${i}`, fontSize: 12, color: '#cbd5e1' }));
        shapes.push(text(ox + 948, oy + 298 + i * 44, 220, 16, `${i + 2} hours ago`, { name: `Activity Time ${i}`, fontSize: 10, color: '#475569' }));
      });
      return shapes;
    },
  },

  // ── Login Form ────────────────────────────────────────────────────────────
  {
    id: 'login-form',
    name: 'Login Form',
    description: 'Clean login card with email/password fields and social login',
    category: 'forms',
    tags: ['auth', 'login', 'form'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="40" y="8" width="80" height="84" rx="6" fill="#1e1e2e"/><rect x="52" y="18" width="56" height="6" rx="2" fill="#4a5568"/><rect x="52" y="34" width="56" height="8" rx="2" fill="#2a2a3a" stroke="#3d3d5a" stroke-width="0.5"/><rect x="52" y="48" width="56" height="8" rx="2" fill="#2a2a3a" stroke="#3d3d5a" stroke-width="0.5"/><rect x="52" y="62" width="56" height="10" rx="3" fill="#6366f1"/><rect x="52" y="78" width="24" height="6" rx="2" fill="#2a2a3a"/><rect x="84" y="78" width="24" height="6" rx="2" fill="#2a2a3a"/></svg>`,
    build: (ox, oy) => [
      rect(ox, oy, 440, 520, '#1e1e2e', { name: 'Login Card', borderRadius: 20, stroke: '#2d2d3d', strokeWidth: 1 }),
      text(ox + 40, oy + 48, 360, 40, 'Welcome back', { name: 'Title', fontSize: 28, fontWeight: '700', color: '#e2e8f0' }),
      text(ox + 40, oy + 92, 360, 24, 'Sign in to your account to continue', { name: 'Subtitle', fontSize: 14, color: '#64748b' }),
      text(ox + 40, oy + 144, 120, 18, 'Email address', { name: 'Email Label', fontSize: 12, fontWeight: '600', color: '#94a3b8' }),
      rect(ox + 40, oy + 168, 360, 48, '#0f0f1a', { name: 'Email Input', borderRadius: 10, stroke: '#374151', strokeWidth: 1 }),
      text(ox + 40, oy + 168, 360, 48, 'you@example.com', { name: 'Email Placeholder', fontSize: 14, color: '#374151' }),
      text(ox + 40, oy + 240, 120, 18, 'Password', { name: 'Password Label', fontSize: 12, fontWeight: '600', color: '#94a3b8' }),
      rect(ox + 40, oy + 264, 360, 48, '#0f0f1a', { name: 'Password Input', borderRadius: 10, stroke: '#374151', strokeWidth: 1 }),
      text(ox + 40, oy + 264, 360, 48, '••••••••', { name: 'Password Placeholder', fontSize: 18, color: '#374151' }),
      text(ox + 40, oy + 328, 180, 18, '□  Remember me', { name: 'Remember Me', fontSize: 12, color: '#94a3b8' }),
      text(ox + 260, oy + 328, 140, 18, 'Forgot password?', { name: 'Forgot Password', fontSize: 12, color: '#6366f1' }),
      rect(ox + 40, oy + 368, 360, 52, '#6366f1', { name: 'Sign In Button', borderRadius: 12 }),
      text(ox + 40, oy + 368, 360, 52, 'Sign in', { name: 'Sign In Label', fontSize: 15, fontWeight: '700', color: '#ffffff' }),
      rect(ox + 40, oy + 436, 360, 1, '#1f2937', { name: 'Divider' }),
      text(ox + 160, oy + 426, 120, 20, 'or continue with', { name: 'Or Label', fontSize: 12, color: '#4b5563' }),
      rect(ox + 40, oy + 456, 172, 44, '#0f0f1a', { name: 'Google Button', borderRadius: 10, stroke: '#374151', strokeWidth: 1 }),
      text(ox + 40, oy + 456, 172, 44, 'G  Google', { name: 'Google Label', fontSize: 13, fontWeight: '600', color: '#e2e8f0' }),
      rect(ox + 228, oy + 456, 172, 44, '#0f0f1a', { name: 'GitHub Button', borderRadius: 10, stroke: '#374151', strokeWidth: 1 }),
      text(ox + 228, oy + 456, 172, 44, '⊙  GitHub', { name: 'GitHub Label', fontSize: 13, fontWeight: '600', color: '#e2e8f0' }),
    ],
  },

  // ── Profile Card ──────────────────────────────────────────────────────────
  {
    id: 'profile-card',
    name: 'Profile Card',
    description: 'User profile card with avatar, bio, and social stats',
    category: 'cards',
    tags: ['profile', 'user', 'social'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="50" y="10" width="60" height="80" rx="6" fill="#1e1e2e"/><circle cx="80" cy="32" r="12" fill="#6366f1"/><rect x="62" y="50" width="36" height="4" rx="2" fill="#4a5568"/><rect x="66" y="58" width="28" height="3" rx="1" fill="#2d2d4a"/><rect x="55" y="68" width="16" height="3" rx="1" fill="#2d2d4a"/><rect x="73" y="68" width="16" height="3" rx="1" fill="#2d2d4a"/><rect x="91" y="68" width="16" height="3" rx="1" fill="#2d2d4a"/><rect x="56" y="76" width="48" height="8" rx="3" fill="#6366f1"/></svg>`,
    build: (ox, oy) => [
      rect(ox, oy, 320, 420, '#1e1e2e', { name: 'Profile Card', borderRadius: 20, stroke: '#2d2d3d', strokeWidth: 1 }),
      rect(ox, oy, 320, 120, '#6366f1', { name: 'Cover Image', borderRadius: 0 }),
      rect(ox, oy + 80, 320, 60, '#6366f1', { name: 'Cover Overlap' }),
      circle(ox + 160, oy + 100, 48, '#4f46e5', { name: 'Avatar', stroke: '#1e1e2e', strokeWidth: 4 }),
      text(ox + 160 - 20, oy + 80, 40, 40, '👤', { name: 'Avatar Icon', fontSize: 32, color: '#ffffff' }),
      text(ox + 40, oy + 170, 240, 32, 'Alex Johnson', { name: 'Name', fontSize: 22, fontWeight: '700', color: '#e2e8f0' }),
      text(ox + 40, oy + 206, 240, 22, '@alexjohnson · Product Designer', { name: 'Handle', fontSize: 13, color: '#6366f1' }),
      text(ox + 40, oy + 238, 240, 44, 'Crafting beautiful experiences at the intersection of design and technology.', { name: 'Bio', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }),
      rect(ox + 24, oy + 300, 272, 1, '#2d2d3d', { name: 'Divider' }),
      ...[['142', 'Posts'], ['12.4K', 'Followers'], ['891', 'Following']].flatMap(([val, label], i) => [
        text(ox + 40 + i * 90, oy + 316, 80, 24, val, { name: `Stat Val ${i}`, fontSize: 18, fontWeight: '700', color: '#e2e8f0' }),
        text(ox + 40 + i * 90, oy + 340, 80, 18, label, { name: `Stat Label ${i}`, fontSize: 11, color: '#64748b' }),
      ]),
      rect(ox + 24, oy + 370, 132, 40, '#6366f1', { name: 'Follow Button', borderRadius: 10 }),
      text(ox + 24, oy + 370, 132, 40, 'Follow', { name: 'Follow Label', fontSize: 14, fontWeight: '700', color: '#ffffff' }),
      rect(ox + 164, oy + 370, 132, 40, '#0f0f1a', { name: 'Message Button', borderRadius: 10, stroke: '#374151', strokeWidth: 1 }),
      text(ox + 164, oy + 370, 132, 40, 'Message', { name: 'Message Label', fontSize: 14, fontWeight: '600', color: '#e2e8f0' }),
    ],
  },

  // ── Notification Toast ────────────────────────────────────────────────────
  {
    id: 'notification-toasts',
    name: 'Notification Toasts',
    description: 'Success, warning, error, and info notification banners',
    category: 'ui',
    tags: ['toast', 'notification', 'alert'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="10" y="8" width="140" height="18" rx="4" fill="#064e3b" stroke="#065f46" stroke-width="0.5"/><rect x="10" y="31" width="140" height="18" rx="4" fill="#78350f" stroke="#92400e" stroke-width="0.5"/><rect x="10" y="54" width="140" height="18" rx="4" fill="#7f1d1d" stroke="#991b1b" stroke-width="0.5"/><rect x="10" y="77" width="140" height="18" rx="4" fill="#1e3a5f" stroke="#1e40af" stroke-width="0.5"/><rect x="16" y="14" width="10" height="10" rx="5" fill="#10b981"/><rect x="16" y="37" width="10" height="10" rx="5" fill="#f59e0b"/><rect x="16" y="60" width="10" height="10" rx="5" fill="#ef4444"/><rect x="16" y="83" width="10" height="10" rx="5" fill="#3b82f6"/></svg>`,
    build: (ox, oy) => {
      const toasts = [
        { type: 'success', icon: '✓', title: 'Changes saved!', desc: 'Your design has been saved successfully.', bg: '#064e3b', border: '#065f46', iconColor: '#10b981' },
        { type: 'warning', icon: '⚠', title: 'Storage almost full', desc: 'You are using 90% of your storage quota.', bg: '#78350f', border: '#92400e', iconColor: '#f59e0b' },
        { type: 'error', icon: '✕', title: 'Upload failed', desc: 'The file exceeds the 25MB limit. Try again.', bg: '#7f1d1d', border: '#991b1b', iconColor: '#ef4444' },
        { type: 'info', icon: 'ℹ', title: 'New update available', desc: 'Version 3.2.0 is ready to install.', bg: '#1e3a5f', border: '#1e40af', iconColor: '#3b82f6' },
      ];
      return toasts.flatMap((t, i) => {
        const ty = oy + i * 88;
        return [
          rect(ox, ty, 480, 72, t.bg, { name: `${t.type} Toast`, borderRadius: 10, stroke: t.border, strokeWidth: 1 }),
          circle(ox + 32, ty + 36, 16, `${t.iconColor}33`, { name: `${t.type} Icon Bg` }),
          text(ox + 32 - 8, ty + 28, 20, 20, t.icon, { name: `${t.type} Icon`, fontSize: 14, fontWeight: '700', color: t.iconColor }),
          text(ox + 72, ty + 16, 360, 22, t.title, { name: `${t.type} Title`, fontSize: 14, fontWeight: '700', color: '#f1f5f9' }),
          text(ox + 72, ty + 38, 360, 20, t.desc, { name: `${t.type} Desc`, fontSize: 12, color: '#94a3b8' }),
          text(ox + 432, ty + 8, 36, 36, '✕', { name: `${t.type} Close`, fontSize: 14, color: '#64748b' }),
        ];
      });
    },
  },

  // ── Mobile App Screen ──────────────────────────────────────────────────────
  {
    id: 'mobile-home',
    name: 'Mobile App Screen',
    description: 'iOS-style home screen with status bar, nav, and content',
    category: 'mobile',
    tags: ['mobile', 'ios', 'app'],
    preview: `<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="160" fill="#0f0f1a"/><rect x="20" y="10" width="60" height="140" rx="8" fill="#1e1e2e" stroke="#2d2d3d" stroke-width="0.5"/><rect x="24" y="14" width="52" height="7" rx="1" fill="#0f0f1a"/><rect x="24" y="25" width="52" height="12" rx="2" fill="#6366f133"/><rect x="24" y="42" width="52" height="28" rx="3" fill="#6366f144"/><rect x="24" y="75" width="24" height="24" rx="3" fill="#10b98122"/><rect x="52" y="75" width="24" height="24" rx="3" fill="#f59e0b22"/><rect x="24" y="103" width="52" height="8" rx="2" fill="#1a1a2e"/><rect x="28" y="119" width="12" height="12" rx="6" fill="#6366f133"/><rect x="44" y="119" width="12" height="12" rx="6" fill="#6366f155"/><rect x="60" y="119" width="12" height="12" rx="6" fill="#6366f133"/><rect x="74" y="119" width="12" height="12" rx="6" fill="#6366f133"/><rect x="24" y="136" width="52" height="10" rx="2" fill="#0f0f1a"/></svg>`,
    build: (ox, oy) => [
      rect(ox, oy, 390, 844, '#1e1e2e', { name: 'Phone Frame', borderRadius: 50 }),
      rect(ox + 8, oy + 8, 374, 828, '#0f0f1a', { name: 'Screen', borderRadius: 44 }),
      rect(ox + 130, oy + 12, 130, 32, '#1e1e2e', { name: 'Dynamic Island', borderRadius: 16 }),
      // Status bar
      text(ox + 24, oy + 60, 150, 24, '9:41', { name: 'Time', fontSize: 17, fontWeight: '700', color: '#e2e8f0' }),
      text(ox + 280, oy + 60, 110, 24, '▲  WiFi  🔋', { name: 'Status Icons', fontSize: 12, color: '#e2e8f0' }),
      // Top section
      text(ox + 24, oy + 100, 342, 32, 'Good morning, Alex 👋', { name: 'Greeting', fontSize: 22, fontWeight: '700', color: '#e2e8f0' }),
      // Hero card
      rect(ox + 24, oy + 144, 342, 160, '#6366f1', { name: 'Hero Card', borderRadius: 20 }),
      text(ox + 48, oy + 168, 200, 24, 'Your Progress', { name: 'Hero Label', fontSize: 14, color: 'rgba(255,255,255,0.8)' }),
      text(ox + 48, oy + 196, 200, 48, '87%', { name: 'Hero Value', fontSize: 40, fontWeight: '800', color: '#ffffff' }),
      rect(ox + 48, oy + 256, 260, 6, 'rgba(255,255,255,0.3)', { name: 'Progress Track', borderRadius: 3 }),
      rect(ox + 48, oy + 256, 226, 6, '#ffffff', { name: 'Progress Fill', borderRadius: 3 }),
      // Quick actions
      text(ox + 24, oy + 328, 200, 24, 'Quick Actions', { name: 'Section Title', fontSize: 16, fontWeight: '700', color: '#e2e8f0' }),
      ...[['📊', 'Stats', '#6366f1'], ['📁', 'Files', '#10b981'], ['💬', 'Chat', '#f59e0b'], ['⚙', 'Settings', '#8b5cf6']].flatMap(([icon, label, color], i) => [
        rect(ox + 24 + i * 84, oy + 360, 76, 76, `${color}22`, { name: `Action Bg ${i}`, borderRadius: 16 }),
        text(ox + 24 + i * 84, oy + 370, 76, 36, icon as string, { name: `Action Icon ${i}`, fontSize: 28, color: color as string }),
        text(ox + 24 + i * 84, oy + 408, 76, 20, label as string, { name: `Action Label ${i}`, fontSize: 11, color: '#94a3b8' }),
      ]),
      // List items
      text(ox + 24, oy + 456, 200, 24, 'Recent', { name: 'Recent Title', fontSize: 16, fontWeight: '700', color: '#e2e8f0' }),
      ...[0, 1, 2].flatMap(i => [
        rect(ox + 24, oy + 488 + i * 72, 342, 60, '#1a1a2e', { name: `List Item ${i}`, borderRadius: 12 }),
        circle(ox + 56, oy + 518 + i * 72, 20, ['#6366f1', '#10b981', '#f59e0b'][i]),
        text(ox + 88, oy + 504 + i * 72, 220, 20, ['Project Alpha', 'Design System', 'UI Components'][i], { name: `List Title ${i}`, fontSize: 14, fontWeight: '600', color: '#e2e8f0' }),
        text(ox + 88, oy + 524 + i * 72, 220, 16, ['Updated 2h ago', 'Updated yesterday', '3 days ago'][i], { name: `List Sub ${i}`, fontSize: 11, color: '#64748b' }),
      ]),
      // Tab bar
      rect(ox + 8, oy + 752, 374, 72, '#1a1a2e', { name: 'Tab Bar', borderRadius: 0 }),
      ...['⊞ Home', '◎ Search', '⊕ Create', '♡ Saved', '👤 Profile'].map((tab, i) => (
        text(ox + 24 + i * 72, oy + 760, 60, 56, tab.split(' ')[0], { name: `Tab ${i}`, fontSize: 22, color: i === 0 ? '#6366f1' : '#475569' })
      )),
    ],
  },

  // ── Data Table ────────────────────────────────────────────────────────────
  {
    id: 'data-table',
    name: 'Data Table',
    description: 'Sortable data table with header, rows, and pagination',
    category: 'data',
    tags: ['table', 'data', 'list'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="8" y="8" width="144" height="84" rx="4" fill="#1e1e2e"/><rect x="8" y="8" width="144" height="18" rx="4" fill="#2a2a3a"/><rect x="16" y="13" width="20" height="8" rx="1" fill="#4a5568"/><rect x="44" y="13" width="30" height="8" rx="1" fill="#4a5568"/><rect x="82" y="13" width="24" height="8" rx="1" fill="#4a5568"/><rect x="114" y="13" width="20" height="8" rx="1" fill="#4a5568"/><rect x="8" y="28" width="144" height="1" fill="#2d2d3d"/><rect x="16" y="34" width="20" height="5" rx="1" fill="#2d2d4a"/><rect x="44" y="34" width="30" height="5" rx="1" fill="#2d2d4a"/><rect x="16" y="46" width="20" height="5" rx="1" fill="#2d2d4a"/><rect x="44" y="46" width="24" height="5" rx="1" fill="#2d2d4a"/><rect x="16" y="58" width="20" height="5" rx="1" fill="#2d2d4a"/><rect x="44" y="58" width="28" height="5" rx="1" fill="#2d2d4a"/><rect x="16" y="70" width="20" height="5" rx="1" fill="#2d2d4a"/><rect x="44" y="70" width="22" height="5" rx="1" fill="#2d2d4a"/><rect x="60" y="83" width="8" height="5" rx="1" fill="#4a5568"/><rect x="72" y="83" width="8" height="5" rx="1" fill="#6366f1"/><rect x="84" y="83" width="8" height="5" rx="1" fill="#4a5568"/></svg>`,
    build: (ox, oy) => {
      const shapes: Partial<Shape>[] = [];
      const cols = ['Name', 'Email', 'Role', 'Status', 'Joined'];
      const rows = [
        ['Alice Martin', 'alice@co.com', 'Admin', 'Active', 'Jan 2024'],
        ['Bob Chen', 'bob@co.com', 'Editor', 'Active', 'Feb 2024'],
        ['Carol Lee', 'carol@co.com', 'Viewer', 'Inactive', 'Mar 2024'],
        ['David Kim', 'david@co.com', 'Editor', 'Active', 'Apr 2024'],
        ['Emma Wilson', 'emma@co.com', 'Admin', 'Active', 'May 2024'],
      ];
      shapes.push(rect(ox, oy, 900, 400, '#1e1e2e', { name: 'Table Container', borderRadius: 12, stroke: '#2d2d3d', strokeWidth: 1 }));
      // Header
      shapes.push(rect(ox, oy, 900, 52, '#161622', { name: 'Table Header', borderRadius: 0 }));
      const colWidths = [200, 220, 120, 120, 120];
      let cx = ox + 24;
      cols.forEach((col, i) => {
        shapes.push(text(cx, oy + 14, colWidths[i] - 16, 24, col + ' ↕', { name: `Col ${col}`, fontSize: 12, fontWeight: '600', color: '#64748b' }));
        cx += colWidths[i];
      });
      // Rows
      rows.forEach((row, ri) => {
        shapes.push(rect(ox, oy + 52 + ri * 56, 900, 56, ri % 2 === 0 ? 'transparent' : '#161622', { name: `Row ${ri}` }));
        shapes.push(rect(ox, oy + 52 + ri * 56, 900, 1, '#1f2937', { name: `Row Divider ${ri}` }));
        let rx2 = ox + 24;
        row.forEach((cell, ci) => {
          if (ci === 3) { // Status badge
            const isActive = cell === 'Active';
            shapes.push(rect(rx2, oy + 68 + ri * 56, 72, 24, isActive ? '#064e3b' : '#292524', { name: `Status Bg ${ri}`, borderRadius: 12 }));
            shapes.push(text(rx2, oy + 68 + ri * 56, 72, 24, cell, { name: `Status ${ri}`, fontSize: 11, fontWeight: '600', color: isActive ? '#10b981' : '#78716c' }));
          } else {
            shapes.push(text(rx2, oy + 68 + ri * 56, colWidths[ci] - 16, 20, cell, { name: `Cell ${ri}-${ci}`, fontSize: 13, color: ci === 0 ? '#e2e8f0' : '#94a3b8', fontWeight: ci === 0 ? '600' : '400' }));
          }
          rx2 += colWidths[ci];
        });
      });
      // Pagination
      shapes.push(text(ox + 24, oy + 356, 300, 24, 'Showing 1-5 of 48 results', { name: 'Pagination Info', fontSize: 12, color: '#64748b' }));
      ['←', '1', '2', '3', '...', '10', '→'].forEach((p, i) => {
        const isActive = p === '1';
        shapes.push(rect(ox + 620 + i * 36, oy + 352, 32, 32, isActive ? '#6366f1' : '#1f2937', { name: `Page ${p}`, borderRadius: 6 }));
        shapes.push(text(ox + 620 + i * 36, oy + 352, 32, 32, p, { name: `Page Label ${p}`, fontSize: 12, color: isActive ? '#ffffff' : '#64748b' }));
      });
      return shapes;
    },
  },

  // ── Social Post Card ──────────────────────────────────────────────────────
  {
    id: 'social-post',
    name: 'Social Post',
    description: 'Twitter/X-style post with media, reactions, and metadata',
    category: 'social',
    tags: ['twitter', 'post', 'social'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="10" y="10" width="140" height="80" rx="5" fill="#1e1e2e"/><circle cx="26" cy="24" r="8" fill="#6366f1"/><rect x="38" y="18" width="50" height="4" rx="2" fill="#4a5568"/><rect x="38" y="26" width="35" height="3" rx="1" fill="#2d2d4a"/><rect x="16" y="38" width="128" height="3" rx="1" fill="#2d2d4a"/><rect x="16" y="45" width="100" height="3" rx="1" fill="#2d2d4a"/><rect x="16" y="55" width="128" height="22" rx="3" fill="#2a2a3a" stroke="#3d3d5a" stroke-width="0.5"/><rect x="16" y="83" width="20" height="4" rx="2" fill="#2d2d4a"/><rect x="48" y="83" width="20" height="4" rx="2" fill="#2d2d4a"/><rect x="80" y="83" width="20" height="4" rx="2" fill="#2d2d4a"/><rect x="120" y="83" width="18" height="4" rx="2" fill="#2d2d4a"/></svg>`,
    build: (ox, oy) => [
      rect(ox, oy, 560, 320, '#1e1e2e', { name: 'Post Card', borderRadius: 16, stroke: '#2d2d3d', strokeWidth: 1 }),
      circle(ox + 32, oy + 32, 24, '#6366f1', { name: 'Avatar' }),
      text(ox + 32 - 12, oy + 20, 24, 24, '👤', { name: 'Avatar Icon', fontSize: 18, color: '#ffffff' }),
      text(ox + 72, oy + 20, 280, 22, 'Alex Johnson', { name: 'Author Name', fontSize: 15, fontWeight: '700', color: '#e2e8f0' }),
      text(ox + 72, oy + 42, 280, 18, '@alexjohnson · 2h', { name: 'Handle', fontSize: 12, color: '#64748b' }),
      text(ox + 520, oy + 16, 28, 28, '···', { name: 'More', fontSize: 18, color: '#64748b' }),
      text(ox + 24, oy + 76, 512, 60, 'Just shipped the new design system 🎨 Super excited about where this is going. The component library is finally looking cohesive!', { name: 'Post Content', fontSize: 15, color: '#e2e8f0', lineHeight: 1.5 }),
      rect(ox + 24, oy + 152, 512, 100, '#0f0f1a', { name: 'Media Embed', borderRadius: 12, stroke: '#2d2d3d', strokeWidth: 1 }),
      text(ox + 24, oy + 152, 512, 100, '🖼 design-preview.png', { name: 'Media Label', fontSize: 13, color: '#475569' }),
      rect(ox + 24, oy + 268, 512, 1, '#1f2937', { name: 'Reaction Divider' }),
      ...['♡  284', '💬  42', '↗  18', '🔖'].map((action, i) => (
        text(ox + 24 + i * 128, oy + 280, 116, 28, action, { name: `Action ${i}`, fontSize: 13, color: '#64748b' })
      )),
    ],
  },

  // ── Empty State ───────────────────────────────────────────────────────────
  {
    id: 'empty-state',
    name: 'Empty States',
    description: '3 variations of empty state screens',
    category: 'ui',
    tags: ['empty', 'onboarding', 'illustration'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="50" y="18" width="60" height="64" rx="5" fill="#1e1e2e"/><circle cx="80" cy="45" r="14" fill="#6366f122"/><rect x="62" y="66" width="36" height="4" rx="2" fill="#2d2d4a"/><rect x="66" y="74" width="28" height="3" rx="1" fill="#1e1e3a"/></svg>`,
    build: (ox, oy) => {
      const states = [
        { icon: '📭', title: 'No messages yet', desc: 'Start a conversation to see your messages here.', cta: 'New Message', color: '#6366f1' },
        { icon: '🔍', title: 'No results found', desc: 'Try adjusting your search or filter to find what you\'re looking for.', cta: 'Clear Filters', color: '#10b981' },
        { icon: '📂', title: 'Empty folder', desc: 'This folder is empty. Upload files or create a new document.', cta: 'Upload Files', color: '#f59e0b' },
      ];
      return states.flatMap((state, i) => {
        const sx = ox + i * 380;
        return [
          rect(sx, oy, 360, 360, '#1e1e2e', { name: `Empty ${i+1}`, borderRadius: 20, stroke: '#2d2d3d', strokeWidth: 1 }),
          circle(sx + 180, oy + 100, 60, `${state.color}15`, { name: `Empty Icon Bg ${i}` }),
          text(sx + 180 - 28, oy + 76, 56, 56, state.icon, { name: `Empty Icon ${i}`, fontSize: 44, color: state.color }),
          text(sx + 40, oy + 180, 280, 32, state.title, { name: `Empty Title ${i}`, fontSize: 22, fontWeight: '700', color: '#e2e8f0' }),
          text(sx + 40, oy + 220, 280, 52, state.desc, { name: `Empty Desc ${i}`, fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }),
          rect(sx + 80, oy + 290, 200, 48, state.color, { name: `Empty CTA ${i}`, borderRadius: 12 }),
          text(sx + 80, oy + 290, 200, 48, state.cta, { name: `Empty CTA Label ${i}`, fontSize: 14, fontWeight: '700', color: '#ffffff' }),
        ];
      });
    },
  },

  // ── Breadcrumb + Nav ──────────────────────────────────────────────────────
  {
    id: 'nav-components',
    name: 'Navigation Components',
    description: 'Breadcrumbs, tabs, sidebar nav, and top nav variations',
    category: 'ui',
    tags: ['navigation', 'tabs', 'breadcrumb'],
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0f0f1a"/><rect x="8" y="8" width="144" height="12" rx="3" fill="#1e1e2e"/><rect x="14" y="12" width="18" height="4" rx="1" fill="#6366f1"/><rect x="36" y="12" width="4" height="4" rx="1" fill="#3d3d5a"/><rect x="44" y="12" width="20" height="4" rx="1" fill="#4a5568"/><rect x="8" y="26" width="144" height="14" rx="3" fill="#1e1e2e"/><rect x="14" y="29" width="18" height="8" rx="2" fill="#6366f133" stroke="#6366f1" stroke-width="0.5"/><rect x="38" y="29" width="18" height="8" rx="2" fill="none"/><rect x="62" y="29" width="20" height="8" rx="2" fill="none"/><rect x="88" y="29" width="16" height="8" rx="2" fill="none"/><rect x="8" y="48" width="144" height="44" rx="3" fill="#1e1e2e"/><rect x="8" y="48" width="40" height="44" rx="3" fill="#1a1a2e"/><rect x="14" y="56" width="24" height="4" rx="2" fill="#6366f1"/><rect x="14" y="66" width="24" height="4" rx="2" fill="#2d2d4a"/><rect x="14" y="76" width="24" height="4" rx="2" fill="#2d2d4a"/></svg>`,
    build: (ox, oy) => [
      // Breadcrumbs
      rect(ox, oy, 600, 48, '#1e1e2e', { name: 'Breadcrumb Bar', borderRadius: 8, stroke: '#2d2d3d', strokeWidth: 1 }),
      ...['Home', '/', 'Projects', '/', 'Design System', '/', 'Components'].map((crumb, i) => (
        text(ox + 16 + i * 80, oy + 12, 76, 24, crumb, { name: `Crumb ${i}`, fontSize: 13, color: crumb === '/' ? '#374151' : i < 5 ? '#6366f1' : '#e2e8f0', fontWeight: i === 6 ? '600' : '400' })
      )),
      // Tabs
      rect(ox, oy + 64, 600, 52, '#1e1e2e', { name: 'Tab Bar', borderRadius: 8, stroke: '#2d2d3d', strokeWidth: 1 }),
      ...['Overview', 'Components', 'Typography', 'Colors', 'Icons'].map((tab, i) => {
        const isActive = i === 0;
        return [
          rect(ox + 12 + i * 120, oy + 68, 108, 36, isActive ? 'rgba(99,102,241,0.12)' : 'transparent', { name: `Tab Bg ${tab}`, borderRadius: 6 }),
          text(ox + 12 + i * 120, oy + 68, 108, 36, tab, { name: `Tab ${tab}`, fontSize: 13, fontWeight: isActive ? '600' : '400', color: isActive ? '#6366f1' : '#64748b' }),
          ...(isActive ? [rect(ox + 12 + i * 120, oy + 100, 108, 2, '#6366f1', { name: `Tab Indicator`, borderRadius: 1 })] : []),
        ];
      }).flat(),
    ],
  },
];

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  ui: { label: 'UI Elements', icon: '⬡', color: '#6366f1' },
  cards: { label: 'Cards', icon: '⬜', color: '#10b981' },
  forms: { label: 'Forms', icon: '⊟', color: '#f59e0b' },
  data: { label: 'Data & Charts', icon: '📊', color: '#8b5cf6' },
  marketing: { label: 'Marketing', icon: '✦', color: '#ec4899' },
  social: { label: 'Social', icon: '◎', color: '#3b82f6' },
  mobile: { label: 'Mobile', icon: '⬟', color: '#14b8a6' },
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (shapes: Partial<Shape>[]) => void;
  insertX: number;
  insertY: number;
}

export function TemplateGallery({ open, onClose, onInsert, insertX, insertY }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [hoverId, setHoverId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return TEMPLATES.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q));
      }
      return true;
    });
  }, [search, activeCategory]);

  const handleInsert = (template: Template) => {
    const shapes = template.build(insertX, insertY);
    onInsert(shapes);
    onClose();
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
      width: 680, maxHeight: 'calc(100vh - 80px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border, #2d2d3d)', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 16 }}>⬡</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Template Gallery</span>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>{filtered.length} templates</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates… (hero, dashboard, form, mobile…)"
          style={{
            width: '100%', background: 'var(--surface2, #2a2a3a)',
            border: '1px solid var(--border, #2d2d3d)', borderRadius: 8,
            color: 'var(--text)', fontSize: 13, padding: '8px 12px', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', flexWrap: 'wrap', flexShrink: 0 }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', border: `1px solid ${activeCategory === 'all' ? 'var(--accent, #6366f1)' : 'transparent'}`, background: activeCategory === 'all' ? 'rgba(99,102,241,0.15)' : 'transparent', color: activeCategory === 'all' ? 'var(--accent, #6366f1)' : 'var(--muted, #888)', fontWeight: activeCategory === 'all' ? 700 : 400 }}
        >All</button>
        {(Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]).map(([cat, meta]) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${activeCategory === cat ? meta.color : 'transparent'}`,
              background: activeCategory === cat ? `${meta.color}22` : 'transparent',
              color: activeCategory === cat ? meta.color : 'var(--muted, #888)',
              fontWeight: activeCategory === cat ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span>{meta.icon}</span> {meta.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div style={{ overflowY: 'auto', flex: 1, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {filtered.map(template => {
            const meta = CATEGORY_META[template.category];
            const isHovered = hoverId === template.id;
            return (
              <div
                key={template.id}
                onMouseEnter={() => setHoverId(template.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{
                  borderRadius: 10, overflow: 'hidden',
                  border: `1px solid ${isHovered ? meta.color : 'var(--border, #2d2d3d)'}`,
                  background: 'var(--surface2, #2a2a3a)',
                  cursor: 'pointer', transition: 'border-color 0.15s, transform 0.1s',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                }}
                onClick={() => handleInsert(template)}
              >
                {/* Preview */}
                <div style={{ height: 120, background: '#0f0f1a', overflow: 'hidden', position: 'relative' }}>
                  <div dangerouslySetInnerHTML={{ __html: template.preview }} style={{ width: '100%', height: '100%' }} />
                  {isHovered && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `${meta.color}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        background: meta.color, color: '#fff', padding: '8px 16px',
                        borderRadius: 8, fontSize: 13, fontWeight: 700,
                      }}>
                        Insert Template
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, background: `${meta.color}22`, padding: '1px 6px', borderRadius: 8 }}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #e2e8f0)', marginBottom: 3 }}>{template.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #888)', lineHeight: 1.4 }}>{template.description}</div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
                    {template.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 9, color: 'var(--subtle, #444)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 4 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
            <div style={{ fontSize: 14, color: 'var(--muted, #888)' }}>No templates match "{search}"</div>
            <div style={{ fontSize: 12, color: 'var(--subtle, #444)', marginTop: 6 }}>Try a different search term</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border, #2d2d3d)', fontSize: 11, color: 'var(--subtle, #444)', flexShrink: 0 }}>
        Click any template to insert it at the current canvas position · {TEMPLATES.length} templates available
      </div>
    </div>
  );
}
