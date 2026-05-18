import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ElementSelection } from '@shared/types';
import { parseTailwindClasses, rgbToHex, parseFourSides, parsePx } from '../../lib/tailwind-parser';
import { ClassChipsEditor } from './ClassChipsEditor';
import { SpacingSection } from './SpacingSection';
import { TypographySection } from './TypographySection';
import { AppearanceSection } from './AppearanceSection';
import { LayoutSection } from './LayoutSection';

interface Props {
  selection: ElementSelection;
  isPatching: boolean;
  onPatch: (selection: ElementSelection, newClasses: string) => void;
}

export function InspectPanel({ selection, isPatching, onPatch }: Props) {
  const parsed = parseTailwindClasses(selection.className);
  const cs = selection.computedStyles;

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--panel)' }}
    >
      {/* Header */}
      <div
        className="flex flex-col justify-center gap-0.5 px-3 flex-shrink-0"
        style={{ minHeight: 52, paddingTop: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          {/* Tag name — the readable part */}
          <code style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
            {selection.tagName.toLowerCase()}
          </code>
          {isPatching && <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: 'var(--muted)' }} />}
        </div>
        {/* Classes — truncated, muted */}
        <div
          className="truncate"
          style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.3 }}
          title={selection.className}
        >
          {selection.className || <span style={{ fontStyle: 'italic' }}>no classes</span>}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <LayoutSection computedStyles={cs} selection={selection} onPatch={onPatch} />

        <SpacingSection
          computedStyles={cs}
          classes={parsed.spacing}
          selection={selection}
          onPatch={onPatch}
        />

        <TypographySection
          computedStyles={cs}
          classes={parsed.typography}
          selection={selection}
          onPatch={onPatch}
        />

        <AppearanceSection
          computedStyles={cs}
          classes={parsed.appearance}
          selection={selection}
          onPatch={onPatch}
        />

        <ClassChipsEditor
          allClasses={selection.className}
          selection={selection}
          onPatch={onPatch}
        />
      </div>
    </div>
  );
}
