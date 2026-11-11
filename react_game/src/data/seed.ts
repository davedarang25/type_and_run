// Single source of truth for game content.
// - LocalRepository (offline mode) reads it directly.
// - scripts/gen-seed-sql.ts turns it into supabase/seed.sql.
import type {
  ActionType,
  Difficulty,
  GhostRequiredItemRow,
  GhostTypeRow,
  HauntedPlaceRow,
  ItemRow,
  PlaceGhostRow,
  PlaceItemSpawnRow,
  WordBankRow,
} from '../types/db.ts';

// ---------------------------------------------------------------- WORD_BANK
const WORDS: Record<ActionType, Record<Difficulty, string[]>> = {
  movement: {
    easy: ['walk', 'step', 'creep', 'enter', 'climb', 'turn', 'crawl', 'sneak', 'go on', 'look'],
    medium: ['tiptoe', 'proceed', 'advance', 'descend', 'shuffle', 'traverse', 'open door', 'go upstairs', 'follow it', 'shine light'],
    hard: ['investigate', 'check the stairwell', 'follow the footsteps', 'push through cobwebs', 'squeeze past debris', 'inch forward slowly', 'record the hallway'],
  },
  hide: {
    easy: ['hide', 'duck', 'run', 'flee', 'dash', 'bolt', 'dive', 'freeze'],
    medium: ['crouch low', 'hold breath', 'sprint', 'scramble', 'slam door', 'kill flashlight', 'back away'],
    hard: ['squeeze into the locker', 'stay perfectly still', 'barricade the door', 'climb out the window', 'crawl under the bed'],
  },
  interact: {
    easy: ['grab', 'take', 'pick up', 'snag', 'open'],
    medium: ['pocket it', 'pry open', 'unlatch', 'inspect', 'retrieve'],
    hard: ['carefully retrieve it', 'lift the floorboard', 'pry the drawer open', 'unwrap the cloth'],
  },
  exorcise: {
    easy: ['begone', 'depart', 'rest now', 'be still', 'go away'],
    medium: ['return to dust', 'by candlelight', 'release your grip', 'salt binds you', 'you are not welcome'],
    hard: ['i cast you out of this place', 'by salt and flame be gone', 'your name holds no power here', 'return to the darkness'],
  },
};

/** Seconds to type a command: roughly 36 WPM plus a 2 s reaction buffer. */
export const timeLimitFor = (word: string) => Math.max(3, Math.ceil(word.length / 3) + 2);

export const WORD_BANK: WordBankRow[] = (() => {
  const rows: WordBankRow[] = [];
  let id = 1;
  for (const action of Object.keys(WORDS) as ActionType[]) {
    for (const difficulty of Object.keys(WORDS[action]) as Difficulty[]) {
      for (const word of WORDS[action][difficulty]) {
        rows.push({ word_id: id++, word, action_type: action, difficulty, time_limit: timeLimitFor(word) });
      }
    }
  }
  return rows;
})();

// --------------------------------------------------------------- GHOST_TYPE
export const GHOST_TYPES: GhostTypeRow[] = [
  {
    ghost_id: 1, ghost_name: 'Shadow Figure', behavior: 'stalker', hostility: 'low', movement_speed: 3,
    description: 'A man-shaped absence at the edge of your flashlight. It only moves when you are not looking.',
    weakness: 'Steady candlelight',
  },
  {
    ghost_id: 2, ghost_name: 'White Lady', behavior: 'patrol', hostility: 'medium', movement_speed: 4,
    description: 'A woman in a white gown who walks the same route every night, weeping.',
    weakness: 'A rosary and a lit candle',
  },
  {
    ghost_id: 3, ghost_name: 'Tiyanak', behavior: 'aggressive', hostility: 'high', movement_speed: 7,
    description: 'It cries like a lost infant to lure you close, then shows its teeth.',
    weakness: 'Salt scattered in a circle',
  },
  {
    ghost_id: 4, ghost_name: 'Kapre', behavior: 'patrol', hostility: 'low', movement_speed: 2,
    description: 'A giant smoking a cigar in the trees. Mostly curious — until you trespass.',
    weakness: 'An agimat amulet',
  },
  {
    ghost_id: 5, ghost_name: 'The Head Nurse', behavior: 'stalker', hostility: 'high', movement_speed: 6,
    description: 'Still doing her rounds decades after the ward closed. Her footsteps never stop.',
    weakness: 'Her own photograph, shown by candlelight',
  },
  {
    ghost_id: 6, ghost_name: 'Manananggal', behavior: 'aggressive', hostility: 'extreme', movement_speed: 8,
    description: 'The upper half hunts on leathery wings; the lower half waits somewhere below.',
    weakness: 'Salt, an agimat, and a blessed rosary',
  },
];

// ----------------------------------------------------------- HAUNTED_PLACES
export const HAUNTED_PLACES: HauntedPlaceRow[] = [
  {
    place_id: 1, place_name: 'Old Dormitory', difficulty: 'easy', atmosphere: 'flickering', is_unlocked: true,
    description: 'A shuttered student dorm. Viewers swear a figure stands behind you in every stream.',
  },
  {
    place_id: 2, place_name: 'Balete Road Mansion', difficulty: 'medium', atmosphere: 'misty', is_unlocked: false,
    description: 'A colonial-era house swallowed by balete trees. Drivers report a lady in white on the road.',
  },
  {
    place_id: 3, place_name: 'St. Agatha Hospital Ward', difficulty: 'medium', atmosphere: 'sterile', is_unlocked: false,
    description: 'Closed in 1974. The call bells in Ward C still ring at 3 a.m.',
  },
  {
    place_id: 4, place_name: 'Sunken Chapel', difficulty: 'hard', atmosphere: 'flooded', is_unlocked: false,
    description: 'Half underwater since the typhoon. Something with wings nests in the bell tower.',
  },
];

// -------------------------------------------------------------------- ITEMS
export const ITEMS: ItemRow[] = [
  { item_id: 1, item_name: 'Sea Salt Pouch', item_type: 'ritual_salt', description: 'Coarse salt in a cloth pouch. Ghosts cannot cross a line of it.' },
  { item_id: 2, item_name: 'Rosary', item_type: 'relic', description: 'Worn wooden beads, warm to the touch.' },
  { item_id: 3, item_name: 'Old Photograph', item_type: 'relic', description: 'A faded staff portrait. One face has been scratched out.' },
  { item_id: 4, item_name: 'Vigil Candle', item_type: 'candle', description: 'A tall white candle. The flame leans toward spirits.' },
  { item_id: 5, item_name: 'Agimat Amulet', item_type: 'talisman', description: 'A carved charm inscribed with old protective words.' },
];

// -------------------------------------------------------------- PLACE_GHOSTS
export const PLACE_GHOSTS: PlaceGhostRow[] = [
  { place_ghost_id: 1, place_id: 1, ghost_id: 1, spawn_chance: 20, is_boss: true },
  { place_ghost_id: 2, place_id: 1, ghost_id: 4, spawn_chance: 10, is_boss: false },
  { place_ghost_id: 3, place_id: 2, ghost_id: 2, spawn_chance: 25, is_boss: true },
  { place_ghost_id: 4, place_id: 2, ghost_id: 4, spawn_chance: 15, is_boss: false },
  { place_ghost_id: 5, place_id: 2, ghost_id: 1, spawn_chance: 15, is_boss: false },
  { place_ghost_id: 6, place_id: 3, ghost_id: 5, spawn_chance: 25, is_boss: true },
  { place_ghost_id: 7, place_id: 3, ghost_id: 3, spawn_chance: 20, is_boss: false },
  { place_ghost_id: 8, place_id: 3, ghost_id: 1, spawn_chance: 15, is_boss: false },
  { place_ghost_id: 9, place_id: 4, ghost_id: 6, spawn_chance: 30, is_boss: true },
  { place_ghost_id: 10, place_id: 4, ghost_id: 3, spawn_chance: 25, is_boss: false },
  { place_ghost_id: 11, place_id: 4, ghost_id: 2, spawn_chance: 15, is_boss: false },
];

// ------------------------------------------------------ GHOST_REQUIRED_ITEMS
export const GHOST_REQUIRED_ITEMS: GhostRequiredItemRow[] = [
  { requirement_id: 1, ghost_id: 1, item_id: 4, quantity_required: 2 },
  { requirement_id: 2, ghost_id: 2, item_id: 2, quantity_required: 1 },
  { requirement_id: 3, ghost_id: 2, item_id: 4, quantity_required: 1 },
  { requirement_id: 4, ghost_id: 3, item_id: 1, quantity_required: 2 },
  { requirement_id: 5, ghost_id: 4, item_id: 5, quantity_required: 1 },
  { requirement_id: 6, ghost_id: 5, item_id: 3, quantity_required: 1 },
  { requirement_id: 7, ghost_id: 5, item_id: 4, quantity_required: 2 },
  { requirement_id: 8, ghost_id: 6, item_id: 1, quantity_required: 3 },
  { requirement_id: 9, ghost_id: 6, item_id: 5, quantity_required: 1 },
  { requirement_id: 10, ghost_id: 6, item_id: 2, quantity_required: 1 },
];

// --------------------------------------------------------- PLACE_ITEM_SPAWNS
export const PLACE_ITEM_SPAWNS: PlaceItemSpawnRow[] = [
  { spawn_id: 1, place_id: 1, item_id: 4, spawn_location: 'study hall desk', quantity_available: 1 },
  { spawn_id: 2, place_id: 1, item_id: 4, spawn_location: 'laundry room shelf', quantity_available: 1 },
  { spawn_id: 3, place_id: 1, item_id: 1, spawn_location: 'kitchen pantry', quantity_available: 1 },
  { spawn_id: 4, place_id: 2, item_id: 2, spawn_location: 'master bedroom vanity', quantity_available: 1 },
  { spawn_id: 5, place_id: 2, item_id: 4, spawn_location: 'dining hall candelabra', quantity_available: 2 },
  { spawn_id: 6, place_id: 2, item_id: 5, spawn_location: 'garden well', quantity_available: 1 },
  { spawn_id: 7, place_id: 3, item_id: 3, spawn_location: 'records room cabinet', quantity_available: 1 },
  { spawn_id: 8, place_id: 3, item_id: 4, spawn_location: 'chapel corridor', quantity_available: 2 },
  { spawn_id: 9, place_id: 3, item_id: 1, spawn_location: 'morgue drawer', quantity_available: 2 },
  { spawn_id: 10, place_id: 4, item_id: 1, spawn_location: 'flooded nave', quantity_available: 2 },
  { spawn_id: 11, place_id: 4, item_id: 1, spawn_location: 'bell tower stairs', quantity_available: 1 },
  { spawn_id: 12, place_id: 4, item_id: 2, spawn_location: 'altar', quantity_available: 1 },
  { spawn_id: 13, place_id: 4, item_id: 5, spawn_location: 'crypt niche', quantity_available: 1 },
];
