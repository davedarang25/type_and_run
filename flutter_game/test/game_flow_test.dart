// Drives the full state machine through the flowchart with a scripted RNG and clock.
// Mirrors react_game/src/__tests__/gameFlow.test.ts.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:type_to_run/models/db.dart';
import 'package:type_to_run/repositories/game_repository.dart';
import 'package:type_to_run/repositories/local_repository.dart';
import 'package:type_to_run/state/game_engine.dart';

void main() {
  late ProviderContainer container;
  late LocalRepository repo;
  late int clock;
  late List<double> rolls;

  GameEngine engine() => container.read(gameEngineProvider.notifier);
  GameEngineState st() => container.read(gameEngineProvider);

  void type(String text) {
    for (final ch in text.split('')) {
      clock += 150;
      engine().pressKey(ch);
    }
  }

  void typePrompt() => type(st().prompt!.options.first);

  Future<void> flush() async {
    for (var i = 0; i < 5; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  setUp(() async {
    clock = 1000000;
    rolls = [];
    repo = LocalRepository(MemoryStore());
    container = ProviderContainer(overrides: [
      repositoryProvider.overrideWithValue(repo),
      rngProvider.overrideWithValue(() => rolls.isNotEmpty ? rolls.removeAt(0) : 0.99), // 0.99 = nothing happens
      clockProvider.overrideWithValue(() => clock),
    ]);
    await engine().init();
  });

  tearDown(() => container.dispose());

  test('starts at the menu with only the starter location unlocked', () {
    expect(st().phase, Phase.menu);
    expect(st().places.where((p) => p.unlocked).map((p) => p.place.placeId).toList(), [1]);
  });

  test('safe exploration → decision → go home saves exploration_completed and unlocks the next place', () async {
    await engine().selectPlace(1);
    expect(st().phase, Phase.exploring);
    for (var i = 0; i < 3; i++) {
      typePrompt();
    }
    expect(st().phase, Phase.decision);
    type('wrap up');
    expect(st().phase, Phase.ritualPrompt);
    type('go home');
    await flush();
    expect(st().phase, Phase.results);
    expect(st().result!.outcome, SessionOutcome.extracted);
    expect(st().result!.wpm, greaterThan(0));
    expect(st().result!.accuracy, 100);
    final p1 = st().places.firstWhere((p) => p.place.placeId == 1).progress!;
    expect(p1.status, ProgressStatus.cleared);
    expect(p1.explorationCompleted, isTrue);
    expect(p1.ritualCompleted, isFalse);
    expect(st().places.firstWhere((p) => p.place.placeId == 2).unlocked, isTrue);
  });

  test('typos penalise time, accuracy and ghost proximity', () async {
    await engine().selectPlace(1);
    final before = st().prompt!.deadline!;
    engine().pressKey('#');
    expect(st().ghostProximity, greaterThan(0));
    expect(st().prompt!.deadline, lessThan(before));
    expect(st().stats.totalKeystrokes, 1);
    expect(st().stats.correctKeystrokes, 0);
  });

  test('ritual without items → insufficient → keep looking returns to exploring', () async {
    await engine().selectPlace(1);
    for (var i = 0; i < 3; i++) {
      typePrompt();
    }
    type('wrap up');
    type('ritual');
    expect(st().phase, Phase.insufficient);
    expect(st().missing.single.itemId, 4);
    expect(st().missing.single.needed, 2);
    type('keep looking');
    expect(st().phase, Phase.exploring);
    expect(st().prompt!.kind, PromptKind.move);
  });

  test('collects items, performs the exorcism and consumes them', () async {
    await engine().selectPlace(1);
    // Each move: 2 encounter rolls, then item chance + weighted pick.
    rolls = [0.99, 0.99, 0.0, 0.0];
    typePrompt();
    expect(st().prompt!.kind, PromptKind.pickup);
    typePrompt();
    rolls = [0.99, 0.99, 0.0, 0.0];
    typePrompt();
    typePrompt();
    expect(st().sessionInventory, {4: 2});
    typePrompt();
    expect(st().phase, Phase.decision);
    type('wrap up');
    type('ritual');
    expect(st().phase, Phase.exorcism);
    for (var i = 0; i < 3; i++) {
      typePrompt();
    }
    await flush();
    expect(st().result!.outcome, SessionOutcome.exorcised);
    expect(st().places.first.progress!.ritualCompleted, isTrue);
    expect(st().userInventory, isEmpty);
  });

  test('ghost encounter starts a chase; escaping enough times ends it', () async {
    await engine().selectPlace(1);
    rolls = [0.99, 0.0]; // Kapre finds you
    typePrompt();
    expect(st().chase, isNotNull);
    expect(st().prompt!.kind, PromptKind.escape);
    expect(st().prompt!.actionType, ActionType.hide);
    final needed = st().chase!.escapesNeeded;
    for (var i = 0; i < needed; i++) {
      typePrompt();
    }
    expect(st().chase, isNull);
    expect(st().chasesSurvived, 1);
    expect(st().graceSteps, greaterThan(0));
  });

  test('timeouts during a chase get you caught → game over, items lost', () async {
    await engine().selectPlace(1);
    rolls = [0.99, 0.0];
    typePrompt();
    for (var i = 0; i < 40 && st().phase == Phase.exploring; i++) {
      clock = st().prompt!.deadline! + 1;
      engine().tick();
    }
    await flush();
    expect(st().phase, Phase.gameover);
    expect(st().result!.outcome, SessionOutcome.caught);
    expect(st().result!.caughtBy, 'Kapre');
    expect(st().places.first.progress!.explorationCompleted, isFalse);
    expect(await repo.getInventory(), isEmpty);
  });

  test('retry from results restarts the same place', () async {
    await engine().selectPlace(1);
    for (var i = 0; i < 3; i++) {
      typePrompt();
    }
    type('wrap up');
    type('go home');
    await flush();
    type('retry');
    await flush();
    expect(st().phase, Phase.exploring);
    expect(st().content!.place.placeId, 1);
    expect(st().playerDistance, 0);
  });
}
