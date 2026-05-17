/**
 * CursorPresence — Simulated multiplayer cursor overlay.
 *
 * Shows animated "ghost" collaborator cursors drifting around the canvas.
 * Each cursor has a name tag, a distinct color, and moves with natural easing.
 * Cursors occasionally pause (as if reading), then drift to a new position.
 *
 * Designed purely for presentation/demo wow-factor. No network I/O.
 * Toggle with ⌘⇧P. Panel shows the list of "collaborators" with online dots.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Collaborator {
  id: string;
  name: string;
  avatar: string;   // initials
  color: string;
  isTyping: boolean;
}

interface CursorState {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  paused: boolean;
  pauseUntil: number;
}

export interface Props {
  canvasWidth: number;
  canvasHeight: number;
  active: boolean;
}

export interface PanelProps {
  collaborators: Collaborator[];
  visible: boolean;
  onClose: () => void;
  style?: React.CSSProperties;
}

// ── Collaborator definitions ───────────────────────────────────────────────────

const COLLABORATORS: Collaborator[] = [
  { id: 'alex', name: 'Alex Chen', avatar: 'AC', color: '#f59e0b', isTyping: false },
  { id: 'maya', name: 'Maya Patel', avatar: 'MP', color: '#06b6d4', isTyping: false },
  { id: 'sam', name: 'Sam Rivera', avatar: 'SR', color: '#22c55e', isTyping: false },
  { id: 'jordan', name: 'Jordan Kim', avatar: 'JK', color: '#f43f5e', isTyping: false },
];

// ── Cursor SVG ─────────────────────────────────────────────────────────────────

function CursorIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ display: 'block' }}>
      <path
        d="M0.5 1L0.5 17.5L4.5 13.5L7.5 20.5L9.5 19.5L6.5 12.5H12L0.5 1Z"
        fill={color}
        stroke="white"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Cursor Component ───────────────────────────────────────────────────────────

function Cursor({ collaborator, state }: { collaborator: Collaborator; state: CursorState }) {
  const [showLabel, setShowLabel] = useState(true);
  const [typing, setTyping] = useState(false);

  // Randomly show/hide typing indicator
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.15) {
        setTyping(true);
        setTimeout(() => setTyping(false), 1500 + Math.random() * 2000);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Occasionally hide label (looks more natural)
  useEffect(() => {
    const interval = setInterval(() => {
      setShowLabel(Math.random() > 0.2);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: state.x,
        top: state.y,
        transition: state.paused ? 'none' : 'left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        pointerEvents: 'none',
        zIndex: 22,
        willChange: 'left, top',
      }}
    >
      <CursorIcon color={collaborator.color} />

      {showLabel && (
        <div style={{
          position: 'absolute',
          top: 18,
          left: 12,
          background: collaborator.color,
          color: 'white',
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
          padding: '2px 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {collaborator.name}
          {typing && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)',
                animation: 'cursorDot 1s infinite 0s',
              }} />
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)',
                animation: 'cursorDot 1s infinite 0.2s',
              }} />
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)',
                animation: 'cursorDot 1s infinite 0.4s',
              }} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main overlay ───────────────────────────────────────────────────────────────

export function CursorPresence({ canvasWidth, canvasHeight, active }: Props) {
  const [cursors, setCursors] = useState<CursorState[]>(() =>
    COLLABORATORS.map((c, i) => ({
      id: c.id,
      x: 100 + i * 200,
      y: 100 + i * 80,
      targetX: 150 + i * 180,
      targetY: 150 + i * 60,
      paused: false,
      pauseUntil: 0,
    }))
  );

  // Inject CSS keyframes once
  useEffect(() => {
    const id = 'cursor-presence-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes cursorDot {
          0%, 60%, 100% { opacity: 0.4; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.3); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Animate cursors
  useEffect(() => {
    if (!active) return;

    const INTERVAL = 1200; // ms between position updates
    const PAUSE_CHANCE = 0.35; // 35% chance to pause at a position

    const interval = setInterval(() => {
      const now = Date.now();
      setCursors(prev => prev.map(c => {
        if (c.paused && now < c.pauseUntil) return c; // still paused

        // Move toward target (done when transition fires) — pick new target
        const newTarget = {
          targetX: Math.max(40, Math.min(canvasWidth - 80, Math.random() * canvasWidth)),
          targetY: Math.max(40, Math.min(canvasHeight - 80, Math.random() * canvasHeight)),
        };

        if (!c.paused && Math.random() < PAUSE_CHANCE) {
          // Pause at current target
          return {
            ...c,
            x: c.targetX,
            y: c.targetY,
            paused: true,
            pauseUntil: now + 1500 + Math.random() * 3000,
          };
        }

        return {
          ...c,
          x: c.targetX,
          y: c.targetY,
          ...newTarget,
          paused: false,
          pauseUntil: 0,
        };
      }));
    }, INTERVAL);

    return () => clearInterval(interval);
  }, [active, canvasWidth, canvasHeight]);

  if (!active) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      zIndex: 22,
      overflow: 'hidden',
    }}>
      {COLLABORATORS.map((collab, i) => (
        <Cursor
          key={collab.id}
          collaborator={collab}
          state={cursors[i]}
        />
      ))}
    </div>
  );
}

// ── Presence Panel ─────────────────────────────────────────────────────────────

export function CursorPresencePanel({ collaborators, visible, onClose, style }: PanelProps) {
  const [ping, setPing] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);

  const handlePing = useCallback((id: string) => {
    setPing(id);
    setPingCount(c => c + 1);
    setTimeout(() => setPing(null), 2000);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      width: 220,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
      ...style,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 10px 7px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>👥</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #e2e8f0)' }}>
            Live Presence
          </span>
          <span style={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#22c55e',
            fontSize: 9, fontWeight: 700,
            padding: '1px 5px', borderRadius: 4,
          }}>
            LIVE
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted, #888)', fontSize: 14, padding: 2,
          }}
        >✕</button>
      </div>

      {/* Collaborator list */}
      <div style={{ padding: '6px 0' }}>
        {collaborators.map(collab => (
          <div
            key={collab.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: collab.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: 'white',
              flexShrink: 0,
              position: 'relative',
            }}>
              {collab.avatar}
              {/* Online dot */}
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 8, height: 8, borderRadius: '50%',
                background: '#22c55e',
                border: '1.5px solid var(--panel, #1e1e2e)',
              }} />
            </div>

            {/* Name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 500,
                color: 'var(--text, #e2e8f0)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {collab.name}
              </div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 1 }}>
                {ping === collab.id ? '🔔 Pinged!' : 'Viewing canvas'}
              </div>
            </div>

            {/* Ping button */}
            <button
              onClick={() => handlePing(collab.id)}
              title={`Ping ${collab.name}`}
              style={{
                background: ping === collab.id ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${ping === collab.id ? 'rgba(251,191,36,0.4)' : 'var(--border, #2d2d3d)'}`,
                borderRadius: 5,
                color: ping === collab.id ? '#fbbf24' : 'var(--muted, #888)',
                cursor: 'pointer',
                fontSize: 12,
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {ping === collab.id ? '✓' : '👋'}
            </button>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div style={{
        borderTop: '1px solid var(--border, #2d2d3d)',
        padding: '7px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
          {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''} online
        </span>
        {pingCount > 0 && (
          <span style={{ fontSize: 10, color: '#fbbf24' }}>
            {pingCount} ping{pingCount !== 1 ? 's' : ''} sent
          </span>
        )}
      </div>
    </div>
  );
}
