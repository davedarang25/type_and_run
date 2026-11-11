// Central GameEngineState — a Riverpod Notifier implementing the spec's state machine.
// Line-for-line port of react/src/store/gameEngine.ts:
//
//   menu → loading → exploring ⇄ (chase) → decision → ritualPrompt → exorcism → results
//                         │                                  └→ insufficient → exploring
//                         └──────────────── caught ───────────────────────────→ gameover
//
// Randomness, time and the repository come from providers, so tests can override them.
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../engine/ghost_ai.dart';
import '../engine/ritual.dart';
import '../engine/rng.dart';
import '../engine/typing.dart';
import '../engine/word_generator.dart';
import '../models/db.dart';
import '../repositories/game_repository.dart';

// ------------------------------------------------------------------ providers

/// Overridden in main.dart (Supabase or offline) and in tests.
final repositoryProvider = Provider<GameRepository>((ref) => throw UnimplementedError('repositoryProvider not overridden'));
final rngProvider = Provider<Rng>((ref) => Random().nextDouble);
final clockProvider = Provider<int Function()>((ref) => () => DateTime.now().millisecondsSinceEpoch);

final gameEngineProvider = NotifierProvider<GameEngine, GameEngineState>(GameEngine.new);

// ---------------------------------------------------------------------- types

enum Phase { boot, auth, menu, loading, exploring, decision, ritualPrompt, insufficient, exorcism, saving, results, gameover }

enum PromptKind { move, escape, pickup, exorcise, choice }

enum ChoiceAction { deeper, wrapUp, ritual, goHome, keepLooking, menu, retry }

class Choice {
  const Choice(this.word, this.label, this.action);
  final String word;
  final String label;
  final ChoiceAction action;
}

class Prompt {
  const Prompt({
    required this.kind,
    required this.options,
    required this.shownAt,
    this.choices = const [],
    this.actionType,
    this.deadline,
    this.timeLimitMs,
  });
  final PromptKind kind;
  final List<String> options;
  final List<Choice> choices;
  final ActionType? actionType;
  final int shownAt;
  final int? deadline; // null = untimed (choices)
  final int? timeLimitMs;

  bool get timed => kind != PromptKind.choice;

  Prompt withDeadline(int d) => Prompt(
        kind: kind,
        options: options,
        shownAt: shownAt,
        choices: choices,
        actionType: actionType,
        deadline: d,
        timeLimitMs: timeLimitMs,
      );
}

enum LogTone { info, good, bad, ghost }

class LogEntry {
  const LogEntry(this.id, this.text, this.tone);
  final int id;
  final String text;
  final LogTone tone;
}

class ExorcismProgress {
  const ExorcismProgress(this.done, this.needed);
  final int done;
  final int needed;
}

class SessionResult {
  SessionResult({
    required this.outcome,
    required this.placeName,
    required this.wpm,
    required this.accuracy,
    required this.roomsExplored,
    required this.stepsTaken,
    required this.itemsFound,
    required this.chasesSurvived,
    required this.durationSec,
    required this.previousBestWpm,
    required this.previousBestAccuracy,
    this.caughtBy,
  });
  final SessionOutcome outcome;
  final String placeName;
  final double wpm;
  final double accuracy;
  final int roomsExplored;
  final int stepsTaken;
  final ItemQuantities itemsFound;
  final int chasesSurvived;
  final int durationSec;
  final double? previousBestWpm;
  final double? previousBestAccuracy;
  final String? caughtBy;
  UserPlaceProgress? progress;
  String? saveError;
}

const _unset = Object();

class GameEngineState {
  const GameEngineState({
    this.phase = Phase.boot,
    this.error,
    this.player,
    this.places = const [],
    this.items = const [],
    this.wordBank = const [],
    this.userInventory = const {},
    this.content,
    this.prompt,
    this.buffer = '',
    this.typoAt = 0,
    this.playerDistance = 0,
    this.room = 0,
    this.stepInRoom = 0,
    this.ghostProximity = 0,
    this.chase,
    this.graceSteps = 0,
    this.chasesSurvived = 0,
    this.sessionInventory = const {},
    this.spawns = const [],
    this.pendingFind,
    this.exorcism,
    this.missing = const [],
    this.stats = const TypingStats(),
    this.recentWords = const [],
    this.log = const [],
    this.sessionStartedAt = 0,
    this.result,
  });

  final Phase phase;
  final String? error;
  // catalog
  final PlayerSummary? player;
  final List<PlaceCard> places;
  final List<Item> items;
  final List<WordBankRow> wordBank;
  final ItemQuantities userInventory;
  // active session
  final PlaceContent? content;
  final Prompt? prompt;
  final String buffer;
  final int typoAt; // timestamp of the last typo, drives the red flash
  final int playerDistance; // successful moves
  final int room; // rooms cleared (depth)
  final int stepInRoom;
  final double ghostProximity; // 0 safe … 100 caught
  final ChaseState? chase;
  final int graceSteps;
  final int chasesSurvived;
  final ItemQuantities sessionInventory;
  final List<SpawnState> spawns;
  final SpawnState? pendingFind;
  final ExorcismProgress? exorcism;
  final List<MissingItem> missing;
  final TypingStats stats;
  final List<String> recentWords;
  final List<LogEntry> log;
  final int sessionStartedAt;
  final SessionResult? result;

  /// Keeps the catalog, resets everything about the current run.
  GameEngineState resetSession(Phase phase) => GameEngineState(
        phase: phase,
        player: player,
        places: places,
        items: items,
        wordBank: wordBank,
        userInventory: userInventory,
      );

  GameEngineState copyWith({
    Phase? phase,
    Object? error = _unset,
    PlayerSummary? player,
    List<PlaceCard>? places,
    List<Item>? items,
    List<WordBankRow>? wordBank,
    ItemQuantities? userInventory,
    Object? content = _unset,
    Object? prompt = _unset,
    String? buffer,
    int? typoAt,
    int? playerDistance,
    int? room,
    int? stepInRoom,
    double? ghostProximity,
    Object? chase = _unset,
    int? graceSteps,
    int? chasesSurvived,
    ItemQuantities? sessionInventory,
    List<SpawnState>? spawns,
    Object? pendingFind = _unset,
    Object? exorcism = _unset,
    List<MissingItem>? missing,
    TypingStats? stats,
    List<String>? recentWords,
    List<LogEntry>? log,
    int? sessionStartedAt,
    Object? result = _unset,
  }) =>
      GameEngineState(
        phase: phase ?? this.phase,
        error: identical(error, _unset) ? this.error : error as String?,
        player: player ?? this.player,
        places: places ?? this.places,
        items: items ?? this.items,
        wordBank: wordBank ?? this.wordBank,
        userInventory: userInventory ?? this.userInventory,
        content: identical(content, _unset) ? this.content : content as PlaceContent?,
        prompt: identical(prompt, _unset) ? this.prompt : prompt as Prompt?,
        buffer: buffer ?? this.buffer,
        typoAt: typoAt ?? this.typoAt,
        playerDistance: playerDistance ?? this.playerDistance,
        room: room ?? this.room,
        stepInRoom: stepInRoom ?? this.stepInRoom,
        ghostProximity: ghostProximity ?? this.ghostProximity,
        chase: identical(chase, _unset) ? this.chase : chase as ChaseState?,
        graceSteps: graceSteps ?? this.graceSteps,
        chasesSurvived: chasesSurvived ?? this.chasesSurvived,
        sessionInventory: sessionInventory ?? this.sessionInventory,
        spawns: spawns ?? this.spawns,
        pendingFind: identical(pendingFind, _unset) ? this.pendingFind : pendingFind as SpawnState?,
        exorcism: identical(exorcism, _unset) ? this.exorcism : exorcism as ExorcismProgress?,
        missing: missing ?? this.missing,
        stats: stats ?? this.stats,
        recentWords: recentWords ?? this.recentWords,
        log: log ?? this.log,
        sessionStartedAt: sessionStartedAt ?? this.sessionStartedAt,
        result: identical(result, _unset) ? this.result : result as SessionResult?,
      );
}

const int typoTimePenaltyMs = 600;
const Map<Difficulty, int> exorcismLength = {Difficulty.easy: 3, Difficulty.medium: 4, Difficulty.hard: 5};
const _logSize = 6;
const _timedPhases = {Phase.exploring, Phase.exorcism};
const _choicePhases = {Phase.decision, Phase.ritualPrompt, Phase.insufficient, Phase.results, Phase.gameover};

const _deeper = Choice('deeper', 'Go deeper', ChoiceAction.deeper);
const _wrapUp = Choice('wrap up', 'Finish exploring', ChoiceAction.wrapUp);
const _ritual = Choice('ritual', 'Perform the ritual', ChoiceAction.ritual);
const _goHome = Choice('go home', 'Save results & leave', ChoiceAction.goHome);
const _keepLooking = Choice('keep looking', 'Search for more items', ChoiceAction.keepLooking);
const _retry = Choice('retry', 'Stream this place again', ChoiceAction.retry);
const _menu = Choice('menu', 'Back to locations', ChoiceAction.menu);

// --------------------------------------------------------------------- engine

class GameEngine extends Notifier<GameEngineState> {
  late GameRepository _repo;
  late Rng _rng;
  late int Function() _now;
  int _logId = 0;

  @override
  GameEngineState build() {
    _repo = ref.watch(repositoryProvider);
    _rng = ref.watch(rngProvider);
    _now = ref.watch(clockProvider);
    return const GameEngineState();
  }

  // ---------------------------------------------------------------- helpers

  void _log(String text, [LogTone tone = LogTone.info]) {
    state = state.copyWith(log: [LogEntry(++_logId, text, tone), ...state.log].take(_logSize).toList());
  }

  PlaceGhost? _ghostById(int id) => state.content?.ghosts.where((g) => g.ghostId == id).firstOrNull;

  /// "Nearest ghost": whoever is chasing you, the boss during a rite, else the lurker.
  PlaceGhost? currentThreat() {
    final content = state.content;
    if (content == null) return null;
    if (state.chase != null) return _ghostById(state.chase!.ghostId);
    if (state.phase == Phase.exorcism) return ritualTargets(content).firstOrNull;
    return lurkingGhost(content.ghosts);
  }

  /// Generate Typing Command from WORD_BANK.
  void _wordPrompt(PromptKind kind, ActionType action) {
    final s = state;
    final word = pickWord(s.wordBank, action, s.content!.place.difficulty, _rng, s.recentWords);
    final limit = timeLimitMs(word, chase: kind == PromptKind.escape || kind == PromptKind.exorcise, depth: s.room);
    final t = _now();
    state = s.copyWith(
      prompt: Prompt(kind: kind, options: [word.word], actionType: action, shownAt: t, deadline: t + limit, timeLimitMs: limit),
      buffer: '',
      recentWords: [word.word, ...s.recentWords].take(8).toList(),
    );
  }

  void _choicePrompt(Phase phase, List<Choice> choices) {
    state = state.copyWith(
      phase: phase,
      buffer: '',
      prompt: Prompt(kind: PromptKind.choice, options: [for (final c in choices) c.word], choices: choices, shownAt: _now()),
    );
  }

  /// Typing Penalty → Ghost Gets Closer → Caught?
  bool _ghostGetsCloser(PenaltyKind kind) {
    final ghost = currentThreat();
    final advance = penaltyAdvance(ghost, kind, inChase: state.chase != null || state.phase == Phase.exorcism);
    final proximity = clampMeter(state.ghostProximity + advance);
    state = state.copyWith(ghostProximity: proximity);
    if (isCaught(proximity)) {
      _finish(SessionOutcome.caught, ghost?.ghostName ?? 'something in the dark');
      return true;
    }
    return false;
  }

  /// After a step resolves: either the room is done (Continue Exploring?) or keep moving.
  void _afterStep() {
    if (state.stepInRoom >= stepsPerRoom) {
      final room = state.room + 1;
      state = state.copyWith(room: room, stepInRoom: 0);
      _log('Room $room explored. It\'s quieter here… for now.', LogTone.good);
      _choicePrompt(Phase.decision, const [_deeper, _wrapUp]);
    } else {
      state = state.copyWith(phase: Phase.exploring);
      _wordPrompt(PromptKind.move, ActionType.movement);
    }
  }

  // ------------------------------------------------------------ transitions

  void _onMove() {
    final s = state;
    final content = s.content!;
    final proximity = clampMeter(s.ghostProximity - moveRelief);
    state = s.copyWith(
      playerDistance: s.playerDistance + 1,
      stepInRoom: s.stepInRoom + 1,
      ghostProximity: proximity,
      graceSteps: max(0, s.graceSteps - 1),
    );

    // Ghost Encounter?
    final ghost = rollEncounter(content.ghosts, _rng, depth: s.room, proximity: proximity, graceSteps: s.graceSteps);
    if (ghost != null) {
      final r = startChase(ghost, proximity);
      state = state.copyWith(ghostProximity: r.proximity, chase: r.chase);
      _log('${ghost.ghostName.toUpperCase()} HAS SEEN YOU. RUN.', LogTone.ghost);
      if (r.caught) {
        _finish(SessionOutcome.caught, ghost.ghostName);
        return;
      }
      return _wordPrompt(PromptKind.escape, ActionType.hide);
    }

    // Found Ritual Item?
    final find = rollItemFind(state.spawns, _rng);
    if (find != null) {
      final item = content.itemById(find.itemId);
      state = state.copyWith(pendingFind: find);
      _log('Your camera catches something near the ${find.spawnLocation}: ${item?.itemName ?? 'an item'}.');
      return _wordPrompt(PromptKind.pickup, ActionType.interact);
    }
    _afterStep();
  }

  void _onEscape() {
    final s = state;
    final chase = s.chase!.withEscape();
    final proximity = clampMeter(s.ghostProximity - escapeRelief);
    if (chase.escapesDone >= chase.escapesNeeded) {
      final ghost = _ghostById(chase.ghostId);
      state = s.copyWith(
        chase: null,
        ghostProximity: min(proximity, 30.0),
        graceSteps: graceStepsAfterEscape,
        chasesSurvived: s.chasesSurvived + 1,
      );
      _log('You lost the ${ghost?.ghostName ?? 'ghost'}. Chat is going wild.', LogTone.good);
      return _afterStep();
    }
    state = s.copyWith(chase: chase, ghostProximity: proximity);
    _wordPrompt(PromptKind.escape, ActionType.hide);
  }

  void _onPickup() {
    final s = state;
    final find = s.pendingFind!;
    final item = s.content!.itemById(find.itemId);
    state = s.copyWith(
      pendingFind: null,
      spawns: takeFromSpawn(s.spawns, find.spawnId),
      sessionInventory: addQuantities(s.sessionInventory, {find.itemId: 1}),
    );
    _log('Collected ${item?.itemName ?? 'item'}.', LogTone.good);
    _afterStep();
  }

  void _startExorcism() {
    final s = state;
    final boss = ritualTargets(s.content!).firstOrNull;
    state = s.copyWith(
      phase: Phase.exorcism,
      exorcism: ExorcismProgress(0, exorcismLength[s.content!.place.difficulty]!),
      ghostProximity: max(s.ghostProximity, 40.0),
    );
    _log('You lay out the items. The ${boss?.ghostName ?? 'spirit'} manifests — finish the rite!', LogTone.ghost);
    _wordPrompt(PromptKind.exorcise, ActionType.exorcise);
  }

  void _onExorciseWord() {
    final s = state;
    final ex = ExorcismProgress(s.exorcism!.done + 1, s.exorcism!.needed);
    state = s.copyWith(exorcism: ex, ghostProximity: clampMeter(s.ghostProximity - 8));
    if (ex.done >= ex.needed) {
      _log('The air goes still. The haunting is over.', LogTone.good);
      _finish(SessionOutcome.exorcised);
      return;
    }
    _wordPrompt(PromptKind.exorcise, ActionType.exorcise);
  }

  void _onChoice(ChoiceAction action) {
    final s = state;
    switch (action) {
      case ChoiceAction.deeper:
      case ChoiceAction.keepLooking:
        state = s.copyWith(phase: Phase.exploring, missing: const []);
        _wordPrompt(PromptKind.move, ActionType.movement);
      case ChoiceAction.wrapUp:
        _choicePrompt(Phase.ritualPrompt, const [_ritual, _goHome]);
      case ChoiceAction.ritual:
        final owned = addQuantities(s.userInventory, s.sessionInventory);
        final check = checkRequirements(requiredItems(s.content!), owned);
        if (check.met) return _startExorcism();
        state = s.copyWith(missing: check.missing);
        _log('You do not have everything the ritual needs.', LogTone.bad);
        _choicePrompt(Phase.insufficient, const [_keepLooking, _goHome]);
      case ChoiceAction.goHome:
        _finish(SessionOutcome.extracted);
      case ChoiceAction.retry:
        selectPlace(s.content!.place.placeId);
      case ChoiceAction.menu:
        backToMenu();
    }
  }

  /// Save Results (USER_PLACE_PROGRESS + USER_INVENTORY), then show the outcome.
  Future<void> _finish(SessionOutcome outcome, [String? caughtBy]) async {
    final s = state;
    final content = s.content!;
    final previous = s.places.where((p) => p.place.placeId == content.place.placeId).firstOrNull?.progress;
    final w = wpm(s.stats);
    final a = accuracy(s.stats);
    final durationSec = ((_now() - s.sessionStartedAt) / 1000).round();
    if (caughtBy != null) _log('$caughtBy caught you. The stream cuts to static.', LogTone.ghost);
    state = state.copyWith(
      phase: Phase.saving,
      prompt: null,
      buffer: '',
      chase: outcome == SessionOutcome.caught ? s.chase : null,
    );

    final result = SessionResult(
      outcome: outcome,
      placeName: content.place.placeName,
      wpm: w,
      accuracy: a,
      roomsExplored: s.room,
      stepsTaken: s.playerDistance,
      itemsFound: s.sessionInventory,
      chasesSurvived: s.chasesSurvived,
      durationSec: durationSec,
      previousBestWpm: previous?.bestWpm,
      previousBestAccuracy: previous?.bestAccuracy,
      caughtBy: caughtBy,
    );
    try {
      result.progress = await _repo.saveSessionResults(SessionResultInput(
        placeId: content.place.placeId,
        outcome: outcome,
        wpm: w,
        accuracy: a,
        playtimeSeconds: durationSec,
        collected: s.sessionInventory,
      ));
      final places = await _repo.listPlaces();
      final userInventory = await _repo.getInventory();
      final player = await _repo.getPlayer();
      state = state.copyWith(places: places, userInventory: userInventory, player: player);
    } catch (e) {
      result.saveError = e.toString();
    }
    state = state.copyWith(result: result);
    _choicePrompt(outcome == SessionOutcome.caught ? Phase.gameover : Phase.results, const [_retry, _menu]);
  }

  // ----------------------------------------------------------- public API

  Future<void> init() async {
    try {
      final player = await _repo.getPlayer();
      if (player == null) {
        state = state.copyWith(phase: Phase.auth);
        return;
      }
      final places = await _repo.listPlaces();
      final items = await _repo.listItems();
      final wordBank = await _repo.getWordBank();
      final userInventory = await _repo.getInventory();
      state = state.copyWith(
        player: player,
        places: places,
        items: items,
        wordBank: wordBank,
        userInventory: userInventory,
        phase: Phase.menu,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(error: e.toString(), phase: Phase.menu);
    }
  }

  Future<void> selectPlace(int placeId) async {
    state = state.resetSession(Phase.loading);
    try {
      await _repo.startPlaceSession(placeId);
      final content = await _repo.getPlaceContent(placeId);
      final userInventory = await _repo.getInventory();
      state = state.copyWith(
        content: content,
        userInventory: userInventory,
        spawns: initSpawns(content.spawns),
        sessionStartedAt: _now(),
        phase: Phase.exploring,
      );
      _log('LIVE from ${content.place.placeName}. ${content.place.description}');
      _wordPrompt(PromptKind.move, ActionType.movement);
    } catch (e) {
      state = state.copyWith(error: e.toString(), phase: Phase.menu);
    }
  }

  void pressKey(String key) {
    final s = state;
    final prompt = s.prompt;
    if (prompt == null) return;
    final timed = prompt.timed;
    if (timed ? !_timedPhases.contains(s.phase) : !_choicePhases.contains(s.phase)) return;

    final out = applyKey(s.buffer, prompt.options, key);
    final t = _now();

    if (out.kind == KeyResultKind.typo) {
      if (!timed) {
        state = s.copyWith(typoAt: t); // choices are safe moments
        return;
      }
      state = s.copyWith(
        typoAt: t,
        stats: s.stats.copyWith(totalKeystrokes: s.stats.totalKeystrokes + 1),
        prompt: prompt.withDeadline(max(t + 400, prompt.deadline! - typoTimePenaltyMs)),
      );
      _ghostGetsCloser(PenaltyKind.typo);
      return;
    }

    var stats = s.stats;
    if (timed) {
      stats = stats.copyWith(correctKeystrokes: stats.correctKeystrokes + 1, totalKeystrokes: stats.totalKeystrokes + 1);
      if (out.kind == KeyResultKind.complete) {
        stats = stats.copyWith(wordsCompleted: stats.wordsCompleted + 1, activeMs: stats.activeMs + (t - prompt.shownAt));
      }
    }
    state = s.copyWith(stats: stats, buffer: out.buffer);
    if (out.kind != KeyResultKind.complete) return;

    switch (prompt.kind) {
      case PromptKind.move:
        _onMove();
      case PromptKind.escape:
        _onEscape();
      case PromptKind.pickup:
        _onPickup();
      case PromptKind.exorcise:
        _onExorciseWord();
      case PromptKind.choice:
        _onChoice(prompt.choices.firstWhere((c) => c.word == out.option).action);
    }
  }

  /// Click/tap on a choice card.
  void choose(ChoiceAction action) {
    final p = state.prompt;
    if (p != null && p.kind == PromptKind.choice && p.choices.any((c) => c.action == action)) _onChoice(action);
  }

  /// Called by the UI ticker; handles command timeouts.
  void tick() {
    final s = state;
    final p = s.prompt;
    if (p == null || p.deadline == null || !_timedPhases.contains(s.phase) || _now() < p.deadline!) return;

    state = s.copyWith(stats: s.stats.copyWith(wordsFailed: s.stats.wordsFailed + 1, activeMs: s.stats.activeMs + p.timeLimitMs!));
    _log(p.kind == PromptKind.pickup ? 'Too slow — it slips into the dark.' : 'Too slow. Something moves closer.', LogTone.bad);
    if (_ghostGetsCloser(PenaltyKind.timeout)) return;

    switch (p.kind) {
      case PromptKind.move:
        _wordPrompt(PromptKind.move, ActionType.movement);
      case PromptKind.escape:
        _wordPrompt(PromptKind.escape, ActionType.hide);
      case PromptKind.exorcise:
        _wordPrompt(PromptKind.exorcise, ActionType.exorcise);
      case PromptKind.pickup:
        state = state.copyWith(pendingFind: null);
        _afterStep();
      case PromptKind.choice:
        break;
    }
  }

  void backToMenu() {
    state = state.resetSession(Phase.menu);
  }
}
