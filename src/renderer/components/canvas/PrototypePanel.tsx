/**
 * PrototypePanel — Visual interaction / prototype link builder.
 *
 * Lets you draw click-trigger arrows from one shape to another,
 * define transitions (instant, dissolve, slide, push), and preview
 * interactions live. Also shows a flow overview SVG of all links.
 *
 * Shortcut: ⌘⇧⌥P
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriggerType = 'click' | 'hover' | 'press' | 'drag' | 'key';
export type ActionType = 'navigate' | 'scroll-to' | 'open-overlay' | 'close-overlay' | 'back';
export type TransitionType = 'instant' | 'dissolve' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'push-left' | 'push-right' | 'smart-animate';
export type EasingType = 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear' | 'spring';

export interface Interaction {
  id: string;
  fromShapeId: string;
  toShapeId: string;
  trigger: TriggerType;
  action: ActionType;
  transition: TransitionType;
  easing: EasingType;
  duration: number; // ms
  delay: number; // ms
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRIGGER_ICONS: Record<TriggerType, string> = {
  click: '↖', hover: '◎', press: '●', drag: '⇔', key: '⌨',
};

const ACTION_ICONS: Record<ActionType, string> = {
  navigate: '→', 'scroll-to': '↓', 'open-overlay': '⊕', 'close-overlay': '⊖', back: '←',
};

const TRANSITION_LABELS: Record<TransitionType, string> = {
  instant: 'Instant', dissolve: 'Dissolve', 'slide-left': 'Slide ←', 'slide-right': 'Slide →',
  'slide-up': 'Slide ↑', 'slide-down': 'Slide ↓', 'push-left': 'Push ←', 'push-right': 'Push →',
  'smart-animate': 'Smart Animate',
};

const TRIGGER_COLORS: Record<TriggerType, string> = {
  click: '#6366f1', hover: '#10b981', press: '#f59e0b', drag: '#ec4899', key: '#8b5cf6',
};

const ALL_TRIGGERS: TriggerType[] = ['click', 'hover', 'press', 'drag', 'key'];
const ALL_ACTIONS: ActionType[] = ['navigate', 'scroll-to', 'open-overlay', 'close-overlay', 'back'];
const ALL_TRANSITIONS: TransitionType[] = ['instant', 'dissolve', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'push-left', 'push-right', 'smart-animate'];
const ALL_EASINGS: EasingType[] = ['ease-in-out', 'ease-in', 'ease-out', 'linear', 'spring'];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── FlowArrow SVG overlay ────────────────────────────────────────────────────

interface FlowArrowProps {
  interactions: Interaction[];
  shapes: Shape[];
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
  activeId: string | null;
  connectingFrom: string | null;
  cursorPos: { x: number; y: number } | null;
  onArrowClick: (id: string) => void;
}

function shapeCenter(s: Shape, zoom: number, panX: number, panY: number) {
  return {
    x: (s.x + s.width / 2) * zoom + panX,
    y: (s.y + s.height / 2) * zoom + panY,
  };
}

function shapeBorderPoint(s: Shape, zoom: number, panX: number, panY: number, targetX: number, targetY: number): { x: number; y: number } {
  const cx = (s.x + s.width / 2) * zoom + panX;
  const cy = (s.y + s.height / 2) * zoom + panY;
  const hw = (s.width / 2) * zoom;
  const hh = (s.height / 2) * zoom;
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (dx === 0 && dy === 0) return { x: cx + hw, y: cy };
  const angle = Math.atan2(dy, dx);
  const tx = Math.abs(Math.cos(angle)) < 1e-6 ? 0 : hw / Math.abs(Math.cos(angle));
  const ty = Math.abs(Math.sin(angle)) < 1e-6 ? 0 : hh / Math.abs(Math.sin(angle));
  const t = Math.min(tx, ty);
  return { x: cx + Math.cos(angle) * t, y: cy + Math.sin(angle) * t };
}

function CurvedArrow({ x1, y1, x2, y2, color, active, dashed }: {
  x1: number; y1: number; x2: number; y2: number; color: string; active?: boolean; dashed?: boolean;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curve = Math.min(80, dist * 0.4);
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = (x1 + x2) / 2 + nx * curve;
  const cy = (y1 + y2) / 2 + ny * curve;

  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

  // Arrow head
  const t = 0.95;
  const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  const angle = Math.atan2(y2 - by, x2 - bx);
  const arrowLen = 10;
  const a1x = x2 - Math.cos(angle - 0.5) * arrowLen;
  const a1y = y2 - Math.sin(angle - 0.5) * arrowLen;
  const a2x = x2 - Math.cos(angle + 0.5) * arrowLen;
  const a2y = y2 - Math.sin(angle + 0.5) * arrowLen;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={active ? 2.5 : 1.5}
        strokeDasharray={dashed ? '6 4' : undefined}
        opacity={active ? 1 : 0.7}
      />
      <polygon
        points={`${x2},${y2} ${a1x},${a1y} ${a2x},${a2y}`}
        fill={color}
        opacity={active ? 1 : 0.7}
      />
    </g>
  );
}

export function FlowArrowsOverlay({
  interactions, shapes, zoom, panX, panY, width, height,
  activeId, connectingFrom, cursorPos, onArrowClick,
}: FlowArrowProps) {
  if (width === 0 && height === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        zIndex: 18, overflow: 'visible',
      }}
      width={width}
      height={height}
    >
      <defs>
        {Object.entries(TRIGGER_COLORS).map(([trigger, color]) => (
          <filter key={trigger} id={`glow-${trigger}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        ))}
      </defs>

      {interactions.map((link) => {
        const fromShape = shapes.find(s => s.id === link.fromShapeId);
        const toShape = shapes.find(s => s.id === link.toShapeId);
        if (!fromShape || !toShape) return null;

        const tc = shapeCenter(toShape, zoom, panX, panY);
        const fc = shapeCenter(fromShape, zoom, panX, panY);
        const from = shapeBorderPoint(fromShape, zoom, panX, panY, tc.x, tc.y);
        const to = shapeBorderPoint(toShape, zoom, panX, panY, fc.x, fc.y);
        const color = TRIGGER_COLORS[link.trigger];
        const isActive = link.id === activeId;

        return (
          <g
            key={link.id}
            style={{ pointerEvents: 'all', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onArrowClick(link.id); }}
          >
            {/* Hit area */}
            <CurvedArrow x1={from.x} y1={from.y} x2={to.x} y2={to.y} color="transparent" active={false} />
            <CurvedArrow x1={from.x} y1={from.y} x2={to.x} y2={to.y} color={color} active={isActive} />

            {/* Trigger icon badge */}
            <circle
              cx={from.x}
              cy={from.y}
              r={9}
              fill={color}
              opacity={0.9}
              filter={isActive ? `url(#glow-${link.trigger})` : undefined}
            />
            <text
              x={from.x}
              y={from.y + 4}
              textAnchor="middle"
              fontSize={9}
              fill="white"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {TRIGGER_ICONS[link.trigger]}
            </text>
          </g>
        );
      })}

      {/* Connecting-in-progress ghost arrow */}
      {connectingFrom && cursorPos && (() => {
        const fromShape = shapes.find(s => s.id === connectingFrom);
        if (!fromShape) return null;
        const from = shapeBorderPoint(fromShape, zoom, panX, panY, cursorPos.x, cursorPos.y);
        return (
          <CurvedArrow
            x1={from.x} y1={from.y}
            x2={cursorPos.x} y2={cursorPos.y}
            color="#6366f1"
            active={true}
            dashed={true}
          />
        );
      })()}
    </svg>
  );
}

// ─── Hotspot highlights on shapes ─────────────────────────────────────────────

export function PrototypeHotspots({
  interactions, shapes, zoom, panX, panY,
  connectingFrom, onShapeClick, active,
}: {
  interactions: Interaction[];
  shapes: Shape[];
  zoom: number; panX: number; panY: number;
  connectingFrom: string | null;
  onShapeClick: (id: string) => void;
  active: boolean;
}) {
  if (!active) return null;

  const hotspotIds = new Set(interactions.map(l => l.fromShapeId));

  return (
    <>
      {shapes.map(s => {
        const hasLink = hotspotIds.has(s.id);
        const isConnecting = s.id === connectingFrom;
        const x = s.x * zoom + panX;
        const y = s.y * zoom + panY;
        const w = s.width * zoom;
        const h = s.height * zoom;

        return (
          <div
            key={s.id}
            onClick={() => onShapeClick(s.id)}
            style={{
              position: 'absolute',
              left: x, top: y, width: w, height: h,
              border: isConnecting
                ? '2px solid #6366f1'
                : hasLink
                  ? '1.5px solid rgba(99,102,241,0.5)'
                  : '1px dashed rgba(99,102,241,0.25)',
              borderRadius: 3,
              background: isConnecting ? 'rgba(99,102,241,0.12)' : hasLink ? 'rgba(99,102,241,0.05)' : 'transparent',
              cursor: 'crosshair',
              zIndex: 17,
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            title={hasLink ? `${s.name || s.type} (has interactions)` : `Click to start interaction from ${s.name || s.type}`}
          />
        );
      })}
    </>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  interactions: Interaction[];
  onChange: (interactions: Interaction[]) => void;
  shapes: Shape[];
  selectedShapeId?: string | null;
  connectingFrom: string | null;
  onStartConnect: (shapeId: string) => void;
  onCancelConnect: () => void;
}

function PanelSelect<T extends string>({
  value, options, labels, onChange, color,
}: {
  value: T;
  options: T[];
  labels?: Partial<Record<T, string>>;
  onChange: (v: T) => void;
  color?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        background: 'var(--surface2, #2a2a3a)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 4,
        color: color ?? 'var(--text, #e2e8f0)',
        fontSize: 11,
        padding: '3px 6px',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      {options.map(o => (
        <option key={o} value={o}>{labels?.[o] ?? o}</option>
      ))}
    </select>
  );
}

function NumInput({ value, min, max, step, onChange, label, unit }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; label: string; unit?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--muted, #888)', flex: 1 }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 60, background: 'var(--surface2, #2a2a3a)',
          border: '1px solid var(--border, #2d2d3d)',
          borderRadius: 4, color: 'var(--text, #e2e8f0)',
          fontSize: 11, padding: '3px 6px', textAlign: 'right',
        }}
      />
      {unit && <span style={{ fontSize: 10, color: 'var(--muted, #888)', minWidth: 16 }}>{unit}</span>}
    </div>
  );
}

export function PrototypePanel({
  open, onClose, interactions, onChange, shapes,
  selectedShapeId, connectingFrom, onStartConnect, onCancelConnect,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterShapeId, setFilterShapeId] = useState<string | null>(null);

  const activeLink = interactions.find(l => l.id === activeId) ?? null;

  const updateLink = useCallback((id: string, patch: Partial<Interaction>) => {
    onChange(interactions.map(l => l.id === id ? { ...l, ...patch } : l));
  }, [interactions, onChange]);

  const deleteLink = useCallback((id: string) => {
    onChange(interactions.filter(l => l.id !== id));
    if (activeId === id) setActiveId(null);
  }, [interactions, onChange, activeId]);

  const addLink = useCallback(() => {
    if (!selectedShapeId) return;
    const newLink: Interaction = {
      id: makeId(),
      fromShapeId: selectedShapeId,
      toShapeId: '',
      trigger: 'click',
      action: 'navigate',
      transition: 'dissolve',
      easing: 'ease-in-out',
      duration: 300,
      delay: 0,
      color: '#6366f1',
    };
    onChange([...interactions, newLink]);
    setActiveId(newLink.id);
  }, [selectedShapeId, interactions, onChange]);

  const shapeName = (id: string) => {
    const s = shapes.find(sh => sh.id === id);
    return s ? (s.name || s.type) : '(deleted)';
  };

  const visibleLinks = filterShapeId
    ? interactions.filter(l => l.fromShapeId === filterShapeId || l.toShapeId === filterShapeId)
    : interactions;

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        right: 8,
        width: 280,
        maxHeight: 'calc(100vh - 120px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        zIndex: 120,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14 }}>⇄</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Prototype</span>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>{interactions.length} link{interactions.length !== 1 ? 's' : ''}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
      </div>

      {/* Add interaction */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        {connectingFrom ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 11, color: 'var(--accent, #6366f1)' }}>
              Click a shape to connect from <strong>{shapeName(connectingFrom)}</strong>
            </div>
            <button
              onClick={onCancelConnect}
              style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, color: '#ef4444', fontSize: 10, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={addLink}
              disabled={!selectedShapeId}
              title={selectedShapeId ? `Add interaction from "${shapeName(selectedShapeId)}"` : 'Select a shape first'}
              style={{
                flex: 1, padding: '5px 8px',
                background: selectedShapeId ? 'rgba(99,102,241,0.15)' : 'var(--surface2, #2a2a3a)',
                border: `1px solid ${selectedShapeId ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                borderRadius: 5, color: selectedShapeId ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                fontSize: 11, cursor: selectedShapeId ? 'pointer' : 'not-allowed', fontWeight: 600,
              }}
            >
              + Add Interaction {selectedShapeId ? `from "${shapeName(selectedShapeId)}"` : ''}
            </button>
            <button
              onClick={() => { if (selectedShapeId) onStartConnect(selectedShapeId); }}
              disabled={!selectedShapeId}
              title="Draw connection arrow"
              style={{
                padding: '5px 8px',
                background: 'var(--surface2, #2a2a3a)',
                border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 5, color: selectedShapeId ? 'var(--text, #e2e8f0)' : 'var(--muted, #888)',
                fontSize: 11, cursor: selectedShapeId ? 'pointer' : 'not-allowed',
              }}
            >
              ⤳
            </button>
          </div>
        )}

        {/* Filter */}
        {interactions.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>Filter:</span>
            <select
              value={filterShapeId ?? ''}
              onChange={(e) => setFilterShapeId(e.target.value || null)}
              style={{
                flex: 1, background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 4, color: 'var(--text, #e2e8f0)', fontSize: 10, padding: '2px 4px',
              }}
            >
              <option value="">All shapes</option>
              {shapes.map(s => (
                <option key={s.id} value={s.id}>{s.name || s.type}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Interaction list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {visibleLinks.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⇄</div>
            <div style={{ fontSize: 12, color: 'var(--muted, #888)' }}>
              No interactions yet
            </div>
            <div style={{ fontSize: 11, color: 'var(--subtle, #444)', marginTop: 4 }}>
              Select a shape and click "+ Add Interaction"
            </div>
          </div>
        ) : (
          visibleLinks.map(link => {
            const isExpanded = link.id === activeId;
            const color = TRIGGER_COLORS[link.trigger];
            const fromShape = shapes.find(s => s.id === link.fromShapeId);
            const toShape = shapes.find(s => s.id === link.toShapeId);

            return (
              <div key={link.id} style={{ borderBottom: '1px solid var(--border, #2d2d3d)' }}>
                {/* Link row */}
                <div
                  onClick={() => setActiveId(isExpanded ? null : link.id)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 8,
                    cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.07)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Trigger badge */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'white', flexShrink: 0,
                  }}>
                    {TRIGGER_ICONS[link.trigger]}
                  </div>

                  {/* From → To */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text, #e2e8f0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shapeName(link.fromShapeId)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted, #888)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ color }}>{link.trigger}</span>
                      <span>→</span>
                      <span style={{ color: toShape ? 'var(--text, #e2e8f0)' : '#ef4444' }}>
                        {link.toShapeId ? shapeName(link.toShapeId) : 'no target'}
                      </span>
                    </div>
                  </div>

                  {/* Transition */}
                  <span style={{ fontSize: 9, color: 'var(--subtle, #444)', flexShrink: 0 }}>
                    {TRANSITION_LABELS[link.transition]}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLink(link.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 14, padding: 2, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Trigger */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Trigger</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {ALL_TRIGGERS.map(t => (
                          <button
                            key={t}
                            onClick={() => updateLink(link.id, { trigger: t })}
                            style={{
                              padding: '3px 8px', border: `1px solid ${link.trigger === t ? TRIGGER_COLORS[t] : 'var(--border, #2d2d3d)'}`,
                              borderRadius: 12, background: link.trigger === t ? `${TRIGGER_COLORS[t]}22` : 'var(--surface2, #2a2a3a)',
                              color: link.trigger === t ? TRIGGER_COLORS[t] : 'var(--muted, #888)',
                              fontSize: 10, cursor: 'pointer', fontWeight: link.trigger === t ? 700 : 400,
                            }}
                          >
                            {TRIGGER_ICONS[t]} {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Action</div>
                      <PanelSelect
                        value={link.action}
                        options={ALL_ACTIONS}
                        onChange={(v) => updateLink(link.id, { action: v })}
                      />
                    </div>

                    {/* Target shape */}
                    {link.action !== 'back' && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Destination</div>
                        <select
                          value={link.toShapeId}
                          onChange={(e) => updateLink(link.id, { toShapeId: e.target.value })}
                          style={{
                            width: '100%', background: 'var(--surface2, #2a2a3a)',
                            border: `1px solid ${link.toShapeId ? 'var(--border, #2d2d3d)' : 'rgba(239,68,68,0.5)'}`,
                            borderRadius: 4, color: 'var(--text, #e2e8f0)',
                            fontSize: 11, padding: '4px 6px',
                          }}
                        >
                          <option value="">— select target —</option>
                          {shapes.filter(s => s.id !== link.fromShapeId).map(s => (
                            <option key={s.id} value={s.id}>{s.name || s.type}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Transition */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Transition</div>
                      <PanelSelect
                        value={link.transition}
                        options={ALL_TRANSITIONS}
                        labels={TRANSITION_LABELS}
                        onChange={(v) => updateLink(link.id, { transition: v })}
                      />
                    </div>

                    {link.transition !== 'instant' && (
                      <>
                        {/* Easing */}
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Easing</div>
                          <PanelSelect
                            value={link.easing}
                            options={ALL_EASINGS}
                            onChange={(v) => updateLink(link.id, { easing: v })}
                          />
                        </div>

                        {/* Duration / Delay */}
                        <NumInput
                          label="Duration" value={link.duration} min={0} max={5000} step={50}
                          onChange={(v) => updateLink(link.id, { duration: v })} unit="ms"
                        />
                        <NumInput
                          label="Delay" value={link.delay} min={0} max={5000} step={50}
                          onChange={(v) => updateLink(link.id, { delay: v })} unit="ms"
                        />
                      </>
                    )}

                    {/* Timing preview bar */}
                    {link.transition !== 'instant' && (
                      <div style={{ marginTop: 2 }}>
                        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Timing</div>
                        <div style={{ height: 8, background: 'var(--surface2, #2a2a3a)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${(link.delay / (link.delay + link.duration + 1)) * 100}%`,
                            width: `${(link.duration / (link.delay + link.duration + 1)) * 100}%`,
                            background: `linear-gradient(90deg, ${TRIGGER_COLORS[link.trigger]}88, ${TRIGGER_COLORS[link.trigger]})`,
                            borderRadius: 4,
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: 9, color: 'var(--subtle, #444)' }}>
                            {link.delay > 0 ? `+${link.delay}ms delay` : 'No delay'}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--subtle, #444)' }}>
                            {link.duration}ms
                          </span>
                        </div>
                      </div>
                    )}

                    {/* CSS export */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>CSS transition</div>
                      <div style={{
                        background: 'var(--surface2, #2a2a3a)', borderRadius: 5,
                        padding: '6px 8px', fontFamily: 'monospace', fontSize: 10,
                        color: 'var(--accent, #6366f1)', wordBreak: 'break-all',
                        border: '1px solid var(--border, #2d2d3d)',
                      }}>
                        {link.transition === 'instant'
                          ? 'transition: none;'
                          : `transition: all ${link.duration}ms ${link.easing === 'spring' ? 'cubic-bezier(0.34,1.56,0.64,1)' : link.easing} ${link.delay}ms;`
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      {interactions.length > 0 && (
        <div style={{
          padding: '6px 12px', borderTop: '1px solid var(--border, #2d2d3d)',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          {(Object.keys(TRIGGER_COLORS) as TriggerType[]).map(trigger => {
            const count = interactions.filter(l => l.trigger === trigger).length;
            if (!count) return null;
            return (
              <div key={trigger} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRIGGER_COLORS[trigger] }} />
                <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>{count} {trigger}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
