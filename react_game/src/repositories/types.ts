import type {
  HauntedPlaceRow,
  ItemQuantities,
  ItemRow,
  PlaceContent,
  UserPlaceProgressRow,
  WordBankRow,
} from '../types/db.ts';

export type SessionOutcome = 'extracted' | 'exorcised' | 'caught';

export interface PlaceCard {
  place: HauntedPlaceRow;
  progress: UserPlaceProgressRow | null;
  unlocked: boolean;
}

export interface PlayerSummary {
  username: string;
  totalPlaytime: number;
  totalLocationsCompleted: number;
}

export interface SessionResultInput {
  placeId: number;
  outcome: SessionOutcome;
  wpm: number;
  accuracy: number;
  playtimeSeconds: number;
  /** Items found this session; banked unless the player was caught. */
  collected: ItemQuantities;
}

/** Read-only game content (WORD_BANK, places, ghosts, items, junction tables). */
export interface ContentRepository {
  listItems(): Promise<ItemRow[]>;
  getWordBank(): Promise<WordBankRow[]>;
  getPlaceContent(placeId: number): Promise<PlaceContent>;
}

/** USER_PLACE_PROGRESS. */
export interface ProgressRepository {
  listPlaces(): Promise<PlaceCard[]>;
  /** Marks the place in_progress (flowchart: "Initialize USER_PLACE_PROGRESS"). */
  startPlaceSession(placeId: number): Promise<UserPlaceProgressRow>;
  /**
   * Flowchart "Save Results". Atomically updates USER_PLACE_PROGRESS (status, flags,
   * best_wpm, best_accuracy), banks/consumes USER_INVENTORY and updates USERS totals.
   */
  saveSessionResults(input: SessionResultInput): Promise<UserPlaceProgressRow>;
}

/** USER_INVENTORY (writes happen inside saveSessionResults so they stay atomic). */
export interface InventoryRepository {
  getInventory(): Promise<ItemQuantities>;
}

export interface GameRepository extends ContentRepository, ProgressRepository, InventoryRepository {
  readonly mode: 'supabase' | 'local';
  getPlayer(): Promise<PlayerSummary | null>;
}
