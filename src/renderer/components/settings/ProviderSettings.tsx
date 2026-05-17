import { useState, useEffect } from 'react';
import type { AIProviderConfig, AIProviderType } from '@shared/types';
import { PROVIDER_DEFAULTS, PROVIDER_LABELS } from '@shared/types';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  onSaved?: () => void;
}

const PROVIDERS: AIProviderType[] = ['anthropic', 'openai', 'lmstudio', 'ollama', 'openai-compat'];

const PROVIDER_DESCRIPTIONS: Record<AIProviderType, string> = {
  anthropic:       'Best quality. Requires an Anthropic API key.',
  openai:          'GPT-4o and other OpenAI models. Requires an OpenAI API key.',
  lmstudio:        'Run models locally with LM Studio. No API key needed.',
  ollama:          'Run models locally with Ollama. No API key needed.',
  'openai-compat': 'Any server that speaks the OpenAI chat completions API.',
};

const NEEDS_KEY: Record<AIProviderType, boolean> = {
  anthropic:       true,
  openai:          true,
  lmstudio:        false,
  ollama:          false,
  'openai-compat': false,
};

const KEY_PLACEHOLDER: Record<AIProviderType, string> = {
  anthropic:       'sk-ant-api03-…',
  openai:          'sk-…',
  lmstudio:        '(not required)',
  ollama:          '(not required)',
  'openai-compat': 'optional',
};

export function ProviderSettings({ onSaved }: Props) {
  const [provider, setProvider] = useState<AIProviderType>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    const api = (window as unknown as Record<string, unknown>).api as typeof window.api | undefined;
    if (!api?.getProviderConfig) { setLoaded(true); return; }
    api.getProviderConfig().then(({ config }) => {
      if (config) {
        setProvider(config.provider);
        setApiKey(config.apiKey ?? '');
        setBaseUrl(config.baseUrl ?? PROVIDER_DEFAULTS[config.provider]?.baseUrl ?? '');
        setModel(config.model ?? PROVIDER_DEFAULTS[config.provider]?.model ?? '');
      }
      setLoaded(true);
    });
  }, []);

  // When provider changes, fill defaults
  const handleProviderChange = (p: AIProviderType) => {
    setProvider(p);
    setApiKey('');
    setBaseUrl(PROVIDER_DEFAULTS[p]?.baseUrl ?? '');
    setModel(PROVIDER_DEFAULTS[p]?.model ?? '');
    setStatus('idle');
    setErrorMsg('');
  };

  const handleSave = async () => {
    const api = (window as unknown as Record<string, unknown>).api as typeof window.api | undefined;
    if (!api) return;

    const config: AIProviderConfig = {
      provider,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || PROVIDER_DEFAULTS[provider]?.baseUrl,
      model: model.trim() || PROVIDER_DEFAULTS[provider]?.model,
    };

    setStatus('validating');
    setErrorMsg('');

    const result = await api.validateProviderConfig(config);
    if (!result.valid) {
      setStatus('error');
      setErrorMsg(result.error ?? 'Could not connect — check your settings and try again.');
      return;
    }

    await api.setProviderConfig(config);
    setStatus('saved');
    onSaved?.();
    setTimeout(() => setStatus('idle'), 3000);
  };

  if (!loaded) return null;

  const needsKey = NEEDS_KEY[provider];
  const isLocal = provider === 'lmstudio' || provider === 'ollama';
  const canSave = status !== 'validating' && (!needsKey || apiKey.trim().length > 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Provider picker */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          AI Provider
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${provider === p ? 'var(--accent)' : 'var(--border)'}`,
                background: provider === p ? 'var(--accent-dim)' : 'var(--panel-alt)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                border: `2px solid ${provider === p ? 'var(--accent)' : 'var(--border)'}`,
                background: provider === p ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {provider === p && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  {PROVIDER_LABELS[p]}
                  {(p === 'lmstudio' || p === 'ollama') && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', borderRadius: 4, padding: '1px 5px' }}>
                      LOCAL
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {PROVIDER_DESCRIPTIONS[p]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Config fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* API Key — only for cloud providers */}
        {needsKey && (
          <Field label="API Key">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setStatus('idle'); }}
              placeholder={KEY_PLACEHOLDER[provider]}
              autoComplete="off"
              spellCheck={false}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
            {provider === 'anthropic' && (
              <HelpLink href="https://console.anthropic.com/settings/keys" label="Get an Anthropic API key" />
            )}
            {provider === 'openai' && (
              <HelpLink href="https://platform.openai.com/api-keys" label="Get an OpenAI API key" />
            )}
          </Field>
        )}

        {/* Base URL — always shown for local, optional for compat */}
        {(isLocal || provider === 'openai-compat') && (
          <Field label="Endpoint URL">
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setStatus('idle'); }}
              placeholder={PROVIDER_DEFAULTS[provider]?.baseUrl ?? 'http://localhost:1234/v1'}
              spellCheck={false}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
            {provider === 'lmstudio' && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0' }}>
                Start LM Studio → Local Server tab → Start Server
              </p>
            )}
            {provider === 'ollama' && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0' }}>
                Run <code style={{ background: 'var(--panel-alt)', padding: '1px 4px', borderRadius: 3 }}>ollama serve</code> first
              </p>
            )}
          </Field>
        )}

        {/* Model name */}
        <Field label="Model">
          <input
            type="text"
            value={model}
            onChange={(e) => { setModel(e.target.value); setStatus('idle'); }}
            placeholder={PROVIDER_DEFAULTS[provider]?.model ?? 'model-name'}
            spellCheck={false}
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          {provider === 'lmstudio' && (
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0' }}>
              Must match the model name shown in LM Studio exactly
            </p>
          )}
        </Field>
      </div>

      {/* Status / error */}
      {status === 'error' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <AlertCircle size={14} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--error)' }}>{errorMsg}</span>
        </div>
      )}
      {status === 'saved' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={14} color="var(--success)" />
          <span style={{ fontSize: 12, color: 'var(--success)' }}>Provider saved successfully</span>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!canSave}
        style={{
          padding: '10px 0', borderRadius: 8, border: 'none',
          background: canSave
            ? 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, white) 100%)'
            : 'var(--panel-alt)',
          color: canSave ? 'white' : 'var(--subtle)',
          fontSize: 13, fontWeight: 600,
          cursor: canSave ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.15s',
        }}
      >
        {status === 'validating'
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</>
          : 'Save & Connect'}
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function HelpLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', marginTop: 4 }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
    >
      {label} →
    </a>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--input-bg)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'monospace', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
};

