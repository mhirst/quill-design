import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import type { ElementSelection } from '@shared/types';

interface Props {
  allClasses: string;
  selection: ElementSelection;
  onPatch: (selection: ElementSelection, newClasses: string) => void;
}

export function ClassChipsEditor({ allClasses, selection, onPatch }: Props) {
  const [classes, setClasses] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClasses(allClasses.split(/\s+/).filter(Boolean));
    setInputValue('');
    setEditing(false);
  }, [allClasses, selection.descriptor]);

  const commit = (newClasses: string[]) => {
    const cls = newClasses.join(' ');
    onPatch(selection, cls);
  };

  const removeClass = (cls: string) => {
    const next = classes.filter((c) => c !== cls);
    setClasses(next);
    commit(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !classes.includes(val)) {
        const next = [...classes, val];
        setClasses(next);
        commit(next);
      }
      setInputValue('');
    }
    if (e.key === 'Backspace' && !inputValue) {
      const next = classes.slice(0, -1);
      setClasses(next);
      commit(next);
    }
    if (e.key === 'Escape') {
      setInputValue('');
      setEditing(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="uppercase"
          style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em' }}
        >
          Classes
        </span>
        <button
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          style={{ color: 'var(--muted)' }}
          className="hover:text-white transition-colors"
          aria-label="Add class"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="px-3 py-2.5 flex flex-wrap gap-1.5" style={{ maxHeight: 160, overflowY: 'auto' }}>
        {classes.map((cls) => (
          <span
            key={cls}
            className="flex items-center gap-1 px-2 py-1 rounded"
            style={{
              background: 'var(--panel-alt)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'monospace',
              fontSize: 13,
            }}
          >
            {cls}
            <button
              onClick={() => removeClass(cls)}
              style={{ color: 'var(--muted)' }}
              className="hover:text-white transition-colors leading-none"
              aria-label={`Remove class ${cls}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}

        {editing && (
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) {
                const next = [...classes, inputValue.trim()];
                setClasses(next);
                commit(next);
              }
              setInputValue('');
              setEditing(false);
            }}
            placeholder="add class…"
            className="bg-transparent outline-none rounded px-2 py-1"
            style={{
              border: '1px solid var(--accent)',
              color: 'var(--text)',
              fontFamily: 'monospace',
              fontSize: 11,
              minWidth: 90,
            }}
          />
        )}

        {!editing && (
          <button
            onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="px-2 py-1 rounded transition-colors"
            style={{ color: 'var(--muted)', border: '1px dashed var(--border)', fontSize: 11 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
          >
            + add
          </button>
        )}
      </div>
    </div>
  );
}
