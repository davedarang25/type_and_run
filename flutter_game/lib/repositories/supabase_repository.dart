// Supabase / PostgreSQL backend. Reads go through RLS-protected selects;
// writes go through the security-definer RPCs in supabase/migrations/001_schema.sql.
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/db.dart';
import 'game_repository.dart';

class SupabaseRepository implements GameRepository {
  SupabaseRepository(this._sb);
  final SupabaseClient _sb;
  List<WordBankRow>? _words;
  List<Item>? _items;

  @override
  String get mode => 'supabase';

  @override
  Future<PlayerSummary?> getPlayer() async {
    final user = _sb.auth.currentUser;
    if (user == null) return null;
    final row = await _sb.from('users').select().eq('auth_id', user.id).maybeSingle();
    if (row == null) return null;
    final u = UserRow.fromJson(row);
    return PlayerSummary(
        username: u.username, totalPlaytime: u.totalPlaytime, totalLocationsCompleted: u.totalLocationsCompleted);
  }

  @override
  Future<List<Item>> listItems() async =>
      _items ??= (await _sb.from('items').select().order('item_id')).map(Item.fromJson).toList();

  @override
  Future<List<WordBankRow>> getWordBank() async =>
      _words ??= (await _sb.from('word_bank').select()).map(WordBankRow.fromJson).toList();

  @override
  Future<PlaceContent> getPlaceContent(int placeId) async {
    final placeRow = await _sb.from('haunted_places').select().eq('place_id', placeId).single();
    final ghostRows = await _sb.from('place_ghosts').select('spawn_chance, is_boss, ghost_type(*)').eq('place_id', placeId);
    final spawnRows = await _sb.from('place_item_spawns').select().eq('place_id', placeId);
    final items = await listItems();

    final ghosts = [
      for (final r in ghostRows)
        PlaceGhost.from(
          GhostType.fromJson(Map<String, dynamic>.from(r['ghost_type'] as Map)),
          spawnChance: r['spawn_chance'] as int,
          isBoss: r['is_boss'] as bool,
        ),
    ];
    final requirements = ghosts.isEmpty
        ? <GhostRequiredItem>[]
        : (await _sb.from('ghost_required_items').select().inFilter('ghost_id', ghosts.map((g) => g.ghostId).toList()))
            .map(GhostRequiredItem.fromJson)
            .toList();

    return PlaceContent(
      place: HauntedPlace.fromJson(placeRow),
      ghosts: ghosts,
      spawns: spawnRows.map(PlaceItemSpawn.fromJson).toList(),
      items: items,
      requirements: requirements,
    );
  }

  @override
  Future<List<PlaceCard>> listPlaces() async {
    final places = (await _sb.from('haunted_places').select().order('place_id')).map(HauntedPlace.fromJson).toList();
    final progress = (await _sb.from('user_place_progress').select()).map(UserPlaceProgress.fromJson);
    final byPlace = {for (final p in progress) p.placeId: p};
    return [
      for (final place in places)
        PlaceCard(
          place: place,
          progress: byPlace[place.placeId],
          unlocked: place.isUnlocked || byPlace.containsKey(place.placeId),
        ),
    ];
  }

  @override
  Future<ItemQuantities> getInventory() async {
    final rows = await _sb.from('user_inventory').select('item_id, quantity');
    return {
      for (final r in rows)
        if ((r['quantity'] as int) > 0) r['item_id'] as int: r['quantity'] as int,
    };
  }

  /// RPCs returning a composite row come back as a map (or a one-element list on some versions).
  UserPlaceProgress _progressFrom(dynamic res) {
    final row = res is List ? res.first : res;
    return UserPlaceProgress.fromJson(Map<String, dynamic>.from(row as Map));
  }

  @override
  Future<UserPlaceProgress> startPlaceSession(int placeId) async =>
      _progressFrom(await _sb.rpc('start_place_session', params: {'p_place_id': placeId}));

  @override
  Future<UserPlaceProgress> saveSessionResults(SessionResultInput input) async {
    final res = await _sb.rpc('save_session_results', params: {
      'p_place_id': input.placeId,
      'p_outcome': input.outcome.name,
      'p_wpm': input.wpm,
      'p_accuracy': input.accuracy,
      'p_playtime_seconds': input.playtimeSeconds,
      'p_collected': [
        for (final e in input.collected.entries) {'item_id': e.key, 'quantity': e.value},
      ],
    });
    return _progressFrom(res);
  }
}
