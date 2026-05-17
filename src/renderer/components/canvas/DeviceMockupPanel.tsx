/**
 * DeviceMockupPanel
 * Insert device mockup frames (iPhone, iPad, MacBook, Browser) around the canvas.
 * Each mockup is a group of styled shape objects that can be scaled and positioned.
 *
 * The "screen area" inside each mockup is where you position your design.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

// ─── Mockup catalog ─────────────────────────────────────────────────────────

export interface MockupDevice {
  id: string;
  name: string;
  category: string;
  icon: string;
  /** Overall frame dimensions */
  width: number;
  height: number;
  /** Screen inset from frame edges */
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  /** Aspect ratio label */
  aspectLabel: string;
}

export const MOCKUP_DEVICES: MockupDevice[] = [
  // ── Mobile ──────────────────────────────────────────────────────────────────
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    category: 'Mobile',
    icon: '📱',
    width: 393,
    height: 852,
    screenX: 0,
    screenY: 0,
    screenWidth: 393,
    screenHeight: 852,
    aspectLabel: '393×852',
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    category: 'Mobile',
    icon: '📱',
    width: 375,
    height: 667,
    screenX: 0,
    screenY: 0,
    screenWidth: 375,
    screenHeight: 667,
    aspectLabel: '375×667',
  },
  {
    id: 'android-large',
    name: 'Android (Large)',
    category: 'Mobile',
    icon: '📱',
    width: 412,
    height: 915,
    screenX: 0,
    screenY: 0,
    screenWidth: 412,
    screenHeight: 915,
    aspectLabel: '412×915',
  },
  // ── Tablet ───────────────────────────────────────────────────────────────────
  {
    id: 'ipad-pro-12',
    name: 'iPad Pro 12.9"',
    category: 'Tablet',
    icon: '⬛',
    width: 1024,
    height: 1366,
    screenX: 0,
    screenY: 0,
    screenWidth: 1024,
    screenHeight: 1366,
    aspectLabel: '1024×1366',
  },
  {
    id: 'ipad-mini',
    name: 'iPad Mini',
    category: 'Tablet',
    icon: '⬛',
    width: 744,
    height: 1133,
    screenX: 0,
    screenY: 0,
    screenWidth: 744,
    screenHeight: 1133,
    aspectLabel: '744×1133',
  },
  // ── Desktop ───────────────────────────────────────────────────────────────────
  {
    id: 'macbook-pro-14',
    name: 'MacBook Pro 14"',
    category: 'Desktop',
    icon: '💻',
    width: 1512,
    height: 982,
    screenX: 0,
    screenY: 0,
    screenWidth: 1512,
    screenHeight: 982,
    aspectLabel: '1512×982',
  },
  {
    id: 'desktop-1920',
    name: 'Desktop 1920×1080',
    category: 'Desktop',
    icon: '🖥️',
    width: 1920,
    height: 1080,
    screenX: 0,
    screenY: 0,
    screenWidth: 1920,
    screenHeight: 1080,
    aspectLabel: '1920×1080',
  },
  {
    id: 'desktop-2560',
    name: 'Desktop 2560×1440',
    category: 'Desktop',
    icon: '🖥️',
    width: 2560,
    height: 1440,
    screenX: 0,
    screenY: 0,
    screenWidth: 2560,
    screenHeight: 1440,
    aspectLabel: '2560×1440',
  },
  // ── Web / Browser ─────────────────────────────────────────────────────────────
  {
    id: 'browser-1440',
    name: 'Browser 1440×900',
    category: 'Web',
    icon: '🌐',
    width: 1440,
    height: 900,
    screenX: 0,
    screenY: 0,
    screenWidth: 1440,
    screenHeight: 900,
    aspectLabel: '1440×900',
  },
  {
    id: 'browser-mobile',
    name: 'Browser Mobile',
    category: 'Web',
    icon: '🌐',
    width: 390,
    height: 844,
    screenX: 0,
    screenY: 0,
    screenWidth: 390,
    screenHeight: 844,
    aspectLabel: '390×844',
  },
  // ── Watch ─────────────────────────────────────────────────────────────────────
  {
    id: 'apple-watch-45',
    name: 'Apple Watch 45mm',
    category: 'Watch',
    icon: '⌚',
    width: 198,
    height: 242,
    screenX: 0,
    screenY: 0,
    screenWidth: 198,
    screenHeight: 242,
    aspectLabel: '198×242',
  },
  // ── TV ────────────────────────────────────────────────────────────────────────
  {
    id: 'apple-tv',
    name: 'Apple TV',
    category: 'TV',
    icon: '📺',
    width: 1920,
    height: 1080,
    screenX: 0,
    screenY: 0,
    screenWidth: 1920,
    screenHeight: 1080,
    aspectLabel: '1920×1080',
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(MOCKUP_DEVICES.map(d => d.category)))];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (device: MockupDevice) => void;
}

export function DeviceMockupPanel({ open, onClose, onInsert }: Props) {
  const [category, setCategory] = useState('All');

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  const visible = MOCKUP_DEVICES.filter(d => category === 'All' || d.category === category);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 430,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      <div style={{
        position: 'relative',
        marginTop: 48, marginRight: 8,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        width: 280,
        maxHeight: 'calc(100vh - 64px)',
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', flexShrink: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'linear-gradient(135deg,#22d3ee,#3b82f6)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            Device Frames
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Category filter */}
        <div style={{
          display: 'flex', gap: 4, padding: '0 14px 10px',
          overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                background: category === c ? 'var(--accent)' : 'var(--panel-alt)',
                color: category === c ? '#fff' : 'var(--muted)',
                border: '1px solid',
                borderColor: category === c ? 'var(--accent)' : 'var(--border)',
                borderRadius: 20, padding: '3px 9px',
                fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.1s',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Device list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 12px' }}>
          {visible.map(device => (
            <DeviceCard key={device.id} device={device} onInsert={() => { onInsert(device); onClose(); }} />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--subtle)', flexShrink: 0,
        }}>
          Inserts as a frame at screen resolution
        </div>
      </div>
    </div>
  );
}

function DeviceCard({ device, onInsert }: { device: MockupDevice; onInsert: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onInsert}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 10px', marginBottom: 3,
        borderRadius: 8, border: '1px solid',
        borderColor: hovered ? 'var(--accent)' : 'var(--border)',
        background: hovered ? 'var(--accent-dim)' : 'var(--panel-alt)',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
      }}
    >
      {/* Icon / preview */}
      <div style={{
        width: 40, height: 40, borderRadius: 6, flexShrink: 0,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>
        {device.icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
          {device.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          {device.aspectLabel}
          {' · '}
          <span style={{ color: 'var(--subtle)' }}>{device.category}</span>
        </div>
      </div>

      {/* Insert arrow */}
      <svg
        width="12" height="12" viewBox="0 0 12 12" fill="none"
        style={{ flexShrink: 0, opacity: hovered ? 1 : 0.4, transition: 'opacity 0.1s' }}
      >
        <path d="M2 6h8M7 3l3 3-3 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
