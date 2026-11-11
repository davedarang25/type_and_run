// Row types mirroring supabase/migrations/001_schema.sql (one interface per table).

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ActionType = 'movement' | 'hide' | 'interact' | 'exorcise';
export type GhostBehavior = 'stalker' | 'aggressive' | 'patrol';
export type Hostility = 'low' | 'medium' | 'high' | 'extreme';
export type ItemType = 'ritual_salt' | 'relic' | 'candle' | 'talisman';
export type ProgressStatus = 'unlocked' | 'in_progress' | 'cleared';

export interface UserRow {
  user_id: number;
  auth_id?: string | null;
  username: string;
  email: string;
  password?: string | null;
  created_at: string;
  total_playtime: number;
  total_locations_completed: number;
}

export interface WordBankRow {
  word_id: number;
  word: string;
  action_type: ActionType;
  difficulty: Difficulty;
  time_limit: number;
}

export interface GhostTypeRow {
  ghost_id: number;
  ghost_name: string;
  description: string;
  behavior: GhostBehavior;
  hostility: Hostility;
  movement_speed: number;
  weakness: string;
}

export interface HauntedPlaceRow {
  place_id: number;
  place_name: string;
  description: string;
  difficulty: Difficulty;
  atmosphere: string;
  is_unlocked: boolean;
}

export interface ItemRow {
  item_id: number;
  item_name: string;
  description: string;
  item_type: ItemType;
}

export interface PlaceGhostRow {
  place_ghost_id: number;
  place_id: number;
  ghost_id: number;
  spawn_chance: number;
  is_boss: boolean;
}

export interface GhostRequiredItemRow {
  requirement_id: number;
  ghost_id: number;
  item_id: number;
  quantity_required: number;
}

export interface PlaceItemSpawnRow {
  spawn_id: number;
  place_id: number;
  item_id: number;
  spawn_location: string;
  quantity_available: number;
}

export interface UserPlaceProgressRow {
  progress_id: number;
  user_id: number;
  place_id: number;
  status: ProgressStatus;
  exploration_completed: boolean;
  ritual_completed: boolean;
  best_wpm: number | null;
  best_accuracy: number | null;
}

export interface UserInventoryRow {
  inventory_id: number;
  user_id: number;
  item_id: number;
  quantity: number;
}

// ---- Composite view models used by the game engine ----

/** A ghost as it appears in one specific location. */
export interface PlaceGhost extends GhostTypeRow {
  spawn_chance: number;
  is_boss: boolean;
}

/** Everything the engine needs to run one location. */
export interface PlaceContent {
  place: HauntedPlaceRow;
  ghosts: PlaceGhost[];
  spawns: PlaceItemSpawnRow[];
  items: ItemRow[];
  requirements: GhostRequiredItemRow[];
}

export type ItemQuantities = Record<number, number>; // item_id -> quantity
