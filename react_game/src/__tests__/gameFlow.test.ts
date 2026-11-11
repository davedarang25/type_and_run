// Drives the full state machine through the flowchart using a scripted RNG and clock.
import { beforeEach, describe, expect, it } from 'vitest';
import { createGameStore, type GameStore } from '../store/gameEngine.ts';
import { LocalRepository } from '../repositories/localRepository.ts';

class MemStorage { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }

let clock = 0;
let rolls: number[] = [];
const rng = () => (rolls.length ? rolls.shift()! : 0.99); // 0.99 = "nothing happens"

function setup() {
  clock = 1_000_000;
  rolls = [];
  const repo = new LocalRepository(new MemStorage());
  const store = createGameStore({ repo, rng, now: () => clock });
  return { repo, store };
}

const type = (store: GameStore, text: string) => {
  for (const ch of text) { clock += 150; store.getState().pressKey(ch); }
};
const typePrompt = (store: GameStore) => type(store, store.getState().prompt!.options[0]);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('game flow', () => {
  let store: GameStore;
  let repo: LocalRepository;
  beforeEach(async () => {
    ({ store, repo } = setup());
    await store.getState().init();
  });

  it('starts at the menu with only the starter location unlocked', () => {
    const s = store.getState();
    expect(s.phase).toBe('menu');
    expect(s.places.filter((p) => p.unlocked).map((p) => p.place.place_id)).toEqual([1]);
  });

  it('safe exploration → decision → go home saves exploration_completed and unlocks the next place', async () => {
    await store.getState().selectPlace(1);
    expect(store.getState().phase).toBe('exploring');
    for (let i = 0; i < 3; i++) typePrompt(store); // one room, nothing spawns
    expect(store.getState().phase).toBe('decision');
    type(store, 'wrap up');
    expect(store.getState().phase).toBe('ritualPrompt');
    type(store, 'go home');
    await flush(); await flush();
    const s = store.getState();
    expect(s.phase).toBe('results');
    expect(s.result?.outcome).toBe('extracted');
    expect(s.result!.wpm).toBeGreaterThan(0);
    expect(s.result!.accuracy).toBe(100);
    const p1 = s.places.find((p) => p.place.place_id === 1)!;
    expect(p1.progress).toMatchObject({ status: 'cleared', exploration_completed: true, ritual_completed: false });
    expect(s.places.find((p) => p.place.place_id === 2)!.unlocked).toBe(true);
  });

  it('typos penalise time, accuracy and ghost proximity', async () => {
    await store.getState().selectPlace(1);
    const before = store.getState().prompt!.deadline!;
    store.getState().pressKey('#');
    const s = store.getState();
    expect(s.ghostProximity).toBeGreaterThan(0);
    expect(s.prompt!.deadline).toBeLessThan(before);
    expect(s.stats.totalKeystrokes).toBe(1);
    expect(s.stats.correctKeystrokes).toBe(0);
  });

  it('ritual without items → insufficient → keep looking returns to exploring', async () => {
    await store.getState().selectPlace(1);
    for (let i = 0; i < 3; i++) typePrompt(store);
    type(store, 'wrap up');
    type(store, 'ritual');
    expect(store.getState().phase).toBe('insufficient');
    expect(store.getState().missing).toEqual([{ item_id: 4, needed: 2, have: 0 }]);
    type(store, 'keep looking');
    expect(store.getState().phase).toBe('exploring');
    expect(store.getState().prompt!.kind).toBe('move');
  });

  it('collects items, performs the exorcism and consumes them', async () => {
    await store.getState().selectPlace(1);
    // Each move rolls 2 ghosts (encounter) then item chance + weighted pick.
    // Move 1: no ghosts, find item (0.0), pick first spawn (0.0 → study hall candle)
    rolls = [0.99, 0.99, 0.0, 0.0];
    typePrompt(store);
    expect(store.getState().prompt!.kind).toBe('pickup');
    typePrompt(store);
    rolls = [0.99, 0.99, 0.0, 0.0]; // move 2 → laundry room candle (first remaining)
    typePrompt(store);
    typePrompt(store);
    expect(store.getState().sessionInventory).toEqual({ 4: 2 });
    typePrompt(store); // move 3 → room done
    expect(store.getState().phase).toBe('decision');
    type(store, 'wrap up');
    type(store, 'ritual');
    expect(store.getState().phase).toBe('exorcism');
    for (let i = 0; i < 3; i++) typePrompt(store);
    await flush(); await flush();
    const s = store.getState();
    expect(s.result?.outcome).toBe('exorcised');
    expect(s.places[0].progress).toMatchObject({ ritual_completed: true, exploration_completed: true });
    expect(s.userInventory).toEqual({}); // both candles consumed
  });

  it('ghost encounter starts a chase; escaping enough times ends it', async () => {
    await store.getState().selectPlace(1);
    rolls = [0.99, 0.0]; // second ghost (Kapre, non-boss) finds you
    typePrompt(store);
    let s = store.getState();
    expect(s.chase).not.toBeNull();
    expect(s.prompt!.kind).toBe('escape');
    expect(s.prompt!.actionType).toBe('hide');
    for (let i = 0; i < s.chase!.escapesNeeded; i++) typePrompt(store);
    s = store.getState();
    expect(s.chase).toBeNull();
    expect(s.chasesSurvived).toBe(1);
    expect(s.graceSteps).toBeGreaterThan(0);
  });

  it('timeouts during a chase eventually get you caught → game over, items lost', async () => {
    await store.getState().selectPlace(1);
    rolls = [0.99, 0.0];
    typePrompt(store);
    expect(store.getState().chase).not.toBeNull();
    for (let i = 0; i < 40 && store.getState().phase === 'exploring'; i++) {
      clock = store.getState().prompt!.deadline! + 1;
      store.getState().tick();
    }
    await flush(); await flush();
    const s = store.getState();
    expect(s.phase).toBe('gameover');
    expect(s.result?.outcome).toBe('caught');
    expect(s.result?.caughtBy).toBe('Kapre');
    expect(s.places[0].progress?.exploration_completed).toBe(false);
    expect(await repo.getInventory()).toEqual({});
  });

  it('retry from results restarts the same place', async () => {
    await store.getState().selectPlace(1);
    for (let i = 0; i < 3; i++) typePrompt(store);
    type(store, 'wrap up');
    type(store, 'go home');
    await flush(); await flush();
    type(store, 'retry');
    await flush(); await flush();
    expect(store.getState().phase).toBe('exploring');
    expect(store.getState().content?.place.place_id).toBe(1);
    expect(store.getState().playerDistance).toBe(0);
  });
});
