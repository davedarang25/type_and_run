// Persistence rules shared by LocalRepository. Mirrors save_session_results() in SQL
// so offline mode behaves exactly like the Supabase backend.
import type { HauntedPlaceRow, ItemQuantities, PlaceContent, PlaceItemSpawnRow, UserPlaceProgressRow } from '../types/db.ts';
import { addQuantities, checkRequirements, requiredItems, subtractQuantities } from '../engine/ritual.ts';
import type { SessionResultInput } from './types.ts';

export interface SaveState {
  inventory: ItemQuantities;
  progress: Record<number, UserPlaceProgressRow>;
  totalPlaytime: number;
  totalLocationsCompleted: number;
}

/** Caps collected quantities at what the place can actually spawn. */
export function capCollected(collected: ItemQuantities, spawns: PlaceItemSpawnRow[]): ItemQuantities {
  const caps: ItemQuantities = {};
  for (const s of spawns) caps[s.item_id] = (caps[s.item_id] ?? 0) + s.quantity_available;
  const out: ItemQuantities = {};
  for (const [id, q] of Object.entries(collected)) {
    const n = Math.min(q, caps[Number(id)] ?? 0);
    if (n > 0) out[Number(id)] = n;
  }
  return out;
}

export function applySessionResult(
  state: SaveState,
  input: SessionResultInput,
  content: PlaceContent,
  places: HauntedPlaceRow[],
  newProgressId: () => number,
): SaveState {
  if (input.wpm < 0 || input.wpm > 400 || input.accuracy < 0 || input.accuracy > 100) {
    throw new Error('Metrics out of range');
  }
  const next: SaveState = {
    ...state,
    progress: { ...state.progress },
    totalPlaytime: state.totalPlaytime + Math.max(0, Math.round(input.playtimeSeconds)),
  };
  const existing = next.progress[input.placeId] ?? blankProgress(newProgressId(), input.placeId, 'in_progress');
  next.progress[input.placeId] = existing;
  if (input.outcome === 'caught') return next;

  let inventory = addQuantities(state.inventory, capCollected(input.collected, content.spawns));
  if (input.outcome === 'exorcised') {
    const req = requiredItems(content);
    if (!checkRequirements(req, inventory).met) throw new Error('Ritual requirements not met');
    inventory = subtractQuantities(inventory, req);
  }
  next.inventory = inventory;

  const firstClear = !existing.exploration_completed;
  next.progress[input.placeId] = {
    ...existing,
    status: 'cleared',
    exploration_completed: true,
    ritual_completed: existing.ritual_completed || input.outcome === 'exorcised',
    best_wpm: Math.max(existing.best_wpm ?? 0, input.wpm),
    best_accuracy: Math.max(existing.best_accuracy ?? 0, input.accuracy),
  };

  if (firstClear) {
    next.totalLocationsCompleted += 1;
    const following = places.filter((p) => p.place_id > input.placeId).sort((a, b) => a.place_id - b.place_id)[0];
    if (following && !next.progress[following.place_id]) {
      next.progress[following.place_id] = blankProgress(newProgressId(), following.place_id, 'unlocked');
    }
  }
  return next;
}

export const blankProgress = (
  progress_id: number,
  place_id: number,
  status: UserPlaceProgressRow['status'],
): UserPlaceProgressRow => ({
  progress_id,
  user_id: 1,
  place_id,
  status,
  exploration_completed: false,
  ritual_completed: false,
  best_wpm: null,
  best_accuracy: null,
});
