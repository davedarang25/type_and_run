// Supabase / PostgreSQL backend. Reads go through RLS-protected selects;
// writes go through the security-definer RPCs in 001_schema.sql.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GhostRequiredItemRow,
  GhostTypeRow,
  HauntedPlaceRow,
  ItemQuantities,
  ItemRow,
  PlaceContent,
  PlaceItemSpawnRow,
  UserInventoryRow,
  UserPlaceProgressRow,
  UserRow,
  WordBankRow,
} from '../types/db.ts';
import type { GameRepository, PlaceCard, SessionResultInput } from './types.ts';

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Postgres numerics arrive as strings; normalise progress rows. */
const toProgress = (r: UserPlaceProgressRow): UserPlaceProgressRow => ({
  ...r,
  best_wpm: r.best_wpm === null ? null : Number(r.best_wpm),
  best_accuracy: r.best_accuracy === null ? null : Number(r.best_accuracy),
});

export class SupabaseRepository implements GameRepository {
  readonly mode = 'supabase' as const;
  private wordCache: WordBankRow[] | null = null;
  private itemCache: ItemRow[] | null = null;

  constructor(private sb: SupabaseClient) {}

  async getPlayer() {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) return null;
    const row = must(await this.sb.from('users').select('*').eq('auth_id', auth.user.id).maybeSingle()) as UserRow | null;
    if (!row) return null;
    return { username: row.username, totalPlaytime: row.total_playtime, totalLocationsCompleted: row.total_locations_completed };
  }

  async listItems() {
    return (this.itemCache ??= must(await this.sb.from('items').select('*').order('item_id')) as ItemRow[]);
  }

  async getWordBank() {
    return (this.wordCache ??= must(await this.sb.from('word_bank').select('*')) as WordBankRow[]);
  }

  async getPlaceContent(placeId: number): Promise<PlaceContent> {
    const [place, placeGhosts, spawns, items] = await Promise.all([
      this.sb.from('haunted_places').select('*').eq('place_id', placeId).single().then(must<HauntedPlaceRow>),
      this.sb
        .from('place_ghosts')
        .select('spawn_chance, is_boss, ghost_type(*)')
        .eq('place_id', placeId)
        .then((r) => must(r) as unknown as { spawn_chance: number; is_boss: boolean; ghost_type: GhostTypeRow }[]),
      this.sb.from('place_item_spawns').select('*').eq('place_id', placeId).then((r) => must(r) as PlaceItemSpawnRow[]),
      this.listItems(),
    ]);
    const ghosts = placeGhosts.map((pg) => ({ ...pg.ghost_type, spawn_chance: pg.spawn_chance, is_boss: pg.is_boss }));
    const requirements = ghosts.length
      ? (must(
          await this.sb.from('ghost_required_items').select('*').in('ghost_id', ghosts.map((g) => g.ghost_id)),
        ) as GhostRequiredItemRow[])
      : [];
    return { place, ghosts, spawns, items, requirements };
  }

  async listPlaces(): Promise<PlaceCard[]> {
    const [places, progress] = await Promise.all([
      this.sb.from('haunted_places').select('*').order('place_id').then((r) => must(r) as HauntedPlaceRow[]),
      this.sb.from('user_place_progress').select('*').then((r) => must(r) as UserPlaceProgressRow[]),
    ]);
    const byPlace = new Map(progress.map((p) => [p.place_id, toProgress(p)]));
    return places.map((place) => {
      const p = byPlace.get(place.place_id) ?? null;
      return { place, progress: p, unlocked: place.is_unlocked || p !== null };
    });
  }

  async getInventory(): Promise<ItemQuantities> {
    const rows = must(await this.sb.from('user_inventory').select('item_id, quantity')) as Pick<UserInventoryRow, 'item_id' | 'quantity'>[];
    return Object.fromEntries(rows.filter((r) => r.quantity > 0).map((r) => [r.item_id, r.quantity]));
  }

  async startPlaceSession(placeId: number) {
    return toProgress(must(await this.sb.rpc('start_place_session', { p_place_id: placeId })) as UserPlaceProgressRow);
  }

  async saveSessionResults(input: SessionResultInput) {
    const collected = Object.entries(input.collected).map(([item_id, quantity]) => ({ item_id: Number(item_id), quantity }));
    const row = must(
      await this.sb.rpc('save_session_results', {
        p_place_id: input.placeId,
        p_outcome: input.outcome,
        p_wpm: input.wpm,
        p_accuracy: input.accuracy,
        p_playtime_seconds: Math.round(input.playtimeSeconds),
        p_collected: collected,
      }),
    ) as UserPlaceProgressRow;
    return toProgress(row);
  }
}
