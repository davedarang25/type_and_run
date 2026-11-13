// Row types mirroring backend/database/schema.sql (one class per table)
// plus the composite view models the engine uses. Same shapes as react_game/src/types/db.ts.

enum Difficulty { easy, medium, hard }

enum ActionType { movement, hide, interact, exorcise }

enum GhostBehavior { stalker, aggressive, patrol }

enum Hostility { low, medium, high, extreme }

enum ItemType {
  ritualSalt('ritual_salt'),
  relic('relic'),
  candle('candle'),
  talisman('talisman');

  const ItemType(this.db);
  final String db;
  static ItemType fromDb(String v) => values.firstWhere((e) => e.db == v);
}

enum ProgressStatus {
  unlocked('unlocked'),
  inProgress('in_progress'),
  cleared('cleared');

  const ProgressStatus(this.db);
  final String db;
  static ProgressStatus fromDb(String v) => values.firstWhere((e) => e.db == v);
}

/// item_id -> quantity
typedef ItemQuantities = Map<int, int>;

double? toDoubleOrNull(Object? v) =>
    v == null ? null : (v is num ? v.toDouble() : double.parse(v.toString()));

// ------------------------------------------------------------------ USERS
class UserRow {
  const UserRow({
    required this.userId,
    required this.username,
    required this.email,
    required this.totalPlaytime,
    required this.totalLocationsCompleted,
  });
  final int userId;
  final String username;
  final String email;
  final int totalPlaytime;
  final int totalLocationsCompleted;

  factory UserRow.fromJson(Map<String, dynamic> j) => UserRow(
        userId: j['user_id'] as int,
        username: j['username'] as String,
        email: j['email'] as String,
        totalPlaytime: j['total_playtime'] as int,
        totalLocationsCompleted: j['total_locations_completed'] as int,
      );
}

// -------------------------------------------------------------- WORD_BANK
class WordBankRow {
  const WordBankRow({
    required this.wordId,
    required this.word,
    required this.actionType,
    required this.difficulty,
    required this.timeLimit,
  });
  final int wordId;
  final String word;
  final ActionType actionType;
  final Difficulty difficulty;
  final int timeLimit; // seconds

  factory WordBankRow.fromJson(Map<String, dynamic> j) => WordBankRow(
        wordId: j['word_id'] as int,
        word: j['word'] as String,
        actionType: ActionType.values.byName(j['action_type'] as String),
        difficulty: Difficulty.values.byName(j['difficulty'] as String),
        timeLimit: j['time_limit'] as int,
      );
}

// ------------------------------------------------------------- GHOST_TYPE
class GhostType {
  const GhostType({
    required this.ghostId,
    required this.ghostName,
    required this.description,
    required this.behavior,
    required this.hostility,
    required this.movementSpeed,
    required this.weakness,
  });
  final int ghostId;
  final String ghostName;
  final String description;
  final GhostBehavior behavior;
  final Hostility hostility;
  final int movementSpeed;
  final String weakness;

  factory GhostType.fromJson(Map<String, dynamic> j) => GhostType(
        ghostId: j['ghost_id'] as int,
        ghostName: j['ghost_name'] as String,
        description: (j['description'] as String?) ?? '',
        behavior: GhostBehavior.values.byName(j['behavior'] as String),
        hostility: Hostility.values.byName(j['hostility'] as String),
        movementSpeed: j['movement_speed'] as int,
        weakness: (j['weakness'] as String?) ?? '',
      );
}

// --------------------------------------------------------- HAUNTED_PLACES
class HauntedPlace {
  const HauntedPlace({
    required this.placeId,
    required this.placeName,
    required this.description,
    required this.difficulty,
    required this.atmosphere,
    required this.isUnlocked,
  });
  final int placeId;
  final String placeName;
  final String description;
  final Difficulty difficulty;
  final String atmosphere;
  final bool isUnlocked;

  factory HauntedPlace.fromJson(Map<String, dynamic> j) => HauntedPlace(
        placeId: j['place_id'] as int,
        placeName: j['place_name'] as String,
        description: (j['description'] as String?) ?? '',
        difficulty: Difficulty.values.byName(j['difficulty'] as String),
        atmosphere: (j['atmosphere'] as String?) ?? '',
        isUnlocked: j['is_unlocked'] as bool,
      );
}

// ------------------------------------------------------------------ ITEMS
class Item {
  const Item({required this.itemId, required this.itemName, required this.description, required this.itemType});
  final int itemId;
  final String itemName;
  final String description;
  final ItemType itemType;

  factory Item.fromJson(Map<String, dynamic> j) => Item(
        itemId: j['item_id'] as int,
        itemName: j['item_name'] as String,
        description: (j['description'] as String?) ?? '',
        itemType: ItemType.fromDb(j['item_type'] as String),
      );
}

// ----------------------------------------------------------- PLACE_GHOSTS
class PlaceGhostRow {
  const PlaceGhostRow({
    required this.placeGhostId,
    required this.placeId,
    required this.ghostId,
    required this.spawnChance,
    required this.isBoss,
  });
  final int placeGhostId;
  final int placeId;
  final int ghostId;
  final int spawnChance; // % per room explored
  final bool isBoss;
}

// --------------------------------------------------- GHOST_REQUIRED_ITEMS
class GhostRequiredItem {
  const GhostRequiredItem({
    required this.requirementId,
    required this.ghostId,
    required this.itemId,
    required this.quantityRequired,
  });
  final int requirementId;
  final int ghostId;
  final int itemId;
  final int quantityRequired;

  factory GhostRequiredItem.fromJson(Map<String, dynamic> j) => GhostRequiredItem(
        requirementId: j['requirement_id'] as int,
        ghostId: j['ghost_id'] as int,
        itemId: j['item_id'] as int,
        quantityRequired: j['quantity_required'] as int,
      );
}

// ------------------------------------------------------ PLACE_ITEM_SPAWNS
class PlaceItemSpawn {
  const PlaceItemSpawn({
    required this.spawnId,
    required this.placeId,
    required this.itemId,
    required this.spawnLocation,
    required this.quantityAvailable,
  });
  final int spawnId;
  final int placeId;
  final int itemId;
  final String spawnLocation;
  final int quantityAvailable;

  factory PlaceItemSpawn.fromJson(Map<String, dynamic> j) => PlaceItemSpawn(
        spawnId: j['spawn_id'] as int,
        placeId: j['place_id'] as int,
        itemId: j['item_id'] as int,
        spawnLocation: j['spawn_location'] as String,
        quantityAvailable: j['quantity_available'] as int,
      );
}

// ---------------------------------------------------- USER_PLACE_PROGRESS
class UserPlaceProgress {
  const UserPlaceProgress({
    required this.progressId,
    required this.userId,
    required this.placeId,
    required this.status,
    required this.explorationCompleted,
    required this.ritualCompleted,
    this.bestWpm,
    this.bestAccuracy,
  });
  final int progressId;
  final int userId;
  final int placeId;
  final ProgressStatus status;
  final bool explorationCompleted;
  final bool ritualCompleted;
  final double? bestWpm;
  final double? bestAccuracy;

  UserPlaceProgress copyWith({
    ProgressStatus? status,
    bool? explorationCompleted,
    bool? ritualCompleted,
    double? bestWpm,
    double? bestAccuracy,
  }) =>
      UserPlaceProgress(
        progressId: progressId,
        userId: userId,
        placeId: placeId,
        status: status ?? this.status,
        explorationCompleted: explorationCompleted ?? this.explorationCompleted,
        ritualCompleted: ritualCompleted ?? this.ritualCompleted,
        bestWpm: bestWpm ?? this.bestWpm,
        bestAccuracy: bestAccuracy ?? this.bestAccuracy,
      );

  factory UserPlaceProgress.fromJson(Map<String, dynamic> j) => UserPlaceProgress(
        progressId: j['progress_id'] as int,
        userId: j['user_id'] as int,
        placeId: j['place_id'] as int,
        status: ProgressStatus.fromDb(j['status'] as String),
        explorationCompleted: j['exploration_completed'] as bool,
        ritualCompleted: j['ritual_completed'] as bool,
        bestWpm: toDoubleOrNull(j['best_wpm']),
        bestAccuracy: toDoubleOrNull(j['best_accuracy']),
      );

  Map<String, dynamic> toJson() => {
        'progress_id': progressId,
        'user_id': userId,
        'place_id': placeId,
        'status': status.db,
        'exploration_completed': explorationCompleted,
        'ritual_completed': ritualCompleted,
        'best_wpm': bestWpm,
        'best_accuracy': bestAccuracy,
      };
}

// ------------------------------------------------------------ view models

/// A ghost as it appears in one specific location (GHOST_TYPE + PLACE_GHOSTS).
class PlaceGhost extends GhostType {
  const PlaceGhost({
    required super.ghostId,
    required super.ghostName,
    required super.description,
    required super.behavior,
    required super.hostility,
    required super.movementSpeed,
    required super.weakness,
    required this.spawnChance,
    required this.isBoss,
  });
  final int spawnChance;
  final bool isBoss;

  /// A row from GET /api/places/:id/content → ghosts (ghost_type columns + spawn_chance + is_boss).
  factory PlaceGhost.fromJson(Map<String, dynamic> j) =>
      PlaceGhost.from(GhostType.fromJson(j), spawnChance: j['spawn_chance'] as int, isBoss: j['is_boss'] as bool);

  factory PlaceGhost.from(GhostType g, {required int spawnChance, required bool isBoss}) => PlaceGhost(
        ghostId: g.ghostId,
        ghostName: g.ghostName,
        description: g.description,
        behavior: g.behavior,
        hostility: g.hostility,
        movementSpeed: g.movementSpeed,
        weakness: g.weakness,
        spawnChance: spawnChance,
        isBoss: isBoss,
      );
}

/// Everything the engine needs to run one location.
class PlaceContent {
  const PlaceContent({
    required this.place,
    required this.ghosts,
    required this.spawns,
    required this.items,
    required this.requirements,
  });
  final HauntedPlace place;
  final List<PlaceGhost> ghosts;
  final List<PlaceItemSpawn> spawns;
  final List<Item> items;
  final List<GhostRequiredItem> requirements;

  Item? itemById(int id) {
    for (final i in items) {
      if (i.itemId == id) return i;
    }
    return null;
  }
}
