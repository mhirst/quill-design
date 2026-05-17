/**
 * SettingsModal — App-wide settings.
 *
 * Sections:
 *   • AI Provider — switch between Anthropic, OpenAI, LM Studio, Ollama,
 *     custom OpenAI-compatible. Change model, API key, base URL, validate.
 *   • Appearance — (placeholder for theme toggle when added)
 *   • Canvas — grid defaults, snap, etc.
 *   • About — version info
 *
 * Opens via ⌘, or the gear icon in the title bar.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { AIProviderConfig, AIProviderType } from '../../../shared/types';
import { PROVIDER_DEFAULTS, PROVIDER_LABELS } from '../../../shared/types';

// ── Known Claude models ──────────────────────────────────────────────────────

const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-5',    label: 'Claude Opus 4.5 (most capable)' },
  { id: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5 (balanced)' },
  { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6 (latest)' },
  { id: 'claude-haiku-3-5',   label: 'Claude Haiku 3.5 (fastest)' },
];

const OPENAI_MODELS = [
  { id: 'gpt-4o',        label: 'GPT-4o (recommended)' },
  { id: 'gpt-4o-mini',   label: 'GPT-4o mini (fast & cheap)' },
  { id: 'gpt-4-turbo',   label: 'GPT-4 Turbo' },
  { id: 'o1',            label: 'o1 (reasoning)' },
  { id: 'o1-mini',       label: 'o1-mini' },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApi() {
  return (window as unknown as Record<string, unknown>).api as typeof window.api | undefined;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #888)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Label>{label}</Label>
      {children}
      {hint && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--subtle, #555)', lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 7, color: 'var(--text, #e2e8f0)', fontSize: 12, padding: '8px 10px',
        outline: 'none', fontFamily: mono ? 'monospace' : undefined,
        transition: 'border-color 0.15s',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)'; }}
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { id: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 7, color: 'var(--text, #e2e8f0)', fontSize: 12, padding: '8px 10px',
        outline: 'none', cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

type Section = 'ai' | 'canvas' | 'about';

export function SettingsModal({ open, onClose }: Props) {
  const [section, setSection] = useState<Section>('ai');
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        width: 640, maxWidth: '90vw', maxHeight: '85vh',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        display: 'flex', overflow: 'hidden',
      }}>
        {/* Sidebar nav */}
        <div style={{
          width: 160, flexShrink: 0,
          background: 'rgba(0,0,0,0.15)',
          borderRight: '1px solid var(--border, #2d2d3d)',
          display: 'flex', flexDirection: 'column',
          padding: '16px 0',
        }}>
          <div style={{ padding: '0 16px 12px', fontSize: 11, fontWeight: 700, color: 'var(--subtle, #555)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Settings
          </div>
          {([
            { id: 'ai' as Section,     label: 'AI Provider',  icon: '✦' },
            { id: 'canvas' as Section, label: 'Canvas',       icon: '⬡' },
            { id: 'about' as Section,  label: 'About',        icon: 'ℹ' },
          ]).map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                background: section === item.id ? 'rgba(99,102,241,0.12)' : 'none',
                color: section === item.id ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                fontSize: 12, fontWeight: section === item.id ? 600 : 400,
                borderLeft: `2px solid ${section === item.id ? 'var(--accent, #6366f1)' : 'transparent'}`,
                transition: 'all 0.1s', textAlign: 'left', width: '100%',
              }}
              onMouseEnter={e => { if (section !== item.id) e.currentTarget.style.color = 'var(--text, #e2e8f0)'; }}
              onMouseLeave={e => { if (section !== item.id) e.currentTarget.style.color = 'var(--muted, #888)'; }}
            >
              <span style={{ fontSize: 14, width: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '16px 20px',
            borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>
              {section === 'ai' ? 'AI Provider' : section === 'canvas' ? 'Canvas' : 'About'}
            </span>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--muted, #888)',
              cursor: 'pointer', fontSize: 20, padding: '0 2px', lineHeight: 1,
            }}>×</button>
          </div>

          {/* Section body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {section === 'ai' && <AIProviderSection />}
            {section === 'canvas' && <CanvasSection />}
            {section === 'about' && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Provider Section ───────────────────────────────────────────────────────

function AIProviderSection() {
  const [config, setConfig] = useState<AIProviderConfig>({
    provider: 'anthropic',
    model: PROVIDER_DEFAULTS.anthropic.model ?? 'claude-sonnet-4-6',
    apiKey: '',
    baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl ?? '',
  });
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [customModel, setCustomModel] = useState('');

  // Load current config
  useEffect(() => {
    const api = getApi();
    if (!api?.getProviderConfig) { setLoading(false); return; }
    api.getProviderConfig().then(({ config: c }) => {
      if (c) {
        setConfig(c);
        // If model isn't in our presets list, populate customModel
        const isKnownModel = [...ANTHROPIC_MODELS, ...OPENAI_MODELS].some(m => m.id === c.model);
        if (!isKnownModel && c.model) setCustomModel(c.model);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleProviderChange = (provider: AIProviderType) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    setConfig({
      provider,
      model: defaults.model ?? '',
      apiKey: config.apiKey ?? '',
      baseUrl: defaults.baseUrl ?? '',
    });
    setValidateResult(null);
    setSaved(false);
    setCustomModel('');
  };

  const handleValidate = async () => {
    const api = getApi();
    if (!api?.validateProviderConfig) {
      setValidateResult({ valid: false, error: 'Not available in browser mode' });
      return;
    }
    setValidating(true);
    setValidateResult(null);
    try {
      const result = await api.validateProviderConfig(config);
      setValidateResult(result);
    } catch {
      setValidateResult({ valid: false, error: 'Validation failed' });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    const api = getApi();
    if (!api?.setProviderConfig) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    await api.setProviderConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const effectiveModel = customModel || config.model || '';
  const needsApiKey = config.provider === 'anthropic' || config.provider === 'openai';
  const needsBaseUrl = config.provider !== 'anthropic' && config.provider !== 'openai';
  const modelOptions = config.provider === 'anthropic' ? ANTHROPIC_MODELS : config.provider === 'openai' ? OPENAI_MODELS : [];

  if (loading) return <div style={{ color: 'var(--muted, #888)', fontSize: 13 }}>Loading…</div>;

  return (
    <div>
      <Field label="Provider">
        <SelectInput
          value={config.provider}
          onChange={v => handleProviderChange(v as AIProviderType)}
          options={Object.entries(PROVIDER_LABELS).map(([id, label]) => ({ id, label }))}
        />
      </Field>

      {needsApiKey && (
        <Field
          label="API Key"
          hint={config.provider === 'anthropic'
            ? 'Get your key at console.anthropic.com'
            : 'Get your key at platform.openai.com'}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <TextInput
                type={showKey ? 'text' : 'password'}
                value={config.apiKey ?? ''}
                onChange={v => { setConfig(c => ({ ...c, apiKey: v })); setValidateResult(null); }}
                placeholder={config.provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                mono
              />
            </div>
            <button
              onClick={() => setShowKey(s => !s)}
              style={{
                flexShrink: 0, padding: '0 10px', background: 'var(--surface2, #2a2a3a)',
                border: '1px solid var(--border, #2d2d3d)', borderRadius: 7,
                color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 13,
              }}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
        </Field>
      )}

      {(needsBaseUrl || config.provider === 'openai-compat') && (
        <Field label="Base URL" hint="e.g. http://localhost:1234/v1">
          <TextInput
            value={config.baseUrl ?? ''}
            onChange={v => { setConfig(c => ({ ...c, baseUrl: v })); setValidateResult(null); }}
            placeholder={PROVIDER_DEFAULTS[config.provider].baseUrl ?? 'http://localhost:1234/v1'}
            mono
          />
        </Field>
      )}

      <Field label="Model">
        {modelOptions.length > 0 ? (
          <>
            <SelectInput
              value={customModel ? '__custom__' : (effectiveModel || modelOptions[0].id)}
              onChange={v => {
                if (v === '__custom__') {
                  setCustomModel(config.model ?? '');
                } else {
                  setConfig(c => ({ ...c, model: v }));
                  setCustomModel('');
                }
                setValidateResult(null);
              }}
              options={[...modelOptions, { id: '__custom__', label: 'Custom model name…' }]}
            />
            {customModel !== '' && (
              <div style={{ marginTop: 6 }}>
                <TextInput
                  value={customModel}
                  onChange={v => { setCustomModel(v); setConfig(c => ({ ...c, model: v })); }}
                  placeholder="e.g. claude-sonnet-4-6"
                  mono
                />
              </div>
            )}
          </>
        ) : (
          <TextInput
            value={config.model ?? ''}
            onChange={v => { setConfig(c => ({ ...c, model: v })); setValidateResult(null); }}
            placeholder={PROVIDER_DEFAULTS[config.provider].model ?? 'model-name'}
            mono
          />
        )}
      </Field>

      {/* Validate + Save row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={handleValidate}
          disabled={validating}
          style={{
            flex: 1, padding: '9px', borderRadius: 8, cursor: validating ? 'wait' : 'pointer',
            background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--muted, #888)', fontSize: 12, fontWeight: 600,
            opacity: validating ? 0.6 : 1, transition: 'all 0.15s',
          }}
        >
          {validating ? 'Testing…' : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', border: 'none',
            background: saved ? '#10b981' : 'var(--accent, #6366f1)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            transition: 'background 0.2s',
          }}
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>

      {/* Validation result */}
      {validateResult && (
        <div style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 8,
          background: validateResult.valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${validateResult.valid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: 12,
          color: validateResult.valid ? '#10b981' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{validateResult.valid ? '✓' : '✕'}</span>
          <div>
            <div style={{ fontWeight: 700 }}>{validateResult.valid ? 'Connection successful' : 'Connection failed'}</div>
            {validateResult.error && <div style={{ marginTop: 2, opacity: 0.8 }}>{validateResult.error}</div>}
          </div>
        </div>
      )}

      {/* Provider info box */}
      <div style={{
        marginTop: 20, padding: '12px 14px',
        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 8, fontSize: 11, color: 'var(--muted, #888)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text, #e2e8f0)', marginBottom: 4 }}>
          {PROVIDER_LABELS[config.provider]}
        </div>
        {config.provider === 'anthropic' && 'Claude models via the Anthropic API. Best for design intelligence, code generation, and creative tasks.'}
        {config.provider === 'openai' && 'GPT models via the OpenAI API. Versatile general-purpose AI.'}
        {config.provider === 'lmstudio' && 'Run models locally with LM Studio. No API key needed. Models stay on your machine.'}
        {config.provider === 'ollama' && 'Run open-source models locally with Ollama. No API key needed. Fast and private.'}
        {config.provider === 'openai-compat' && 'Any OpenAI-compatible API endpoint. Set the base URL to your server.'}
      </div>
    </div>
  );
}

// ── Canvas Section ────────────────────────────────────────────────────────────

function CanvasSection() {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted, #888)', lineHeight: 1.6, marginBottom: 16 }}>
        Canvas-specific settings are coming soon. Most canvas controls are available directly via the keyboard shortcuts overlay (⌘/).
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--surface2, #2a2a3a)', borderRadius: 8, fontSize: 11, color: 'var(--muted, #888)', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: 'var(--text, #e2e8f0)', marginBottom: 6 }}>Quick references</div>
        {[
          ['⌘/', 'Keyboard shortcuts overlay'],
          ['⌘R', 'Toggle rulers'],
          ['⌘M', 'Toggle minimap'],
          ['⌘D', 'Toggle redlines'],
          ['⌘\\', 'Toggle left panel'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '2px 0' }}>
            <code style={{ fontFamily: 'monospace', color: 'var(--accent, #6366f1)', minWidth: 48 }}>{k}</code>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── About Section ─────────────────────────────────────────────────────────────

function AboutSection() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const api = getApi();
    if (api?.getVersion) {
      api.getVersion().then(setVersion).catch(() => setVersion('unknown'));
    } else {
      setVersion('dev');
    }
  }, []);

  return (
    <div>
      {/* Logo / wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, color: '#fff', fontWeight: 800, boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
        }}>
          Q
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text, #e2e8f0)' }}>Quill</div>
          <div style={{ fontSize: 12, color: 'var(--muted, #888)' }}>
            Version {version ?? '…'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted, #888)', lineHeight: 1.7, marginBottom: 16 }}>
        A powerful, AI-assisted design tool built with Electron, React, and TypeScript. Draw shapes, prototype flows, apply effects, and bring your ideas to life — all powered by your choice of AI model.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Built with', value: 'Electron + Vite + React 19 + TypeScript' },
          { label: 'Renderer', value: 'Canvas (DOM shapes) + SVG overlays' },
          { label: 'AI integration', value: 'Anthropic SDK / OpenAI-compatible' },
          { label: 'Storage', value: 'Electron userData (quill-store.json)' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', gap: 12, padding: '7px 10px',
            background: 'var(--surface2, #2a2a3a)', borderRadius: 7,
            fontSize: 11,
          }}>
            <span style={{ color: 'var(--subtle, #555)', minWidth: 100, flexShrink: 0 }}>{row.label}</span>
            <span style={{ color: 'var(--text, #e2e8f0)' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
