// Offline backend: bundled seed content + progress saved in localStorage
// (falls back to memory where storage is blocked, e.g. sandboxed iframes).
import * as SEED from '../data/seed.ts';
import type { PlaceContent, UserPlaceProgressRow } from '../types/db.ts';
import { applySessionResult, blankProgress, type SaveState } from './rules.ts';
import type { GameRepository, PlaceCard, SessionResultInput } from './types.ts';

const KEY = 'type-to-run:save:v1';

const emptySave = (): SaveState => ({ inventory: {}, progress: {}, totalPlaytime: 0, totalLocationsCompleted: 0 });

export function buildPlaceContent(placeId: number): PlaceContent {
  const place = SEED.HAUNTED_PLACES.find((p) => p.place_id === placeId);
  if (!place) throw new Error(`Unknown place ${placeId}`);
  const ghosts = SEED.PLACE_GHOSTS.filter((pg) => pg.place_id === placeId).map((pg) => ({
    ...SEED.GHOST_TYPES.find((g) => g.ghost_id === pg.ghost_id)!,
    spawn_chance: pg.spawn_chance,
    is_boss: pg.is_boss,
  }));
  const ghostIds = new Set(ghosts.map((g) => g.ghost_id));
  return {
    place,
    ghosts,
    spawns: SEED.PLACE_ITEM_SPAWNS.filter((s) => s.place_id === placeId),
    items: SEED.ITEMS,
    requirements: SEED.GHOST_REQUIRED_ITEMS.filter((r) => ghostIds.has(r.ghost_id)),
  };
}

export class LocalRepository implements GameRepository {
  readonly mode = 'local' as const;
  private memory: SaveState | null = null;

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()) {}

  private load(): SaveState {
    if (this.memory) return this.memory;
    try {
      const raw = this.storage?.getItem(KEY);
      this.memory = raw ? { ...emptySave(), ...JSON.parse(raw) } : emptySave();
    } catch {
      this.memory = emptySave();
    }
    return this.memory!;
  }

  private save(state: SaveState) {
    this.memory = state;
    try {
      this.storage?.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: keep in memory */
    }
  }

  private nextProgressId = () => Math.max(0, ...Object.values(this.load().progress).map((p) => p.progress_id)) + 1;

  async getPlayer() {
    const s = this.load();
    return { username: 'Guest streamer', totalPlaytime: s.totalPlaytime, totalLocationsCompleted: s.totalLocationsCompleted };
  }
  async listItems() { return SEED.ITEMS; }
  async getWordBank() { return SEED.WORD_BANK; }
  async getPlaceContent(placeId: number) { return buildPlaceContent(placeId); }
  async getInventory() { return { ...this.load().inventory }; }

  async listPlaces(): Promise<PlaceCard[]> {
    const s = this.load();
    return SEED.HAUNTED_PLACES.map((place) => {
      const progress = s.progress[place.place_id] ?? null;
      return { place, progress, unlocked: place.is_unlocked || progress !== null };
    });
  }

  async startPlaceSession(placeId: number): Promise<UserPlaceProgressRow> {
    const s = this.load();
    const place = SEED.HAUNTED_PLACES.find((p) => p.place_id === placeId);
    const existing = s.progress[placeId];
    if (!place || (!place.is_unlocked && !existing)) throw new Error(`Location ${placeId} is locked`);
    const row: UserPlaceProgressRow = existing
      ? { ...existing, status: existing.status === 'cleared' ? 'cleared' : 'in_progress' }
      : blankProgress(this.nextProgressId(), placeId, 'in_progress');
    this.save({ ...s, progress: { ...s.progress, [placeId]: row } });
    return row;
  }

  async saveSessionResults(input: SessionResultInput): Promise<UserPlaceProgressRow> {
    const next = applySessionResult(this.load(), input, buildPlaceContent(input.placeId), SEED.HAUNTED_PLACES, this.nextProgressId);
    this.save(next);
    return next.progress[input.placeId];
  }

  /** Dev helper: wipe offline progress. */
  reset() { this.save(emptySave()); }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
