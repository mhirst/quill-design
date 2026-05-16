import { useState, useRef } from 'react';
import { analytics } from '../../lib/analytics';
import { Sparkles, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, Loader2, ExternalLink, Key } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'key-entry' | 'validating' | 'success';

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleValidate = async () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      setError('API keys start with sk-ant-…');
      return;
    }
    setError(null);
    setStep('validating');

    const result = await window.api.validateApiKey(trimmed);
    if (result.valid) {
      await window.api.setApiKey(trimmed);
      analytics.track('onboarding_completed');
      setStep('success');
      setTimeout(onComplete, 1600);
    } else {
      setStep('key-entry');
      setError(result.error ?? 'Invalid API key — please check and try again.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
        // Subtle radial glow from center
        backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 70%)',
      }}
    >
      {/* Card */}
      <div
        style={{
          width: '100%', maxWidth: 440,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '40px 40px 36px',
          display: 'flex', flexDirection: 'column', gap: 28,
          boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
        }}
      >
        {step === 'welcome' && <WelcomeStep onNext={() => { setStep('key-entry'); setTimeout(() => inputRef.current?.focus(), 80); }} />}
        {(step === 'key-entry' || step === 'validating') && (
          <KeyEntryStep
            inputRef={inputRef}
            keyValue={key}
            showKey={showKey}
            error={error}
            validating={step === 'validating'}
            onKeyChange={(v) => { setKey(v); setError(null); }}
            onToggleShow={() => setShowKey((s) => !s)}
            onSubmit={handleValidate}
            onBack={() => setStep('welcome')}
          />
        )}
        {step === 'success' && <SuccessStep />}
      </div>

      {/* Footer */}
      <p style={{ marginTop: 20, fontSize: 11, color: 'var(--subtle)' }}>
        Your key is stored locally and never leaves your device.
      </p>
    </div>
  );
}

// ── Step: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, white) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 25%, transparent)',
          }}
        >
          <Sparkles size={28} color="white" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Quill
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Design beautiful UIs with AI — powered by Claude.
          </p>
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['✦', 'Generate components from natural language'],
          ['⬡', 'Draw shapes and edit visually'],
          ['⌥', 'Inspect and edit any element in real time'],
        ].map(([icon, text]) => (
          <div
            key={text}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{text}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onNext}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, white) 100%)',
          color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 25%, transparent)',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Get started <ArrowRight size={16} />
      </button>
    </>
  );
}

// ── Step: Key Entry ────────────────────────────────────────────────────────

function KeyEntryStep({
  inputRef, keyValue, showKey, error, validating,
  onKeyChange, onToggleShow, onSubmit, onBack,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  keyValue: string;
  showKey: boolean;
  error: string | null;
  validating: boolean;
  onKeyChange: (v: string) => void;
  onToggleShow: () => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const ready = keyValue.trim().startsWith('sk-ant-') && keyValue.trim().length > 20;

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'var(--accent-dim)',
            border: '1px solid color-mix(in srgb, var(--accent) 19%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Key size={15} color="var(--accent)" />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Connect to Claude
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Quill runs on the Anthropic API. You'll need a free API key to get started.
        </p>
      </div>

      {/* How to get a key */}
      <div style={{
        borderRadius: 10, border: '1px solid var(--border)',
        background: 'var(--panel-alt)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            How to get an API key
          </span>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Open Console <ExternalLink size={10} />
          </a>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: '1', text: <>Go to <strong style={{ color: 'var(--text)' }}>console.anthropic.com</strong> and sign up or log in</> },
            { n: '2', text: <>Navigate to <strong style={{ color: 'var(--text)' }}>Settings → API Keys</strong></> },
            { n: '3', text: <>Click <strong style={{ color: 'var(--text)' }}>Create Key</strong>, give it a name, and copy it</> },
            { n: '4', text: <>Paste it below — Quill stores it locally and never shares it</> },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-dim)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              }}>
                {n}
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, paddingTop: 1 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Input */}
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type={showKey ? 'text' : 'password'}
            value={keyValue}
            onChange={(e) => onKeyChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && ready && !validating) onSubmit(); }}
            placeholder="sk-ant-api03-…"
            spellCheck={false}
            autoComplete="off"
            style={{
              width: '100%', padding: '11px 44px 11px 14px',
              borderRadius: 10, border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
              background: 'var(--input-bg)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'monospace', outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          <button
            onClick={onToggleShow}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
              display: 'flex', padding: 2,
            }}
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} color="var(--error)" />
            <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onBack}
          disabled={validating}
          style={{
            flex: '0 0 auto', padding: '11px 18px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'none',
            color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!ready || validating}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
            background: ready && !validating
              ? 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, white) 100%)'
              : 'var(--panel-alt)',
            color: ready && !validating ? 'white' : 'var(--subtle)',
            fontSize: 14, fontWeight: 600, cursor: ready && !validating ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
            boxShadow: ready && !validating ? '0 4px 16px color-mix(in srgb, var(--accent) 19%, transparent)' : 'none',
          }}
        >
          {validating
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Validating…</>
            : <>Connect <ArrowRight size={15} /></>
          }
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── Step: Success ──────────────────────────────────────────────────────────

function SuccessStep() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
      <div style={{ animation: 'pop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <CheckCircle size={52} color="var(--success)" strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          You're all set!
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Opening Quill…
        </p>
      </div>
      <style>{`@keyframes pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
