// Typing engine: keystroke matching + WPM / accuracy metrics. Pure functions.

export type KeyResult =
  | { kind: 'progress' }
  | { kind: 'typo' }
  | { kind: 'complete'; option: string };

/**
 * Applies one keystroke against one or more acceptable targets.
 * Stop-on-error: a wrong key is rejected and the buffer does not change, so the
 * buffer always holds a correct prefix of at least one option.
 */
export function applyKey(buffer: string, options: string[], key: string): { buffer: string; result: KeyResult } {
  if (key.length !== 1) return { buffer, result: { kind: 'progress' } };
  const next = buffer + key.toLowerCase();
  const candidates = options.filter((o) => o.toLowerCase().startsWith(next));
  if (candidates.length === 0) return { buffer, result: { kind: 'typo' } };
  const exact = candidates.find((o) => o.toLowerCase() === next);
  if (exact) return { buffer: '', result: { kind: 'complete', option: exact } };
  return { buffer: next, result: { kind: 'progress' } };
}

/** Which option the current buffer is heading toward (for highlighting). */
export function activeOption(buffer: string, options: string[]): string | null {
  if (!buffer) return null;
  return options.find((o) => o.toLowerCase().startsWith(buffer)) ?? null;
}

export interface TypingStats {
  correctKeystrokes: number;
  totalKeystrokes: number;
  wordsCompleted: number;
  wordsFailed: number; // timeouts
  activeMs: number; // time spent on timed prompts
}

export const emptyStats = (): TypingStats => ({
  correctKeystrokes: 0,
  totalKeystrokes: 0,
  wordsCompleted: 0,
  wordsFailed: 0,
  activeMs: 0,
});

/** Standard WPM: (correct characters / 5) per minute of active typing. */
export function wpm(s: TypingStats): number {
  if (s.activeMs < 1000) return 0;
  return round2(s.correctKeystrokes / 5 / (s.activeMs / 60_000));
}

export function accuracy(s: TypingStats): number {
  if (s.totalKeystrokes === 0) return 100;
  return round2((s.correctKeystrokes / s.totalKeystrokes) * 100);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
