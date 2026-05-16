/**
 * Extracts partial JSX from a streaming Claude response.
 * The code block may not be closed yet, so we handle open fences.
 */
export function extractPartialJsx(text: string): string | null {
  // Fully closed block
  const closed = /```(?:jsx?|tsx?)\n([\s\S]+?)```/.exec(text);
  if (closed) return closed[1].trim();

  // Open block (still streaming)
  const open = /```(?:jsx?|tsx?)\n([\s\S]+)$/.exec(text);
  if (open) return open[1];

  return null;
}

export type StreamPhase =
  | 'thinking'     // no code block yet
  | 'writing'      // inside code block
  | 'finishing'    // code block just closed
  | 'done';

export interface StreamStats {
  phase: StreamPhase;
  linesWritten: number;
  charsWritten: number;
  partialJsx: string | null;
}

export function analyzeStream(text: string): StreamStats {
  const hasOpenFence = /```(?:jsx?|tsx?)/.test(text);
  const closedMatch = /```(?:jsx?|tsx?)\n([\s\S]+?)```/.exec(text);
  const openMatch = /```(?:jsx?|tsx?)\n([\s\S]+)$/.exec(text);

  if (closedMatch) {
    const jsx = closedMatch[1].trim();
    return {
      phase: 'finishing',
      linesWritten: jsx.split('\n').length,
      charsWritten: jsx.length,
      partialJsx: jsx,
    };
  }

  if (hasOpenFence && openMatch) {
    const jsx = openMatch[1];
    return {
      phase: 'writing',
      linesWritten: jsx.split('\n').length,
      charsWritten: jsx.length,
      partialJsx: jsx,
    };
  }

  return {
    phase: 'thinking',
    linesWritten: 0,
    charsWritten: 0,
    partialJsx: null,
  };
}
