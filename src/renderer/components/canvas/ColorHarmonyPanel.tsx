/**
 * ColorHarmonyPanel
 * Generate color harmonies (complementary, analogous, triadic, etc.)
 * from a seed color. Click any swatch to copy or apply to the selected shape.
 *
 * Shortcut: ⇧C (when not in toolbar context — note: ⇧C is column grid, so use ⌘⇧K instead)
 * Actually wired to ⌘⇧K
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

// ── Color math ────────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; }
  else if (h < 120){ r = x; g = c; }
  else if (h < 180){ g = c; b = x; }
  else if (h < 240){ g = x; b = c; }
  else if (h < 300){ r = x; b = c; }
  else             { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function textColorFor(bg: string): string {
  return luminance(bg) > 0.35 ? '#111' : '#fff';
}

// ── Harmony generators ────────────────────────────────────────────────────────

interface HarmonyGroup {
  name: string;
  description: string;
  colors: string[];
}

function generateHarmonies(hex: string): HarmonyGroup[] {
  const [h, s, l] = hexToHsl(hex);
  return [
    {
      name: 'Monochromatic',
      description: 'Tints and shades of your color',
      colors: [
        hslToHex(h, s, Math.max(10, l - 30)),
        hslToHex(h, s, Math.max(15, l - 15)),
        hex,
        hslToHex(h, s, Math.min(90, l + 15)),
        hslToHex(h, s, Math.min(95, l + 30)),
      ],
    },
    {
      name: 'Complementary',
      description: 'Opposite on the color wheel',
      colors: [
        hslToHex(h, s, Math.max(20, l - 10)),
        hex,
        hslToHex(h + 180, s, l),
        hslToHex(h + 180, s, Math.min(90, l + 15)),
      ],
    },
    {
      name: 'Analogous',
      description: 'Neighbors on the color wheel',
      colors: [
        hslToHex(h - 30, s, l),
        hslToHex(h - 15, s, l),
        hex,
        hslToHex(h + 15, s, l),
        hslToHex(h + 30, s, l),
      ],
    },
    {
      name: 'Triadic',
      description: 'Three evenly spaced hues',
      colors: [
        hex,
        hslToHex(h + 120, s, l),
        hslToHex(h + 240, s, l),
      ],
    },
    {
      name: 'Split-Complementary',
      description: 'Complement + two neighbors',
      colors: [
        hex,
        hslToHex(h + 150, s, l),
        hslToHex(h + 210, s, l),
      ],
    },
    {
      name: 'Tetradic',
      description: 'Four colors at 90° intervals',
      colors: [
        hex,
        hslToHex(h + 90, s, l),
        hslToHex(h + 180, s, l),
        hslToHex(h + 270, s, l),
      ],
    },
    {
      name: 'Shades',
      description: 'Darkening the base color',
      colors: [
        hslToHex(h, Math.min(s + 10, 100), 85),
        hslToHex(h, Math.min(s + 5, 100), 70),
        hslToHex(h, s, 55),
        hex,
        hslToHex(h, s, Math.max(l - 20, 10)),
        hslToHex(h, s, Math.max(l - 35, 5)),
      ],
    },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onApplyColor: (color: string) => void;
  /** Seed color — defaults to current selection fill or indigo */
  seedColor?: string;
}

export function ColorHarmonyPanel({ open, onClose, onApplyColor, seedColor }: Props) {
  const [color, setColor] = useState(seedColor ?? '#6366f1');
  const [colorInput, setColorInput] = useState(seedColor ?? '#6366f1');
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Sync if seedColor changes while open
  useEffect(() => {
    if (seedColor && open) {
      setColor(seedColor);
      setColorInput(seedColor);
    }
  }, [seedColor, open]);

  const harmonies = useMemo(() => generateHarmonies(color), [color]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleHexInput = useCallback((val: string) => {
    setColorInput(val);
    // Validate and apply if valid hex
    const clean = val.trim().replace(/^#*/, '#').slice(0, 7);
    if (/^#[0-9a-f]{6}$/i.test(clean)) {
      setColor(clean);
    }
  }, []);

  const handleSwatchClick = useCallback((hex: string, e: React.MouseEvent) => {
    if (e.altKey) {
      // Alt+click = set as seed
      setColor(hex);
      setColorInput(hex);
    } else if (e.shiftKey) {
      // Shift+click = copy
      navigator.clipboard.writeText(hex).catch(() => {});
      setCopiedColor(hex);
      setTimeout(() => setCopiedColor(null), 1200);
    } else {
      // Click = apply to selected shape
      onApplyColor(hex);
      setCopiedColor(hex);
      setTimeout(() => setCopiedColor(null), 800);
    }
  }, [onApplyColor]);

  const [h, s, l] = useMemo(() => hexToHsl(color), [color]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 320,
        zIndex: 420,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        width: 300,
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color,
          border: '1px solid rgba(255,255,255,0.15)',
          flexShrink: 0,
          boxShadow: `0 0 8px ${color}66`,
          transition: 'background 0.15s, box-shadow 0.15s',
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Color Harmony
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Seed color picker */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
          Seed Color
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Native color picker */}
          <div style={{ position: 'relative', width: 40, height: 32, flexShrink: 0 }}>
            <div style={{
              width: 40, height: 32, borderRadius: 8,
              background: color,
              border: '2px solid var(--border)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }} />
            <input
              type="color"
              value={color}
              onChange={e => { setColor(e.target.value); setColorInput(e.target.value); }}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer',
              }}
            />
          </div>
          {/* Hex input */}
          <input
            value={colorInput}
            onChange={e => handleHexInput(e.target.value)}
            onBlur={() => setColorInput(color)}
            style={{
              flex: 1, background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '5px 8px', color: 'var(--text)',
              fontSize: 12, fontFamily: 'monospace', outline: 'none',
            }}
            onFocus={e => e.target.select()}
            placeholder="#6366f1"
          />
        </div>

        {/* HSL display */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 6,
          fontSize: 10, color: 'var(--subtle)', fontFamily: 'monospace',
        }}>
          <span>H: {h}°</span>
          <span>S: {s}%</span>
          <span>L: {l}%</span>
        </div>

        {/* Hue ring preview */}
        <div style={{
          marginTop: 8, height: 8, borderRadius: 99,
          background: `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => hslToHex(i * 30, s, l)).join(',')})`,
          position: 'relative',
        }}>
          {/* Indicator */}
          <div style={{
            position: 'absolute',
            left: `${h / 360 * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12,
            borderRadius: '50%',
            background: color,
            border: '2px solid white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            transition: 'left 0.1s',
          }} />
        </div>
      </div>

      {/* Harmony groups */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {harmonies.map(group => {
          const isExpanded = expandedGroup === group.name || expandedGroup === null;
          return (
            <div key={group.name} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Group header */}
              <button
                onClick={() => setExpandedGroup(prev => prev === group.name ? null : group.name)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '7px 12px', border: 'none',
                  background: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{group.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--subtle)', marginLeft: 6 }}>{group.description}</span>
                </div>
                <span style={{
                  fontSize: 10, color: 'var(--subtle)',
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s', display: 'inline-block',
                }}>›</span>
              </button>

              {/* Swatches */}
              {isExpanded && (
                <div style={{ display: 'flex', padding: '0 12px 10px', gap: 4 }}>
                  {group.colors.map((hex, ci) => {
                    const isCopied = copiedColor === hex;
                    const fg = textColorFor(hex);
                    return (
                      <div
                        key={`${group.name}-${ci}`}
                        onClick={(e) => handleSwatchClick(hex, e)}
                        title={`${hex}\nClick: apply to shape\nShift+click: copy hex\nAlt+click: use as seed`}
                        style={{
                          flex: 1,
                          height: 48,
                          borderRadius: 8,
                          background: hex,
                          cursor: 'pointer',
                          border: `2px solid ${isCopied ? 'white' : 'transparent'}`,
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                          paddingBottom: 3,
                          transition: 'transform 0.1s, border-color 0.1s',
                          boxShadow: isCopied ? `0 0 12px ${hex}88` : 'none',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.06) translateY(-2px)';
                          (e.currentTarget as HTMLElement).style.zIndex = '2';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.transform = '';
                          (e.currentTarget as HTMLElement).style.zIndex = '';
                        }}
                      >
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                          color: fg, opacity: 0.7, lineHeight: 1, letterSpacing: '-0.01em',
                        }}>
                          {hex.slice(1).toUpperCase()}
                        </span>
                        {isCopied && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.3)', borderRadius: 6,
                          }}>
                            <span style={{ fontSize: 16 }}>✓</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)', flexShrink: 0,
        fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--muted)' }}>Click</strong> to apply ·{' '}
        <strong style={{ color: 'var(--muted)' }}>Shift+click</strong> to copy ·{' '}
        <strong style={{ color: 'var(--muted)' }}>Alt+click</strong> as seed
      </div>
    </div>
  );
}
