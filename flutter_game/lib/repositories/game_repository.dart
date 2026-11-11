// Repository contracts. Same shape as react/src/repositories/types.ts.
import '../models/db.dart';

enum SessionOutcome { extracted, exorcised, caught }

class PlaceCard {
  const PlaceCard({required this.place, required this.progress, required this.unlocked});
  final HauntedPlace place;
  final UserPlaceProgress? progress;
  final bool unlocked;
}

class PlayerSummary {
  const PlayerSummary({required this.username, required this.totalPlaytime, required this.totalLocationsCompleted});
  final String username;
  final int totalPlaytime;
  final int totalLocationsCompleted;
}

class SessionResultInput {
  const SessionResultInput({
    required this.placeId,
    required this.outcome,
    required this.wpm,
    required this.accuracy,
    required this.playtimeSeconds,
    required this.collected,
  });
  final int placeId;
  final SessionOutcome outcome;
  final double wpm;
  final double accuracy;
  final int playtimeSeconds;

  /// Items found this session; banked unless the player was caught.
  final ItemQuantities collected;
}

/// Read-only content + USER_PLACE_PROGRESS + USER_INVENTORY.
abstract class GameRepository {
  /// 'supabase' or 'local'
  String get mode;

  Future<PlayerSummary?> getPlayer();

  // Content (WORD_BANK, places, ghosts, items, junction tables)
  Future<List<Item>> listItems();
  Future<List<WordBankRow>> getWordBank();
  Future<PlaceContent> getPlaceContent(int placeId);

  // USER_PLACE_PROGRESS
  Future<List<PlaceCard>> listPlaces();

  /// Marks the place in_progress (flowchart: "Initialize USER_PLACE_PROGRESS").
  Future<UserPlaceProgress> startPlaceSession(int placeId);

  /// Flowchart "Save Results". Atomically updates USER_PLACE_PROGRESS, banks/consumes
  /// USER_INVENTORY and updates USERS totals.
  Future<UserPlaceProgress> saveSessionResults(SessionResultInput input);

  // USER_INVENTORY (writes happen inside saveSessionResults so they stay atomic)
  Future<ItemQuantities> getInventory();
}
