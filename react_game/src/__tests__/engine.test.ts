import { describe, expect, it } from 'vitest';
import { accuracy, applyKey, emptyStats, wpm } from '../engine/typing.ts';
import { pickWord, timeLimitMs } from '../engine/wordGenerator.ts';
import { CAUGHT_AT, encounterChance, lurkingGhost, penaltyAdvance, startChase } from '../engine/ghostAI.ts';
import { checkRequirements, requiredItems, rollItemFind, initSpawns, subtractQuantities } from '../engine/ritual.ts';
import { seededRng } from '../engine/rng.ts';
import { buildPlaceContent } from '../repositories/localRepository.ts';
import { WORD_BANK } from '../data/seed.ts';

describe('typing engine', () => {
  it('accepts correct prefixes and completes', () => {
    let b = '';
    for (const k of 'wal') {
      const r = applyKey(b, ['walk'], k);
      expect(r.result.kind).toBe('progress');
      b = r.buffer;
    }
    expect(applyKey(b, ['walk'], 'k')).toEqual({ buffer: '', result: { kind: 'complete', option: 'walk' } });
  });
  it('rejects typos without changing the buffer (stop-on-error)', () => {
    expect(applyKey('wa', ['walk'], 'x')).toEqual({ buffer: 'wa', result: { kind: 'typo' } });
  });
  it('matches any of several choice options, case-insensitively', () => {
    const r = applyKey('', ['deeper', 'wrap up'], 'W');
    expect(r.buffer).toBe('w');
    expect(applyKey('wrap', ['deeper', 'wrap up'], ' ').buffer).toBe('wrap ');
  });
  it('computes WPM and accuracy', () => {
    const s = { ...emptyStats(), correctKeystrokes: 100, totalKeystrokes: 110, activeMs: 30_000 };
    expect(wpm(s)).toBe(40);
    expect(accuracy(s)).toBeCloseTo(90.91, 2);
    expect(accuracy(emptyStats())).toBe(100);
  });
});

describe('word generator', () => {
  it('filters by action type and place difficulty', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 50; i++) {
      const w = pickWord(WORD_BANK, 'hide', 'easy', rng);
      expect(w.action_type).toBe('hide');
      expect(w.difficulty).toBe('easy');
    }
    const hard = new Set(Array.from({ length: 80 }, () => pickWord(WORD_BANK, 'movement', 'hard', rng).difficulty));
    expect(hard.has('easy')).toBe(false);
  });
  it('avoids recently used words', () => {
    const rng = seededRng(2);
    const easyMoves = WORD_BANK.filter((w) => w.action_type === 'movement' && w.difficulty === 'easy').map((w) => w.word);
    const recent = easyMoves.slice(1);
    expect(pickWord(WORD_BANK, 'movement', 'easy', rng, recent).word).toBe(easyMoves[0]);
  });
  it('shortens time limits during chases', () => {
    const w = WORD_BANK[0];
    expect(timeLimitMs(w, { chase: true, depth: 0 })).toBeLessThan(timeLimitMs(w, { chase: false, depth: 0 }));
  });
});

describe('ghost AI', () => {
  const sunken = buildPlaceContent(4);
  const boss = sunken.ghosts.find((g) => g.is_boss)!;
  it('punishes timeouts more than typos, and more during a chase', () => {
    expect(penaltyAdvance(boss, 'timeout', false)).toBeGreaterThan(penaltyAdvance(boss, 'typo', false));
    expect(penaltyAdvance(boss, 'typo', true)).toBeGreaterThan(penaltyAdvance(boss, 'typo', false));
  });
  it('raises encounter odds with depth and proximity; grace blocks encounters', () => {
    const g = sunken.ghosts[1];
    const base = encounterChance(g, { depth: 0, proximity: 0, graceSteps: 0 });
    expect(encounterChance(g, { depth: 4, proximity: 0, graceSteps: 0 })).toBeGreaterThan(base);
    expect(encounterChance(g, { depth: 0, proximity: 80, graceSteps: 0 })).toBeGreaterThan(base);
    expect(encounterChance(g, { depth: 4, proximity: 80, graceSteps: 1 })).toBe(0);
  });
  it('bosses lurk deeper', () => {
    expect(encounterChance(boss, { depth: 0, proximity: 0, graceSteps: 0 }))
      .toBeLessThan(encounterChance(boss, { depth: 1, proximity: 0, graceSteps: 0 }));
  });
  it('a lunge at high proximity catches the player', () => {
    expect(startChase(boss, 90).caught).toBe(true);
    const r = startChase(boss, 0);
    expect(r.caught).toBe(false);
    expect(r.proximity).toBeLessThan(CAUGHT_AT);
    expect(r.chase.escapesNeeded).toBeGreaterThanOrEqual(4);
  });
  it('lurking ghost is the biggest threat', () => {
    expect(lurkingGhost(sunken.ghosts)?.ghost_name).toBe('Manananggal');
  });
});

describe('inventory & ritual', () => {
  it('requires the boss items only', () => {
    expect(requiredItems(buildPlaceContent(1))).toEqual({ 4: 2 }); // Shadow Figure: 2 candles
    expect(requiredItems(buildPlaceContent(4))).toEqual({ 1: 3, 5: 1, 2: 1 });
  });
  it('reports what is missing', () => {
    const r = checkRequirements({ 4: 2 }, { 4: 1 });
    expect(r.met).toBe(false);
    expect(r.missing).toEqual([{ item_id: 4, needed: 2, have: 1 }]);
    expect(checkRequirements({ 4: 2 }, { 4: 3 }).met).toBe(true);
  });
  it('subtracts and drops empty stacks', () => {
    expect(subtractQuantities({ 1: 2, 4: 2 }, { 4: 2 })).toEqual({ 1: 2 });
  });
  it('never finds items from exhausted spawns', () => {
    const spawns = initSpawns(buildPlaceContent(1).spawns).map((s) => ({ ...s, remaining: 0 }));
    expect(rollItemFind(spawns, () => 0)).toBeNull();
  });
});

describe('seed content', () => {
  it('every location spawns enough items for its own ritual', async () => {
    const { HAUNTED_PLACES } = await import('../data/seed.ts');
    for (const p of HAUNTED_PLACES) {
      const c = buildPlaceContent(p.place_id);
      const totals: Record<number, number> = {};
      for (const s of c.spawns) totals[s.item_id] = (totals[s.item_id] ?? 0) + s.quantity_available;
      expect(checkRequirements(requiredItems(c), totals).met, p.place_name).toBe(true);
    }
  });
});
