// Mirrors react_game/src/__tests__/engine.test.ts — both clients must agree on the rules.
import 'package:flutter_test/flutter_test.dart';
import 'package:type_to_run/data/seed.g.dart';
import 'package:type_to_run/engine/ghost_ai.dart';
import 'package:type_to_run/engine/ritual.dart';
import 'package:type_to_run/engine/rng.dart';
import 'package:type_to_run/engine/typing.dart';
import 'package:type_to_run/engine/word_generator.dart';
import 'package:type_to_run/models/db.dart';
import 'package:type_to_run/repositories/local_repository.dart';

void main() {
  group('typing engine', () {
    test('accepts correct prefixes and completes', () {
      var b = '';
      for (final k in 'wal'.split('')) {
        final r = applyKey(b, ['walk'], k);
        expect(r.kind, KeyResultKind.progress);
        b = r.buffer;
      }
      final done = applyKey(b, ['walk'], 'k');
      expect(done.kind, KeyResultKind.complete);
      expect(done.option, 'walk');
      expect(done.buffer, '');
    });

    test('rejects typos without changing the buffer (stop-on-error)', () {
      final r = applyKey('wa', ['walk'], 'x');
      expect(r.kind, KeyResultKind.typo);
      expect(r.buffer, 'wa');
    });

    test('matches any of several choice options, case-insensitively', () {
      expect(applyKey('', ['deeper', 'wrap up'], 'W').buffer, 'w');
      expect(applyKey('wrap', ['deeper', 'wrap up'], ' ').buffer, 'wrap ');
    });

    test('computes WPM and accuracy', () {
      const s = TypingStats(correctKeystrokes: 100, totalKeystrokes: 110, activeMs: 30000);
      expect(wpm(s), 40);
      expect(accuracy(s), closeTo(90.91, 0.01));
      expect(accuracy(const TypingStats()), 100);
    });
  });

  group('word generator', () {
    test('filters by action type and place difficulty', () {
      final rng = seededRng(1);
      for (var i = 0; i < 50; i++) {
        final w = pickWord(seedWordBank, ActionType.hide, Difficulty.easy, rng);
        expect(w.actionType, ActionType.hide);
        expect(w.difficulty, Difficulty.easy);
      }
      final hard = {for (var i = 0; i < 80; i++) pickWord(seedWordBank, ActionType.movement, Difficulty.hard, rng).difficulty};
      expect(hard.contains(Difficulty.easy), isFalse);
    });

    test('avoids recently used words', () {
      final easyMoves = seedWordBank
          .where((w) => w.actionType == ActionType.movement && w.difficulty == Difficulty.easy)
          .map((w) => w.word)
          .toList();
      final w = pickWord(seedWordBank, ActionType.movement, Difficulty.easy, seededRng(2), easyMoves.sublist(1));
      expect(w.word, easyMoves.first);
    });

    test('shortens time limits during chases', () {
      final w = seedWordBank.first;
      expect(timeLimitMs(w, chase: true, depth: 0), lessThan(timeLimitMs(w, chase: false, depth: 0)));
    });
  });

  group('ghost AI', () {
    final sunken = buildPlaceContent(4);
    final boss = sunken.ghosts.firstWhere((g) => g.isBoss);

    test('punishes timeouts more than typos, and more during a chase', () {
      expect(penaltyAdvance(boss, PenaltyKind.timeout, inChase: false), greaterThan(penaltyAdvance(boss, PenaltyKind.typo, inChase: false)));
      expect(penaltyAdvance(boss, PenaltyKind.typo, inChase: true), greaterThan(penaltyAdvance(boss, PenaltyKind.typo, inChase: false)));
    });

    test('raises encounter odds with depth and proximity; grace blocks encounters', () {
      final g = sunken.ghosts[1];
      final base = encounterChance(g, depth: 0, proximity: 0, graceSteps: 0);
      expect(encounterChance(g, depth: 4, proximity: 0, graceSteps: 0), greaterThan(base));
      expect(encounterChance(g, depth: 0, proximity: 80, graceSteps: 0), greaterThan(base));
      expect(encounterChance(g, depth: 4, proximity: 80, graceSteps: 1), 0);
    });

    test('bosses lurk deeper', () {
      expect(encounterChance(boss, depth: 0, proximity: 0, graceSteps: 0),
          lessThan(encounterChance(boss, depth: 1, proximity: 0, graceSteps: 0)));
    });

    test('a lunge at high proximity catches the player', () {
      expect(startChase(boss, 90).caught, isTrue);
      final r = startChase(boss, 0);
      expect(r.caught, isFalse);
      expect(r.proximity, lessThan(caughtAt));
      expect(r.chase.escapesNeeded, greaterThanOrEqualTo(4));
    });

    test('lurking ghost is the biggest threat', () {
      expect(lurkingGhost(sunken.ghosts)?.ghostName, 'Manananggal');
    });
  });

  group('inventory & ritual', () {
    test('requires the boss items only', () {
      expect(requiredItems(buildPlaceContent(1)), {4: 2});
      expect(requiredItems(buildPlaceContent(4)), {1: 3, 5: 1, 2: 1});
    });

    test('reports what is missing', () {
      final r = checkRequirements({4: 2}, {4: 1});
      expect(r.met, isFalse);
      expect(r.missing, [const MissingItem(itemId: 4, needed: 2, have: 1)]);
      expect(checkRequirements({4: 2}, {4: 3}).met, isTrue);
    });

    test('subtracts and drops empty stacks', () {
      expect(subtractQuantities({1: 2, 4: 2}, {4: 2}), {1: 2});
    });

    test('never finds items from exhausted spawns', () {
      final spawns = [for (final s in buildPlaceContent(1).spawns) SpawnState(s, 0)];
      expect(rollItemFind(spawns, () => 0), isNull);
    });
  });

  test('every location spawns enough items for its own ritual', () {
    for (final p in seedHauntedPlaces) {
      final c = buildPlaceContent(p.placeId);
      final totals = <int, int>{};
      for (final s in c.spawns) {
        totals[s.itemId] = (totals[s.itemId] ?? 0) + s.quantityAvailable;
      }
      expect(checkRequirements(requiredItems(c), totals).met, isTrue, reason: p.placeName);
    }
  });
}
