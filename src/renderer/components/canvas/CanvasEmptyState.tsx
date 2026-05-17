/**
 * CanvasEmptyState
 * Clean, compact empty state — fits comfortably in the default Electron window.
 */
import type { Shape } from '../../lib/shapes';

interface Props {
  onOpenShortcuts: () => void;
  onInsertTemplate?: (shapes: Partial<Shape>[]) => void;
  onDismiss?: () => void;
}

// ── Quick-start templates ─────────────────────────────────────────────────────

interface Template {
  label: string;
  icon: React.ReactNode;
  description: string;
  shapes: Partial<Shape>[];
}

// Mini SVG icons for templates (16×16)
function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2.5" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.4} strokeWidth="1.2"/>
      <rect x="3" y="3" width="10" height="5" rx="1" fill="currentColor" fillOpacity={0.3}/>
      <rect x="3" y="9.5" width="6" height="1.2" rx="0.6" fill="currentColor" fillOpacity={0.5}/>
      <rect x="3" y="11.5" width="4" height="1.2" rx="0.6" fill="currentColor" fillOpacity={0.3}/>
    </svg>
  );
}
function IconHero() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="12" rx="2" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.4} strokeWidth="1.2"/>
      <rect x="4" y="5" width="8" height="1.8" rx="0.9" fill="currentColor" fillOpacity={0.6}/>
      <rect x="5.5" y="7.5" width="5" height="1.2" rx="0.6" fill="currentColor" fillOpacity={0.3}/>
      <rect x="5.5" y="10" width="5" height="1.8" rx="0.9" fill="currentColor" fillOpacity={0.45}/>
    </svg>
  );
}
function IconMobile() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="4" y="1" width="8" height="14" rx="2" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.4} strokeWidth="1.2"/>
      <rect x="6" y="2.5" width="4" height="1" rx="0.5" fill="currentColor" fillOpacity={0.4}/>
      <rect x="5.5" y="5" width="5" height="3" rx="1" fill="currentColor" fillOpacity={0.3}/>
      <circle cx="8" cy="12.5" r="1" fill="currentColor" fillOpacity={0.4}/>
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.4} strokeWidth="1.2"/>
      <rect x="2.5" y="2.5" width="4" height="11" rx="1" fill="currentColor" fillOpacity={0.2}/>
      <rect x="7.5" y="5" width="6" height="3" rx="1" fill="currentColor" fillOpacity={0.3}/>
      <rect x="7.5" y="2.5" width="6" height="1.8" rx="0.9" fill="currentColor" fillOpacity={0.3}/>
      <rect x="7.5" y="9.5" width="6" height="4" rx="1" fill="currentColor" fillOpacity={0.2}/>
    </svg>
  );
}

const TEMPLATES: Template[] = [
  {
    label: 'UI Card',
    icon: <IconCard />,
    description: 'Card with image, title, and CTA',
    shapes: [
      { type: 'rectangle', x: 80, y: 80, width: 280, height: 320, fill: '#ffffff', fillOpacity: 1, fillType: 'solid', borderRadius: 16, shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowColor: 'rgba(0,0,0,0.12)', strokeWidth: 0, stroke: 'transparent', name: 'Card' },
      { type: 'rectangle', x: 80, y: 80, width: 280, height: 160, fill: '#6366f1', fillOpacity: 1, fillType: 'linear-gradient', gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }], gradientAngle: 135, borderRadius: [16, 16, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Image Placeholder' },
      { type: 'text', x: 100, y: 258, width: 240, height: 28, text: 'Card Title', fontSize: 18, fontWeight: '700', fontFamily: 'Inter', color: '#0f172a', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Title' },
      { type: 'text', x: 100, y: 290, width: 240, height: 40, text: 'Short description text goes here. Keep it concise.', fontSize: 12, fontWeight: '400', fontFamily: 'Inter', color: '#64748b', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, lineHeight: 1.55, name: 'Description' },
      { type: 'rectangle', x: 100, y: 348, width: 120, height: 36, fill: '#6366f1', fillOpacity: 1, fillType: 'solid', borderRadius: 8, strokeWidth: 0, stroke: 'transparent', name: 'Button BG' },
      { type: 'text', x: 100, y: 356, width: 120, height: 20, text: 'Learn More', fontSize: 12, fontWeight: '600', fontFamily: 'Inter', color: '#ffffff', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, textAlign: 'center', name: 'Button Label' },
    ],
  },
  {
    label: 'Hero',
    icon: <IconHero />,
    description: 'Landing page hero with headline and CTAs',
    shapes: [
      { type: 'rectangle', x: 80, y: 80, width: 720, height: 380, fill: '#0f172a', fillOpacity: 1, fillType: 'solid', borderRadius: 20, strokeWidth: 0, stroke: 'transparent', name: 'Hero BG' },
      { type: 'ellipse', x: 260, y: 40, width: 320, height: 280, fill: '#6366f1', fillOpacity: 0.15, fillType: 'solid', borderRadius: 9999, strokeWidth: 0, stroke: 'transparent', name: 'Glow Orb', filterBlur: 60 },
      { type: 'rectangle', x: 330, y: 110, width: 120, height: 26, fill: '#1e1b4b', fillOpacity: 1, fillType: 'solid', borderRadius: 20, stroke: 'rgba(99,102,241,0.4)', strokeWidth: 1, name: 'Badge BG' },
      { type: 'text', x: 330, y: 114, width: 120, height: 18, text: '✨ New — v2.0 released', fontSize: 10, fontWeight: '600', fontFamily: 'Inter', color: '#818cf8', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, textAlign: 'center', name: 'Badge Label' },
      { type: 'text', x: 200, y: 152, width: 480, height: 60, text: 'Design without limits', fontSize: 40, fontWeight: '800', fontFamily: 'Inter', color: '#f8fafc', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, textAlign: 'center', letterSpacing: -1, name: 'Headline' },
      { type: 'text', x: 240, y: 222, width: 400, height: 36, text: 'The modern design tool built for speed.\nStart creating beautiful interfaces today.', fontSize: 14, fontWeight: '400', fontFamily: 'Inter', color: '#94a3b8', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, textAlign: 'center', lineHeight: 1.6, name: 'Subheadline' },
      { type: 'rectangle', x: 292, y: 280, width: 140, height: 44, fill: '#6366f1', fillOpacity: 1, fillType: 'solid', borderRadius: 10, strokeWidth: 0, stroke: 'transparent', name: 'CTA Primary BG' },
      { type: 'text', x: 292, y: 292, width: 140, height: 20, text: 'Get started free', fontSize: 13, fontWeight: '600', fontFamily: 'Inter', color: '#ffffff', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, textAlign: 'center', name: 'CTA Primary' },
      { type: 'rectangle', x: 448, y: 280, width: 140, height: 44, fill: 'transparent', fillOpacity: 0, fillType: 'solid', borderRadius: 10, stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1, name: 'CTA Secondary BG' },
      { type: 'text', x: 448, y: 292, width: 140, height: 20, text: 'View demo →', fontSize: 13, fontWeight: '500', fontFamily: 'Inter', color: '#e2e8f0', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, textAlign: 'center', name: 'CTA Secondary' },
    ],
  },
  {
    label: 'Mobile',
    icon: <IconMobile />,
    description: 'iPhone frame with app UI inside',
    shapes: [
      { type: 'rectangle', x: 80, y: 80, width: 300, height: 640, fill: '#1a1a2e', fillOpacity: 1, fillType: 'solid', borderRadius: 44, stroke: '#2a2a4a', strokeWidth: 2, shadow: true, shadowX: 0, shadowY: 20, shadowBlur: 48, shadowColor: 'rgba(0,0,0,0.5)', name: 'Phone Frame' },
      { type: 'rectangle', x: 92, y: 108, width: 276, height: 590, fill: '#ffffff', fillOpacity: 1, fillType: 'solid', borderRadius: 34, strokeWidth: 0, stroke: 'transparent', name: 'Screen' },
      { type: 'rectangle', x: 92, y: 108, width: 276, height: 44, fill: '#f8f9fa', fillOpacity: 1, fillType: 'solid', borderRadius: [34, 34, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Status Bar' },
      { type: 'rectangle', x: 177, y: 115, width: 106, height: 28, fill: '#1a1a2e', fillOpacity: 1, fillType: 'solid', borderRadius: 20, strokeWidth: 0, stroke: 'transparent', name: 'Notch' },
      { type: 'rectangle', x: 92, y: 652, width: 276, height: 46, fill: '#f8f9fa', fillOpacity: 1, fillType: 'solid', borderRadius: [0, 0, 34, 34] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Nav Bar' },
      { type: 'text', x: 112, y: 165, width: 236, height: 28, text: 'Dashboard', fontSize: 20, fontWeight: '700', fontFamily: 'Inter', color: '#0f172a', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'App Title' },
      { type: 'rectangle', x: 112, y: 208, width: 236, height: 80, fill: '#6366f1', fillOpacity: 1, fillType: 'linear-gradient', gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#8b5cf6', position: 1 }], gradientAngle: 135, borderRadius: 14, strokeWidth: 0, stroke: 'transparent', shadow: true, shadowX: 0, shadowY: 4, shadowBlur: 12, shadowColor: 'rgba(99,102,241,0.35)', name: 'Dashboard Card' },
    ],
  },
  {
    label: 'Dashboard',
    icon: <IconDashboard />,
    description: 'Stats, chart, and sidebar layout',
    shapes: [
      { type: 'frame', x: 80, y: 80, width: 700, height: 460, fill: '#f8fafc', fillOpacity: 1, fillType: 'solid', borderRadius: 0, strokeWidth: 0, stroke: 'transparent', name: 'Dashboard Frame' },
      { type: 'rectangle', x: 80, y: 80, width: 180, height: 460, fill: '#0f172a', fillOpacity: 1, fillType: 'solid', borderRadius: [0, 0, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Sidebar' },
      { type: 'rectangle', x: 100, y: 104, width: 140, height: 36, fill: '#1e293b', fillOpacity: 1, fillType: 'solid', borderRadius: 8, strokeWidth: 0, stroke: 'transparent', name: 'Logo BG' },
      { type: 'text', x: 100, y: 112, width: 140, height: 20, text: '⬡ MyApp', fontSize: 14, fontWeight: '700', fontFamily: 'Inter', color: '#f8fafc', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, textAlign: 'center', name: 'Logo' },
      { type: 'rectangle', x: 276, y: 104, width: 148, height: 76, fill: '#ffffff', fillOpacity: 1, fillType: 'solid', borderRadius: 10, strokeWidth: 1, stroke: '#e2e8f0', shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.06)', name: 'Stat Card 1' },
      { type: 'text', x: 290, y: 114, width: 120, height: 14, text: 'Total Users', fontSize: 10, fontWeight: '600', fontFamily: 'Inter', color: '#64748b', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 1 Label' },
      { type: 'text', x: 290, y: 132, width: 120, height: 32, text: '24,891', fontSize: 22, fontWeight: '700', fontFamily: 'Inter', color: '#0f172a', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 1 Value' },
      { type: 'text', x: 290, y: 162, width: 120, height: 14, text: '↑ 12.5% this week', fontSize: 9, fontWeight: '500', fontFamily: 'Inter', color: '#22c55e', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 1 Change' },
      { type: 'rectangle', x: 436, y: 104, width: 148, height: 76, fill: '#ffffff', fillOpacity: 1, fillType: 'solid', borderRadius: 10, strokeWidth: 1, stroke: '#e2e8f0', shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.06)', name: 'Stat Card 2' },
      { type: 'text', x: 450, y: 114, width: 120, height: 14, text: 'Revenue', fontSize: 10, fontWeight: '600', fontFamily: 'Inter', color: '#64748b', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 2 Label' },
      { type: 'text', x: 450, y: 132, width: 120, height: 32, text: '$142k', fontSize: 22, fontWeight: '700', fontFamily: 'Inter', color: '#0f172a', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 2 Value' },
      { type: 'text', x: 450, y: 162, width: 120, height: 14, text: '↑ 8.1% vs last mo.', fontSize: 9, fontWeight: '500', fontFamily: 'Inter', color: '#22c55e', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 2 Change' },
      { type: 'rectangle', x: 596, y: 104, width: 148, height: 76, fill: '#ffffff', fillOpacity: 1, fillType: 'solid', borderRadius: 10, strokeWidth: 1, stroke: '#e2e8f0', shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.06)', name: 'Stat Card 3' },
      { type: 'text', x: 610, y: 114, width: 120, height: 14, text: 'Conversion', fontSize: 10, fontWeight: '600', fontFamily: 'Inter', color: '#64748b', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 3 Label' },
      { type: 'text', x: 610, y: 132, width: 120, height: 32, text: '3.24%', fontSize: 22, fontWeight: '700', fontFamily: 'Inter', color: '#0f172a', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 3 Value' },
      { type: 'text', x: 610, y: 162, width: 120, height: 14, text: '↓ 0.3% vs last mo.', fontSize: 9, fontWeight: '500', fontFamily: 'Inter', color: '#ef4444', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Stat 3 Change' },
      { type: 'rectangle', x: 276, y: 196, width: 380, height: 200, fill: '#ffffff', fillOpacity: 1, fillType: 'solid', borderRadius: 10, strokeWidth: 1, stroke: '#e2e8f0', shadow: true, shadowX: 0, shadowY: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.06)', name: 'Chart Card' },
      { type: 'text', x: 292, y: 210, width: 200, height: 16, text: 'Revenue over time', fontSize: 11, fontWeight: '600', fontFamily: 'Inter', color: '#0f172a', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, name: 'Chart Title' },
      { type: 'rectangle', x: 292, y: 322, width: 28, height: 50, fill: '#6366f1', fillOpacity: 1, fillType: 'solid', borderRadius: [4, 4, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Bar 1' },
      { type: 'rectangle', x: 334, y: 300, width: 28, height: 72, fill: '#6366f1', fillOpacity: 1, fillType: 'solid', borderRadius: [4, 4, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Bar 2' },
      { type: 'rectangle', x: 376, y: 314, width: 28, height: 58, fill: '#6366f1', fillOpacity: 1, fillType: 'solid', borderRadius: [4, 4, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Bar 3' },
      { type: 'rectangle', x: 418, y: 286, width: 28, height: 86, fill: '#8b5cf6', fillOpacity: 1, fillType: 'solid', borderRadius: [4, 4, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Bar 4' },
      { type: 'rectangle', x: 460, y: 272, width: 28, height: 100, fill: '#8b5cf6', fillOpacity: 1, fillType: 'solid', borderRadius: [4, 4, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Bar 5' },
      { type: 'rectangle', x: 502, y: 258, width: 28, height: 114, fill: '#a855f7', fillOpacity: 1, fillType: 'solid', borderRadius: [4, 4, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Bar 6' },
      { type: 'rectangle', x: 544, y: 242, width: 28, height: 130, fill: '#a855f7', fillOpacity: 1, fillType: 'solid', borderRadius: [4, 4, 0, 0] as [number, number, number, number], strokeWidth: 0, stroke: 'transparent', name: 'Bar 7' },
    ],
  },
];

const TOOL_TIPS = [
  { key: 'R', label: 'Rect' },
  { key: 'O', label: 'Ellipse' },
  { key: 'T', label: 'Text' },
  { key: 'F', label: 'Frame' },
];

export function CanvasEmptyState({ onOpenShortcuts, onInsertTemplate, onDismiss }: Props) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 11,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 20,
        textAlign: 'center',
        pointerEvents: onInsertTemplate ? 'all' : 'none',
        userSelect: 'none',
        width: 320,
        position: 'relative',
      }}>
        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            title="Don't show this again"
            style={{
              position: 'absolute', top: -8, right: -8,
              width: 22, height: 22,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              color: 'var(--subtle)',
              fontSize: 12, lineHeight: 1,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'all',
              transition: 'color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--subtle)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            ×
          </button>
        )}

        {/* Wordmark / logo */}
        <div style={{ pointerEvents: 'none' }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--muted)',
            letterSpacing: '0.01em',
            marginBottom: 4,
          }}>
            Start designing
          </div>
          <div style={{ fontSize: 11, color: 'var(--subtle)', lineHeight: 1.5 }}>
            Draw on the canvas or pick a template
          </div>
        </div>

        {/* Template cards — 2×2 grid, compact */}
        {onInsertTemplate && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            width: '100%',
          }}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => onInsertTemplate(tpl.shapes)}
                title={tpl.description}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  transition: 'background 0.12s, border-color 0.12s',
                  color: 'var(--muted)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--muted)';
                }}
              >
                <span style={{ flexShrink: 0, opacity: 0.8 }}>{tpl.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'inherit', lineHeight: 1.2 }}>
                  {tpl.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          pointerEvents: 'none',
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.6 }} />
          <span style={{ fontSize: 10, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>or use a tool</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.6 }} />
        </div>

        {/* Tool shortcuts — single row */}
        <div style={{
          display: 'flex', gap: 6, pointerEvents: 'none',
          justifyContent: 'center',
        }}>
          {TOOL_TIPS.map(({ key, label }) => (
            <div key={key} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 28, height: 28,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'monospace',
                fontSize: 12, fontWeight: 700,
                color: 'var(--subtle)',
              }}>
                {key}
              </div>
              <span style={{ fontSize: 9, color: 'var(--subtle)', letterSpacing: '0.02em' }}>{label}</span>
            </div>
          ))}

          {/* Shortcuts link as a key-style button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              onClick={onOpenShortcuts}
              style={{
                width: 28, height: 28,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                color: 'var(--subtle)',
                cursor: 'pointer',
                pointerEvents: 'all',
                transition: 'color 0.12s, border-color 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--muted)';
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--subtle)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              ?
            </button>
            <span style={{ fontSize: 9, color: 'var(--subtle)', letterSpacing: '0.02em' }}>More</span>
          </div>
        </div>

      </div>
    </div>
  );
}
