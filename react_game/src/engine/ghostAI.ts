// Ghost AI: proximity meter (0 = safe, 100 = caught), encounters and chases. Pure.
import type { GhostBehavior, Hostility, PlaceGhost } from '../types/db.ts';
import type { Rng } from './rng.ts';

export const CAUGHT_AT = 100;
export const STEPS_PER_ROOM = 3;
export const GRACE_STEPS_AFTER_ESCAPE = 3;

export const HOSTILITY_MULT: Record<Hostility, number> = { low: 0.75, medium: 1, high: 1.3, extreme: 1.6 };

interface BehaviorProfile {
  encounter: number; // base encounter multiplier
  proximityAffinity: number; // how much a high meter raises encounter odds
  lunge: number; // meter jump when it finds you
  penalty: number; // multiplier on typo/timeout advance
  escapes: number; // correct escape commands needed to lose it
}

export const BEHAVIOR: Record<GhostBehavior, BehaviorProfile> = {
  // Follows you; the closer it already is, the likelier it shows itself.
  stalker: { encounter: 1, proximityAffinity: 1.5, lunge: 18, penalty: 1.3, escapes: 3 },
  // Rare-ish but explosive; harder to shake.
  aggressive: { encounter: 1.2, proximityAffinity: 0.5, lunge: 24, penalty: 1, escapes: 4 },
  // Walks a route; predictable, forgiving.
  patrol: { encounter: 0.8, proximityAffinity: 0.8, lunge: 15, penalty: 0.8, escapes: 2 },
};

export interface ChaseState {
  ghostId: number;
  escapesNeeded: number;
  escapesDone: number;
}

export const threat = (g: PlaceGhost) => g.movement_speed * HOSTILITY_MULT[g.hostility];

/** The ghost whose presence the meter tracks when nobody is chasing you. */
export function lurkingGhost(ghosts: PlaceGhost[]): PlaceGhost | null {
  return ghosts.reduce<PlaceGhost | null>(
    (best, g) => (!best || g.spawn_chance * threat(g) > best.spawn_chance * threat(best) ? g : best),
    null,
  );
}

export type PenaltyKind = 'typo' | 'timeout';

/** "Ghost Gets Closer": meter advance for a typo or a timed-out command. */
export function penaltyAdvance(ghost: PlaceGhost | null, kind: PenaltyKind, inChase: boolean): number {
  if (!ghost) return kind === 'typo' ? 2 : 5;
  const base = 2 + ghost.movement_speed * 0.6;
  const kindMult = kind === 'typo' ? 1 : 2.5;
  const chaseMult = inChase ? 1.5 : 1;
  const v = base * kindMult * chaseMult * HOSTILITY_MULT[ghost.hostility] * BEHAVIOR[ghost.behavior].penalty;
  return Math.round(v * 10) / 10;
}

/** Moving on without a chase puts a little distance between you and whatever lurks. */
export const MOVE_RELIEF = 4;
/** Each correct escape command during a chase. */
export const ESCAPE_RELIEF = 12;

export interface EncounterContext {
  depth: number; // rooms cleared
  proximity: number;
  graceSteps: number;
}

/** Per-step chance that this ghost finds you. spawn_chance is defined per room. */
export function encounterChance(g: PlaceGhost, ctx: EncounterContext): number {
  if (ctx.graceSteps > 0) return 0;
  const b = BEHAVIOR[g.behavior];
  const perStep = g.spawn_chance / 100 / STEPS_PER_ROOM;
  const depthMult = 1 + ctx.depth * 0.15; // deeper = riskier
  const proxMult = 1 + (ctx.proximity / 100) * b.proximityAffinity;
  const bossMult = g.is_boss ? (ctx.depth < 1 ? 0.25 : 1) : 1; // bosses wait deeper inside
  return Math.min(0.6, perStep * HOSTILITY_MULT[g.hostility] * b.encounter * depthMult * proxMult * bossMult);
}

/** "Ghost Encounter?" roll after a successful movement. */
export function rollEncounter(ghosts: PlaceGhost[], ctx: EncounterContext, rng: Rng): PlaceGhost | null {
  for (const g of ghosts) if (rng() < encounterChance(g, ctx)) return g;
  return null;
}

/** A ghost that has found you is never far away. */
export const CHASE_FLOOR = 25;

/** "Ghost AI" on encounter: it lunges, and a chase begins unless that already caught you. */
export function startChase(ghost: PlaceGhost, proximity: number): { proximity: number; chase: ChaseState; caught: boolean } {
  const b = BEHAVIOR[ghost.behavior];
  const next = Math.min(CAUGHT_AT, Math.max(proximity, CHASE_FLOOR) + b.lunge * HOSTILITY_MULT[ghost.hostility]);
  const hostileBonus = ghost.hostility === 'high' || ghost.hostility === 'extreme' ? 1 : 0;
  return {
    proximity: Math.round(next * 10) / 10,
    chase: { ghostId: ghost.ghost_id, escapesNeeded: b.escapes + hostileBonus, escapesDone: 0 },
    caught: next >= CAUGHT_AT,
  };
}

export const isCaught = (proximity: number) => proximity >= CAUGHT_AT;
export const clampMeter = (v: number) => Math.round(Math.min(CAUGHT_AT, Math.max(0, v)) * 10) / 10;
