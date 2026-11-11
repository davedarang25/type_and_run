// Inventory & ritual rules. Pure. Mirrors react/src/engine/ritual.ts and
// place_ritual_requirements() in SQL.
import 'dart:math';

import '../models/db.dart';
import 'rng.dart';

/// Ghosts the ritual must banish: the boss(es), or everyone if the place has no boss.
List<PlaceGhost> ritualTargets(PlaceContent content) {
  final bosses = content.ghosts.where((g) => g.isBoss).toList();
  return bosses.isNotEmpty ? bosses : content.ghosts;
}

ItemQuantities requiredItems(PlaceContent content) {
  final ids = ritualTargets(content).map((g) => g.ghostId).toSet();
  final req = <int, int>{};
  for (final r in content.requirements) {
    if (ids.contains(r.ghostId)) req[r.itemId] = (req[r.itemId] ?? 0) + r.quantityRequired;
  }
  return req;
}

class MissingItem {
  const MissingItem({required this.itemId, required this.needed, required this.have});
  final int itemId;
  final int needed;
  final int have;
  @override
  bool operator ==(Object other) =>
      other is MissingItem && other.itemId == itemId && other.needed == needed && other.have == have;
  @override
  int get hashCode => Object.hash(itemId, needed, have);
}

class RequirementCheck {
  const RequirementCheck(this.missing);
  final List<MissingItem> missing;
  bool get met => missing.isEmpty;
}

/// "Requirements Met?" check against GHOST_REQUIRED_ITEMS.
RequirementCheck checkRequirements(ItemQuantities required, ItemQuantities owned) {
  final missing = <MissingItem>[];
  final ids = required.keys.toList()..sort();
  for (final id in ids) {
    final have = owned[id] ?? 0;
    if (have < required[id]!) missing.add(MissingItem(itemId: id, needed: required[id]!, have: have));
  }
  return RequirementCheck(missing);
}

ItemQuantities addQuantities(ItemQuantities a, ItemQuantities b) {
  final out = Map<int, int>.of(a);
  b.forEach((id, q) => out[id] = (out[id] ?? 0) + q);
  return out;
}

ItemQuantities subtractQuantities(ItemQuantities a, ItemQuantities b) {
  final out = Map<int, int>.of(a);
  b.forEach((id, q) {
    final left = (out[id] ?? 0) - q;
    if (left > 0) {
      out[id] = left;
    } else {
      out.remove(id);
    }
  });
  return out;
}

// ---- Item spawns during a session (PLACE_ITEM_SPAWNS) ----

class SpawnState {
  const SpawnState(this.spawn, this.remaining);
  final PlaceItemSpawn spawn;
  final int remaining;
  int get spawnId => spawn.spawnId;
  int get itemId => spawn.itemId;
  String get spawnLocation => spawn.spawnLocation;
}

List<SpawnState> initSpawns(List<PlaceItemSpawn> spawns) =>
    [for (final s in spawns) SpawnState(s, s.quantityAvailable)];

const double itemFindChance = 0.3;

/// "Found Ritual Item?" roll after a safe movement.
SpawnState? rollItemFind(List<SpawnState> spawns, Rng rng, [double chance = itemFindChance]) {
  final left = spawns.where((s) => s.remaining > 0).toList();
  if (left.isEmpty || rng() >= chance) return null;
  return pickWeighted(left, (s) => s.remaining, rng);
}

List<SpawnState> takeFromSpawn(List<SpawnState> spawns, int spawnId) => [
      for (final s in spawns) s.spawnId == spawnId ? SpawnState(s.spawn, max(0, s.remaining - 1)) : s,
    ];
