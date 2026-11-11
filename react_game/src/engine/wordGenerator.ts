import type { ActionType, Difficulty, WordBankRow } from '../types/db.ts';
import { pickWeighted, type Rng } from './rng.ts';

/** Which WORD_BANK difficulties a location draws from, with weights. */
export const DIFFICULTY_MIX: Record<Difficulty, Partial<Record<Difficulty, number>>> = {
  easy: { easy: 1 },
  medium: { easy: 1, medium: 2 },
  hard: { medium: 1, hard: 2 },
};

export function pickWord(
  bank: WordBankRow[],
  action: ActionType,
  placeDifficulty: Difficulty,
  rng: Rng,
  recent: string[] = [],
): WordBankRow {
  const mix = DIFFICULTY_MIX[placeDifficulty];
  let pool = bank.filter((w) => w.action_type === action && mix[w.difficulty]);
  if (pool.length === 0) pool = bank.filter((w) => w.action_type === action);
  if (pool.length === 0) throw new Error(`WORD_BANK has no '${action}' words`);
  const fresh = pool.filter((w) => !recent.includes(w.word));
  const choice = pickWeighted(fresh.length ? fresh : pool, (w) => mix[w.difficulty] ?? 1, rng);
  return choice!;
}

export interface TimeModifiers {
  chase: boolean; // "active chase modifier": less time while being hunted
  depth: number; // rooms cleared; deeper = slightly less time
}

/** Milliseconds allowed for a word, derived from WORD_BANK.time_limit. */
export function timeLimitMs(word: WordBankRow, mod: TimeModifiers): number {
  const chase = mod.chase ? 0.8 : 1;
  const depth = Math.max(0.75, 1 - mod.depth * 0.03);
  return Math.round(word.time_limit * 1000 * chase * depth);
}
