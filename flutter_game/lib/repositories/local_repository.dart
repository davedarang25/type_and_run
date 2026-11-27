// Offline backend: bundled seed content + progress in a key-value store
// (SharedPreferences in the app, memory in tests).
import 'dart:convert';
import 'dart:math';

import '../data/seed.g.dart';
import '../models/db.dart';
import 'game_repository.dart';
import 'rules.dart';

abstract class KeyValueStore {
  String? read(String key);
  Future<void> write(String key, String value);
  Future<void> remove(String key);
}

class MemoryStore implements KeyValueStore {
  final _m = <String, String>{};
  @override
  String? read(String key) => _m[key];
  @override
  Future<void> write(String key, String value) async => _m[key] = value;
  @override
  Future<void> remove(String key) async => _m.remove(key);
}

PlaceContent buildPlaceContent(int placeId) {
  final place = seedHauntedPlaces.firstWhere((p) => p.placeId == placeId,
      orElse: () => throw ArgumentError('Unknown place $placeId'));
  final ghosts = [
    for (final pg in seedPlaceGhosts.where((pg) => pg.placeId == placeId))
      PlaceGhost.from(seedGhostTypes.firstWhere((g) => g.ghostId == pg.ghostId),
          spawnChance: pg.spawnChance, isBoss: pg.isBoss),
  ];
  final ghostIds = ghosts.map((g) => g.ghostId).toSet();
  return PlaceContent(
    place: place,
    ghosts: ghosts,
    spawns: seedPlaceItemSpawns.where((s) => s.placeId == placeId).toList(),
    items: seedItems,
    requirements: seedGhostRequiredItems.where((r) => ghostIds.contains(r.ghostId)).toList(),
  );
}

class LocalRepository implements GameRepository {
  LocalRepository(this._store);
  static const _key = 'type-to-run:save:v1';
  final KeyValueStore _store;
  SaveState? _memory;

  @override
  String get mode => 'local';

  SaveState _load() {
    if (_memory != null) return _memory!;
    try {
      final raw = _store.read(_key);
      _memory = raw == null ? const SaveState() : SaveState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      _memory = const SaveState();
    }
    return _memory!;
  }

  Future<void> _save(SaveState s) async {
    _memory = s;
    try {
      await _store.write(_key, jsonEncode(s.toJson()));
    } catch (_) {/* keep in memory */}
  }

  int _nextProgressId() => _load().progress.values.fold(0, (m, p) => max(m, p.progressId)) + 1;

  @override
  Future<PlayerSummary?> getPlayer() async {
    final s = _load();
    return PlayerSummary(
        username: 'Guest streamer', totalPlaytime: s.totalPlaytime, totalLocationsCompleted: s.totalLocationsCompleted);
  }

  @override
  Future<List<Item>> listItems() async => seedItems;
  @override
  Future<List<WordBankRow>> getWordBank() async => seedWordBank;
  @override
  Future<PlaceContent> getPlaceContent(int placeId) async => buildPlaceContent(placeId);
  @override
  Future<ItemQuantities> getInventory() async => Map.of(_load().inventory);

  @override
  Future<List<PlaceCard>> listPlaces() async {
    final s = _load();
    return [
      for (final place in seedHauntedPlaces)
        PlaceCard(
          place: place,
          progress: s.progress[place.placeId],
          unlocked: place.isUnlocked || s.progress.containsKey(place.placeId),
        ),
    ];
  }

  @override
  Future<UserPlaceProgress> startPlaceSession(int placeId) async {
    final s = _load();
    final place = seedHauntedPlaces.where((p) => p.placeId == placeId).firstOrNull;
    final existing = s.progress[placeId];
    if (place == null || (!place.isUnlocked && existing == null)) throw StateError('Location $placeId is locked');
    final row = existing != null
        ? existing.copyWith(status: existing.status == ProgressStatus.cleared ? ProgressStatus.cleared : ProgressStatus.inProgress)
        : blankProgress(_nextProgressId(), placeId, ProgressStatus.inProgress);
    await _save(s.copyWith(progress: {...s.progress, placeId: row}));
    return row;
  }

  @override
  Future<UserPlaceProgress> saveSessionResults(SessionResultInput input) async {
    final next = applySessionResult(_load(), input, buildPlaceContent(input.placeId), seedHauntedPlaces, _nextProgressId);
    await _save(next);
    return next.progress[input.placeId]!;
  }

  /// Dev helper: wipe offline progress.
  Future<void> reset() => _save(const SaveState());
}
