// Ghost AI: proximity meter (0 = safe, 100 = caught), encounters and chases.
// Pure. Mirrors react_game/src/engine/ghostAI.ts — keep the numbers in sync.
import 'dart:math';

import '../models/db.dart';
import 'rng.dart';

const double caughtAt = 100;
const int stepsPerRoom = 3;
const int graceStepsAfterEscape = 3;
const double moveRelief = 4; // safe move puts distance between you and the lurker
const double escapeRelief = 12; // each correct escape command
const double chaseFloor = 25; // a ghost that has found you is never far away

const Map<Hostility, double> hostilityMult = {
  Hostility.low: 0.75,
  Hostility.medium: 1,
  Hostility.high: 1.3,
  Hostility.extreme: 1.6,
};

class BehaviorProfile {
  const BehaviorProfile({
    required this.encounter,
    required this.proximityAffinity,
    required this.lunge,
    required this.penalty,
    required this.escapes,
  });
  final double encounter;
  final double proximityAffinity;
  final double lunge;
  final double penalty;
  final int escapes;
}

const Map<GhostBehavior, BehaviorProfile> behaviorProfiles = {
  GhostBehavior.stalker: BehaviorProfile(encounter: 1, proximityAffinity: 1.5, lunge: 18, penalty: 1.3, escapes: 3),
  GhostBehavior.aggressive: BehaviorProfile(encounter: 1.2, proximityAffinity: 0.5, lunge: 24, penalty: 1, escapes: 4),
  GhostBehavior.patrol: BehaviorProfile(encounter: 0.8, proximityAffinity: 0.8, lunge: 15, penalty: 0.8, escapes: 2),
};

class ChaseState {
  const ChaseState({required this.ghostId, required this.escapesNeeded, this.escapesDone = 0});
  final int ghostId;
  final int escapesNeeded;
  final int escapesDone;
  ChaseState withEscape() => ChaseState(ghostId: ghostId, escapesNeeded: escapesNeeded, escapesDone: escapesDone + 1);
}

double round1(double v) => (v * 10).round() / 10;
double clampMeter(double v) => round1(min(caughtAt, max(0, v)));
bool isCaught(double proximity) => proximity >= caughtAt;

double threat(PlaceGhost g) => g.movementSpeed * hostilityMult[g.hostility]!;

/// The ghost whose presence the meter tracks when nobody is chasing you.
PlaceGhost? lurkingGhost(List<PlaceGhost> ghosts) {
  PlaceGhost? best;
  for (final g in ghosts) {
    if (best == null || g.spawnChance * threat(g) > best.spawnChance * threat(best)) best = g;
  }
  return best;
}

enum PenaltyKind { typo, timeout }

/// "Ghost Gets Closer": meter advance for a typo or a timed-out command.
double penaltyAdvance(PlaceGhost? ghost, PenaltyKind kind, {required bool inChase}) {
  if (ghost == null) return kind == PenaltyKind.typo ? 2 : 5;
  final base = 2 + ghost.movementSpeed * 0.6;
  final kindMult = kind == PenaltyKind.typo ? 1.0 : 2.5;
  final chaseMult = inChase ? 1.5 : 1.0;
  return round1(base * kindMult * chaseMult * hostilityMult[ghost.hostility]! * behaviorProfiles[ghost.behavior]!.penalty);
}

/// Per-step chance that this ghost finds you. spawn_chance is defined per room.
double encounterChance(PlaceGhost g, {required int depth, required double proximity, required int graceSteps}) {
  if (graceSteps > 0) return 0;
  final b = behaviorProfiles[g.behavior]!;
  final perStep = g.spawnChance / 100 / stepsPerRoom;
  final depthMult = 1 + depth * 0.15;
  final proxMult = 1 + (proximity / 100) * b.proximityAffinity;
  final bossMult = g.isBoss ? (depth < 1 ? 0.25 : 1.0) : 1.0; // bosses wait deeper inside
  return min(0.6, perStep * hostilityMult[g.hostility]! * b.encounter * depthMult * proxMult * bossMult);
}

/// "Ghost Encounter?" roll after a successful movement.
PlaceGhost? rollEncounter(List<PlaceGhost> ghosts, Rng rng, {required int depth, required double proximity, required int graceSteps}) {
  for (final g in ghosts) {
    if (rng() < encounterChance(g, depth: depth, proximity: proximity, graceSteps: graceSteps)) return g;
  }
  return null;
}

class ChaseStart {
  const ChaseStart(this.proximity, this.chase, this.caught);
  final double proximity;
  final ChaseState chase;
  final bool caught;
}

/// "Ghost AI" on encounter: it lunges, and a chase begins unless that already caught you.
ChaseStart startChase(PlaceGhost ghost, double proximity) {
  final b = behaviorProfiles[ghost.behavior]!;
  final next = min(caughtAt, max(proximity, chaseFloor) + b.lunge * hostilityMult[ghost.hostility]!);
  final hostileBonus = ghost.hostility == Hostility.high || ghost.hostility == Hostility.extreme ? 1 : 0;
  return ChaseStart(
    round1(next),
    ChaseState(ghostId: ghost.ghostId, escapesNeeded: b.escapes + hostileBonus),
    next >= caughtAt,
  );
}
