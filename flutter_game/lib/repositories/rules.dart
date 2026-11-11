// Persistence rules for offline mode. Mirrors save_session_results() in SQL
// (and react/src/repositories/rules.ts) so both backends behave identically.
import 'dart:math';

import '../engine/ritual.dart';
import '../models/db.dart';
import 'game_repository.dart';

class SaveState {
  const SaveState({
    this.inventory = const {},
    this.progress = const {},
    this.totalPlaytime = 0,
    this.totalLocationsCompleted = 0,
  });
  final ItemQuantities inventory;
  final Map<int, UserPlaceProgress> progress;
  final int totalPlaytime;
  final int totalLocationsCompleted;

  SaveState copyWith({
    ItemQuantities? inventory,
    Map<int, UserPlaceProgress>? progress,
    int? totalPlaytime,
    int? totalLocationsCompleted,
  }) =>
      SaveState(
        inventory: inventory ?? this.inventory,
        progress: progress ?? this.progress,
        totalPlaytime: totalPlaytime ?? this.totalPlaytime,
        totalLocationsCompleted: totalLocationsCompleted ?? this.totalLocationsCompleted,
      );

  Map<String, dynamic> toJson() => {
        'inventory': inventory.map((k, v) => MapEntry('$k', v)),
        'progress': progress.map((k, v) => MapEntry('$k', v.toJson())),
        'totalPlaytime': totalPlaytime,
        'totalLocationsCompleted': totalLocationsCompleted,
      };

  factory SaveState.fromJson(Map<String, dynamic> j) => SaveState(
        inventory: ((j['inventory'] as Map?) ?? {}).map((k, v) => MapEntry(int.parse('$k'), (v as num).toInt())),
        progress: ((j['progress'] as Map?) ?? {})
            .map((k, v) => MapEntry(int.parse('$k'), UserPlaceProgress.fromJson(Map<String, dynamic>.from(v as Map)))),
        totalPlaytime: (j['totalPlaytime'] as num?)?.toInt() ?? 0,
        totalLocationsCompleted: (j['totalLocationsCompleted'] as num?)?.toInt() ?? 0,
      );
}

UserPlaceProgress blankProgress(int progressId, int placeId, ProgressStatus status) => UserPlaceProgress(
      progressId: progressId,
      userId: 1,
      placeId: placeId,
      status: status,
      explorationCompleted: false,
      ritualCompleted: false,
    );

/// Caps collected quantities at what the place can actually spawn.
ItemQuantities capCollected(ItemQuantities collected, List<PlaceItemSpawn> spawns) {
  final caps = <int, int>{};
  for (final s in spawns) {
    caps[s.itemId] = (caps[s.itemId] ?? 0) + s.quantityAvailable;
  }
  final out = <int, int>{};
  collected.forEach((id, q) {
    final n = min(q, caps[id] ?? 0);
    if (n > 0) out[id] = n;
  });
  return out;
}

SaveState applySessionResult(
  SaveState state,
  SessionResultInput input,
  PlaceContent content,
  List<HauntedPlace> places,
  int Function() newProgressId,
) {
  if (input.wpm < 0 || input.wpm > 400 || input.accuracy < 0 || input.accuracy > 100) {
    throw StateError('Metrics out of range');
  }
  final progress = Map<int, UserPlaceProgress>.of(state.progress);
  final existing = progress[input.placeId] ?? blankProgress(newProgressId(), input.placeId, ProgressStatus.inProgress);
  progress[input.placeId] = existing;
  var next = state.copyWith(
    progress: progress,
    totalPlaytime: state.totalPlaytime + max(0, input.playtimeSeconds),
  );
  if (input.outcome == SessionOutcome.caught) return next;

  var inventory = addQuantities(state.inventory, capCollected(input.collected, content.spawns));
  if (input.outcome == SessionOutcome.exorcised) {
    final req = requiredItems(content);
    if (!checkRequirements(req, inventory).met) throw StateError('Ritual requirements not met');
    inventory = subtractQuantities(inventory, req);
  }

  final firstClear = !existing.explorationCompleted;
  progress[input.placeId] = existing.copyWith(
    status: ProgressStatus.cleared,
    explorationCompleted: true,
    ritualCompleted: existing.ritualCompleted || input.outcome == SessionOutcome.exorcised,
    bestWpm: max(existing.bestWpm ?? 0.0, input.wpm),
    bestAccuracy: max(existing.bestAccuracy ?? 0.0, input.accuracy),
  );
  next = next.copyWith(inventory: inventory, progress: progress);

  if (firstClear) {
    next = next.copyWith(totalLocationsCompleted: next.totalLocationsCompleted + 1);
    final following = places.where((p) => p.placeId > input.placeId).toList()
      ..sort((a, b) => a.placeId.compareTo(b.placeId));
    if (following.isNotEmpty && !progress.containsKey(following.first.placeId)) {
      progress[following.first.placeId] = blankProgress(newProgressId(), following.first.placeId, ProgressStatus.unlocked);
    }
  }
  return next;
}
