// Central GameEngineState — a Zustand store implementing the spec's state machine:
//
//   menu → loading → exploring ⇄ (chase) → decision → ritualPrompt → exorcism → results
//                         │                                  └→ insufficient → exploring
//                         └──────────────── caught ───────────────────────────→ gameover
//
// All randomness and time come from injected deps, so the whole loop is testable.
import { createStore } from 'zustand/vanilla';
import type { ActionType, ItemQuantities, ItemRow, PlaceContent, PlaceGhost, UserPlaceProgressRow, WordBankRow } from '../types/db.ts';
import type { GameRepository, PlaceCard, PlayerSummary, SessionOutcome } from '../repositories/types.ts';
import { accuracy, applyKey, emptyStats, wpm, type TypingStats } from '../engine/typing.ts';
import { pickWord, timeLimitMs } from '../engine/wordGenerator.ts';
import {
  ESCAPE_RELIEF,
  GRACE_STEPS_AFTER_ESCAPE,
  MOVE_RELIEF,
  STEPS_PER_ROOM,
  clampMeter,
  isCaught,
  lurkingGhost,
  penaltyAdvance,
  rollEncounter,
  startChase,
  type ChaseState,
  type PenaltyKind,
} from '../engine/ghostAI.ts';
import {
  addQuantities,
  checkRequirements,
  initSpawns,
  requiredItems,
  ritualTargets,
  rollItemFind,
  takeFromSpawn,
  type MissingItem,
  type SpawnState,
} from '../engine/ritual.ts';
import type { Rng } from '../engine/rng.ts';

export type Phase =
  | 'boot' | 'auth' | 'menu' | 'loading'
  | 'exploring' | 'decision' | 'ritualPrompt' | 'insufficient' | 'exorcism'
  | 'saving' | 'results' | 'gameover';

export type PromptKind = 'move' | 'escape' | 'pickup' | 'exorcise' | 'choice';
export type ChoiceAction = 'deeper' | 'wrapUp' | 'ritual' | 'goHome' | 'keepLooking' | 'menu' | 'retry';

export interface Choice { word: string; label: string; action: ChoiceAction }

export interface Prompt {
  kind: PromptKind;
  options: string[];
  choices?: Choice[];
  actionType?: ActionType;
  shownAt: number;
  deadline: number | null; // null = untimed (choices)
  timeLimitMs: number | null;
}

export interface LogEntry { id: number; tone: 'info' | 'good' | 'bad' | 'ghost'; text: string }

export interface SessionResult {
  outcome: SessionOutcome;
  placeName: string;
  wpm: number;
  accuracy: number;
  roomsExplored: number;
  stepsTaken: number;
  itemsFound: ItemQuantities;
  chasesSurvived: number;
  durationSec: number;
  caughtBy?: string;
  previousBest: { wpm: number | null; accuracy: number | null };
  progress: UserPlaceProgressRow | null;
  saveError?: string;
}

export interface GameEngineState {
  phase: Phase;
  error: string | null;
  // catalog
  player: PlayerSummary | null;
  places: PlaceCard[];
  items: ItemRow[];
  wordBank: WordBankRow[];
  userInventory: ItemQuantities;
  // active session
  content: PlaceContent | null;
  prompt: Prompt | null;
  buffer: string;
  typoAt: number; // timestamp of last typo, drives the red flash
  playerDistance: number; // successful moves
  room: number; // rooms cleared (depth)
  stepInRoom: number;
  ghostProximity: number; // 0 safe … 100 caught
  chase: ChaseState | null;
  graceSteps: number;
  chasesSurvived: number;
  sessionInventory: ItemQuantities;
  spawns: SpawnState[];
  pendingFind: SpawnState | null;
  exorcism: { done: number; needed: number } | null;
  missing: MissingItem[];
  stats: TypingStats;
  recentWords: string[];
  log: LogEntry[];
  sessionStartedAt: number;
  result: SessionResult | null;
  // actions
  init(): Promise<void>;
  selectPlace(placeId: number): Promise<void>;
  pressKey(key: string): void;
  choose(action: ChoiceAction): void;
  tick(): void;
  backToMenu(): void;
}

export interface EngineDeps {
  repo: GameRepository;
  rng?: Rng;
  now?: () => number;
}

export const TYPO_TIME_PENALTY_MS = 600;
export const EXORCISM_LENGTH = { easy: 3, medium: 4, hard: 5 } as const;
const LOG_SIZE = 6;
const TIMED_PHASES: Phase[] = ['exploring', 'exorcism'];
const CHOICE_PHASES: Phase[] = ['decision', 'ritualPrompt', 'insufficient', 'results', 'gameover'];

const C = {
  deeper: { word: 'deeper', label: 'Go deeper', action: 'deeper' },
  wrapUp: { word: 'wrap up', label: 'Finish exploring', action: 'wrapUp' },
  ritual: { word: 'ritual', label: 'Perform the ritual', action: 'ritual' },
  goHome: { word: 'go home', label: 'Save results & leave', action: 'goHome' },
  keepLooking: { word: 'keep looking', label: 'Search for more items', action: 'keepLooking' },
  retry: { word: 'retry', label: 'Stream this place again', action: 'retry' },
  menu: { word: 'menu', label: 'Back to locations', action: 'menu' },
} satisfies Record<string, Choice>;

const sessionDefaults = () => ({
  content: null,
  prompt: null,
  buffer: '',
  typoAt: 0,
  playerDistance: 0,
  room: 0,
  stepInRoom: 0,
  ghostProximity: 0,
  chase: null,
  graceSteps: 0,
  chasesSurvived: 0,
  sessionInventory: {},
  spawns: [],
  pendingFind: null,
  exorcism: null,
  missing: [],
  stats: emptyStats(),
  recentWords: [],
  log: [],
  sessionStartedAt: 0,
  result: null,
});

export function createGameStore({ repo, rng = Math.random, now = () => Date.now() }: EngineDeps) {
  let logId = 0;

  return createStore<GameEngineState>()((set, get) => {
    // ------------------------------------------------------------ helpers
    const log = (text: string, tone: LogEntry['tone'] = 'info') =>
      set((s) => ({ log: [{ id: ++logId, text, tone }, ...s.log].slice(0, LOG_SIZE) }));

    const ghostById = (id: number) => get().content?.ghosts.find((g) => g.ghost_id === id) ?? null;

    /** "Nearest ghost": whoever is chasing you, the boss during a rite, else the lurker. */
    const currentThreat = (): PlaceGhost | null => {
      const s = get();
      if (!s.content) return null;
      if (s.chase) return ghostById(s.chase.ghostId);
      if (s.phase === 'exorcism') return ritualTargets(s.content)[0] ?? null;
      return lurkingGhost(s.content.ghosts);
    };

    /** Generate Typing Command from WORD_BANK. */
    const wordPrompt = (kind: Exclude<PromptKind, 'choice'>, action: ActionType) => {
      const s = get();
      const word = pickWord(s.wordBank, action, s.content!.place.difficulty, rng, s.recentWords);
      const limit = timeLimitMs(word, { chase: kind === 'escape' || kind === 'exorcise', depth: s.room });
      const t = now();
      set({
        prompt: { kind, options: [word.word], actionType: action, shownAt: t, deadline: t + limit, timeLimitMs: limit },
        buffer: '',
        recentWords: [word.word, ...s.recentWords].slice(0, 8),
      });
    };

    const choicePrompt = (phase: Phase, choices: Choice[]) =>
      set({ phase, buffer: '', prompt: { kind: 'choice', options: choices.map((c) => c.word), choices, shownAt: now(), deadline: null, timeLimitMs: null } });

    /** Typing Penalty → Ghost Gets Closer → Caught? */
    const ghostGetsCloser = (kind: PenaltyKind): boolean => {
      const s = get();
      const ghost = currentThreat();
      const advance = penaltyAdvance(ghost, kind, !!s.chase || s.phase === 'exorcism');
      const proximity = clampMeter(s.ghostProximity + advance);
      set({ ghostProximity: proximity });
      if (isCaught(proximity)) {
        void finish('caught', ghost?.ghost_name ?? 'something in the dark');
        return true;
      }
      return false;
    };

    /** After a step resolves: either the room is done (Continue Exploring?) or keep moving. */
    const afterStep = () => {
      const s = get();
      if (s.stepInRoom >= STEPS_PER_ROOM) {
        const room = s.room + 1;
        set({ room, stepInRoom: 0 });
        log(`Room ${room} explored. It's quieter here… for now.`, 'good');
        choicePrompt('decision', [C.deeper, C.wrapUp]);
      } else {
        set({ phase: 'exploring' });
        wordPrompt('move', 'movement');
      }
    };

    // -------------------------------------------------------- transitions
    const onMove = () => {
      const s = get();
      const content = s.content!;
      const proximity = clampMeter(s.ghostProximity - MOVE_RELIEF);
      set({
        playerDistance: s.playerDistance + 1,
        stepInRoom: s.stepInRoom + 1,
        ghostProximity: proximity,
        graceSteps: Math.max(0, s.graceSteps - 1),
      });

      // Ghost Encounter?
      const ghost = rollEncounter(content.ghosts, { depth: s.room, proximity, graceSteps: s.graceSteps }, rng);
      if (ghost) {
        const r = startChase(ghost, proximity);
        set({ ghostProximity: r.proximity, chase: r.chase });
        log(`${ghost.ghost_name.toUpperCase()} HAS SEEN YOU. RUN.`, 'ghost');
        if (r.caught) return void finish('caught', ghost.ghost_name);
        return wordPrompt('escape', 'hide');
      }

      // Found Ritual Item?
      const find = rollItemFind(get().spawns, rng);
      if (find) {
        const item = content.items.find((i) => i.item_id === find.item_id);
        set({ pendingFind: find });
        log(`Your camera catches something near the ${find.spawn_location}: ${item?.item_name ?? 'an item'}.`);
        return wordPrompt('pickup', 'interact');
      }
      afterStep();
    };

    const onEscape = () => {
      const s = get();
      const chase = { ...s.chase!, escapesDone: s.chase!.escapesDone + 1 };
      const proximity = clampMeter(s.ghostProximity - ESCAPE_RELIEF);
      if (chase.escapesDone >= chase.escapesNeeded) {
        const ghost = ghostById(chase.ghostId);
        set({ chase: null, ghostProximity: Math.min(proximity, 30), graceSteps: GRACE_STEPS_AFTER_ESCAPE, chasesSurvived: s.chasesSurvived + 1 });
        log(`You lost the ${ghost?.ghost_name ?? 'ghost'}. Chat is going wild.`, 'good');
        return afterStep();
      }
      set({ chase, ghostProximity: proximity });
      wordPrompt('escape', 'hide');
    };

    const onPickup = () => {
      const s = get();
      const find = s.pendingFind!;
      const item = s.content!.items.find((i) => i.item_id === find.item_id);
      set({
        pendingFind: null,
        spawns: takeFromSpawn(s.spawns, find.spawn_id),
        sessionInventory: addQuantities(s.sessionInventory, { [find.item_id]: 1 }),
      });
      log(`Collected ${item?.item_name ?? 'item'}.`, 'good');
      afterStep();
    };

    const startExorcism = () => {
      const s = get();
      const boss = ritualTargets(s.content!)[0];
      set({
        phase: 'exorcism',
        exorcism: { done: 0, needed: EXORCISM_LENGTH[s.content!.place.difficulty] },
        ghostProximity: Math.max(s.ghostProximity, 40),
      });
      log(`You lay out the items. The ${boss?.ghost_name ?? 'spirit'} manifests — finish the rite!`, 'ghost');
      wordPrompt('exorcise', 'exorcise');
    };

    const onExorciseWord = () => {
      const s = get();
      const ex = { ...s.exorcism!, done: s.exorcism!.done + 1 };
      set({ exorcism: ex, ghostProximity: clampMeter(s.ghostProximity - 8) });
      if (ex.done >= ex.needed) {
        log('The air goes still. The haunting is over.', 'good');
        return void finish('exorcised');
      }
      wordPrompt('exorcise', 'exorcise');
    };

    const onChoice = (action: ChoiceAction) => {
      const s = get();
      switch (action) {
        case 'deeper':
        case 'keepLooking':
          set({ phase: 'exploring', missing: [] });
          return wordPrompt('move', 'movement');
        case 'wrapUp':
          return choicePrompt('ritualPrompt', [C.ritual, C.goHome]);
        case 'ritual': {
          const owned = addQuantities(s.userInventory, s.sessionInventory);
          const check = checkRequirements(requiredItems(s.content!), owned);
          if (check.met) return startExorcism();
          set({ missing: check.missing });
          log('You do not have everything the ritual needs.', 'bad');
          return choicePrompt('insufficient', [C.keepLooking, C.goHome]);
        }
        case 'goHome':
          return void finish('extracted');
        case 'retry':
          return void get().selectPlace(s.content!.place.place_id);
        case 'menu':
          return get().backToMenu();
      }
    };

    /** Save Results (USER_PLACE_PROGRESS + USER_INVENTORY), then show the outcome. */
    const finish = async (outcome: SessionOutcome, caughtBy?: string) => {
      const s = get();
      const content = s.content!;
      const previous = s.places.find((p) => p.place.place_id === content.place.place_id)?.progress ?? null;
      const metrics = { wpm: wpm(s.stats), accuracy: accuracy(s.stats) };
      const durationSec = Math.round((now() - s.sessionStartedAt) / 1000);
      if (caughtBy) log(`${caughtBy} caught you. The stream cuts to static.`, 'ghost');
      set({ phase: 'saving', prompt: null, buffer: '', chase: outcome === 'caught' ? s.chase : null });

      const result: SessionResult = {
        outcome,
        placeName: content.place.place_name,
        ...metrics,
        roomsExplored: s.room,
        stepsTaken: s.playerDistance,
        itemsFound: s.sessionInventory,
        chasesSurvived: s.chasesSurvived,
        durationSec,
        caughtBy,
        previousBest: { wpm: previous?.best_wpm ?? null, accuracy: previous?.best_accuracy ?? null },
        progress: null,
      };
      try {
        result.progress = await repo.saveSessionResults({
          placeId: content.place.place_id,
          outcome,
          ...metrics,
          playtimeSeconds: durationSec,
          collected: s.sessionInventory,
        });
        const [places, userInventory, player] = await Promise.all([repo.listPlaces(), repo.getInventory(), repo.getPlayer()]);
        set({ places, userInventory, player });
      } catch (e) {
        result.saveError = (e as Error).message;
      }
      set({ result });
      choicePrompt(outcome === 'caught' ? 'gameover' : 'results', [C.retry, C.menu]);
    };

    // ------------------------------------------------------------- store
    return {
      phase: 'boot',
      error: null,
      player: null,
      places: [],
      items: [],
      wordBank: [],
      userInventory: {},
      ...sessionDefaults(),

      async init() {
        try {
          const player = await repo.getPlayer();
          if (!player) return set({ phase: 'auth' });
          const [places, items, wordBank, userInventory] = await Promise.all([
            repo.listPlaces(), repo.listItems(), repo.getWordBank(), repo.getInventory(),
          ]);
          set({ player, places, items, wordBank, userInventory, phase: 'menu', error: null });
        } catch (e) {
          set({ error: (e as Error).message, phase: 'menu' });
        }
      },

      async selectPlace(placeId) {
        set({ ...sessionDefaults(), phase: 'loading', error: null });
        try {
          const [, content, userInventory] = await Promise.all([
            repo.startPlaceSession(placeId), repo.getPlaceContent(placeId), repo.getInventory(),
          ]);
          set({ content, userInventory, spawns: initSpawns(content.spawns), sessionStartedAt: now(), phase: 'exploring' });
          log(`LIVE from ${content.place.place_name}. ${content.place.description}`);
          wordPrompt('move', 'movement');
        } catch (e) {
          set({ error: (e as Error).message, phase: 'menu' });
        }
      },

      pressKey(key) {
        const s = get();
        if (!s.prompt) return;
        const timed = s.prompt.kind !== 'choice';
        if (timed ? !TIMED_PHASES.includes(s.phase) : !CHOICE_PHASES.includes(s.phase)) return;

        const { buffer, result } = applyKey(s.buffer, s.prompt.options, key);
        const t = now();

        if (result.kind === 'typo') {
          if (!timed) return set({ typoAt: t }); // choices are safe moments
          set({
            typoAt: t,
            stats: { ...s.stats, totalKeystrokes: s.stats.totalKeystrokes + 1 },
            prompt: { ...s.prompt, deadline: Math.max(t + 400, s.prompt.deadline! - TYPO_TIME_PENALTY_MS) },
          });
          ghostGetsCloser('typo');
          return;
        }

        if (timed) {
          const stats = { ...s.stats, correctKeystrokes: s.stats.correctKeystrokes + 1, totalKeystrokes: s.stats.totalKeystrokes + 1 };
          if (result.kind === 'complete') {
            stats.wordsCompleted += 1;
            stats.activeMs += t - s.prompt.shownAt;
          }
          set({ stats });
        }
        set({ buffer });
        if (result.kind !== 'complete') return;

        switch (s.prompt.kind) {
          case 'move': return onMove();
          case 'escape': return onEscape();
          case 'pickup': return onPickup();
          case 'exorcise': return onExorciseWord();
          case 'choice': return onChoice(s.prompt.choices!.find((c) => c.word === result.option)!.action);
        }
      },

      choose(action) {
        const s = get();
        if (s.prompt?.kind === 'choice' && s.prompt.choices?.some((c) => c.action === action)) onChoice(action);
      },

      tick() {
        const s = get();
        const p = s.prompt;
        if (!p?.deadline || !TIMED_PHASES.includes(s.phase) || now() < p.deadline) return;

        set({ stats: { ...s.stats, wordsFailed: s.stats.wordsFailed + 1, activeMs: s.stats.activeMs + p.timeLimitMs! } });
        log(p.kind === 'pickup' ? 'Too slow — it slips into the dark.' : 'Too slow. Something moves closer.', 'bad');
        if (ghostGetsCloser('timeout')) return;

        switch (p.kind) {
          case 'move': return wordPrompt('move', 'movement');
          case 'escape': return wordPrompt('escape', 'hide');
          case 'exorcise': return wordPrompt('exorcise', 'exorcise');
          case 'pickup':
            set({ pendingFind: null });
            return afterStep();
        }
      },

      backToMenu() {
        set({ ...sessionDefaults(), phase: 'menu' });
      },
    };
  });
}

export type GameStore = ReturnType<typeof createGameStore>;
