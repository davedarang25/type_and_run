// Inventory & ritual rules. Pure. Mirrors ritualRequirements() in backend/services/gameRules.js.
import type { ItemQuantities, PlaceContent, PlaceGhost, PlaceItemSpawnRow } from '../types/db.ts';
import { pickWeighted, type Rng } from './rng.ts';

/** Ghosts the ritual must banish: the boss(es), or everyone if the place has no boss. */
export function ritualTargets(content: PlaceContent): PlaceGhost[] {
  const bosses = content.ghosts.filter((g) => g.is_boss);
  return bosses.length ? bosses : content.ghosts;
}

export function requiredItems(content: PlaceContent): ItemQuantities {
  const ids = new Set(ritualTargets(content).map((g) => g.ghost_id));
  const req: ItemQuantities = {};
  for (const r of content.requirements) {
    if (ids.has(r.ghost_id)) req[r.item_id] = (req[r.item_id] ?? 0) + r.quantity_required;
  }
  return req;
}

export interface MissingItem { item_id: number; needed: number; have: number }

/** "Requirements Met?" check against GHOST_REQUIRED_ITEMS. */
export function checkRequirements(required: ItemQuantities, owned: ItemQuantities) {
  const missing: MissingItem[] = [];
  for (const [id, needed] of Object.entries(required)) {
    const have = owned[Number(id)] ?? 0;
    if (have < needed) missing.push({ item_id: Number(id), needed, have });
  }
  return { met: missing.length === 0, missing };
}

export function addQuantities(a: ItemQuantities, b: ItemQuantities): ItemQuantities {
  const out: ItemQuantities = { ...a };
  for (const [id, q] of Object.entries(b)) out[Number(id)] = (out[Number(id)] ?? 0) + q;
  return out;
}

export function subtractQuantities(a: ItemQuantities, b: ItemQuantities): ItemQuantities {
  const out: ItemQuantities = { ...a };
  for (const [id, q] of Object.entries(b)) {
    const left = (out[Number(id)] ?? 0) - q;
    if (left > 0) out[Number(id)] = left;
    else delete out[Number(id)];
  }
  return out;
}

// ---- Item spawns during a session (PLACE_ITEM_SPAWNS) ----

export interface SpawnState extends PlaceItemSpawnRow { remaining: number }

export const initSpawns = (spawns: PlaceItemSpawnRow[]): SpawnState[] =>
  spawns.map((s) => ({ ...s, remaining: s.quantity_available }));

export const ITEM_FIND_CHANCE = 0.3;

/** "Found Ritual Item?" roll after a safe movement. */
export function rollItemFind(spawns: SpawnState[], rng: Rng, chance = ITEM_FIND_CHANCE): SpawnState | null {
  const left = spawns.filter((s) => s.remaining > 0);
  if (!left.length || rng() >= chance) return null;
  return pickWeighted(left, (s) => s.remaining, rng);
}

export const takeFromSpawn = (spawns: SpawnState[], spawnId: number): SpawnState[] =>
  spawns.map((s) => (s.spawn_id === spawnId ? { ...s, remaining: Math.max(0, s.remaining - 1) } : s));
