import { useState } from 'react';
import { analytics } from '../../lib/analytics';
import { Sparkles, CheckCircle } from 'lucide-react';
import { ProviderSettings } from '../settings/ProviderSettings';

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'provider' | 'success';

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');

  const handleProviderSaved = () => {
    analytics.track('onboarding_completed');
    setStep('success');
    setTimeout(onComplete, 1400);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
        backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 70%)',
        overflowY: 'auto', padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '36px 36px 32px',
          display: 'flex', flexDirection: 'column', gap: 24,
          boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
        }}
      >
        {step === 'welcome' && <WelcomeStep onNext={() => setStep('provider')} />}
        {step === 'provider' && (
          <ProviderStep onSaved={handleProviderSaved} onBack={() => setStep('welcome')} />
        )}
        {step === 'success' && <SuccessStep />}
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: 'var(--subtle)' }}>
        Your credentials are stored locally and never leave your machine.
      </p>
    </div>
  );
}

// ── Step: Welcome ──────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, white) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 25%, transparent)',
        }}>
          <Sparkles size={26} color="white" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Quill
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Design beautiful UIs with AI — powered by Claude, GPT-4, LM Studio, or any local model.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          ['✦', 'Generate components from natural language'],
          ['⬡', 'Draw shapes and edit visually on the canvas'],
          ['⌥', 'Inspect and edit any element in real time'],
          ['◈', 'Works with cloud AI or fully local models'],
        ].map(([icon, text]) => (
          <div key={text} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8,
            background: 'var(--panel-alt)', border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--accent)', flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, white) 100%)',
          color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 25%, transparent)',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Get started →
      </button>
    </>
  );
}

// ── Step: Provider ─────────────────────────────────────────────────────────────

function ProviderStep({ onSaved, onBack }: { onSaved: () => void; onBack: () => void }) {
  return (
    <>
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Connect an AI provider
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          Quill works with Claude, OpenAI, or a local model via LM Studio or Ollama — no API key needed for local.
        </p>
      </div>

      <ProviderSettings onSaved={onSaved} />

      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: 'var(--muted)',
          fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'left',
          marginTop: -12,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
      >
        ← Back
      </button>
    </>
  );
}

// ── Step: Success ──────────────────────────────────────────────────────────────

function SuccessStep() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '16px 0' }}>
      <div style={{ animation: 'pop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <CheckCircle size={52} color="var(--success)" strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          You're all set!
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Opening Quill…</p>
      </div>
      <style>{`@keyframes pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
