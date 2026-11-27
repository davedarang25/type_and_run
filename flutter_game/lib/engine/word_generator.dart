import 'dart:math';

import '../models/db.dart';
import 'rng.dart';

/// Which WORD_BANK difficulties a location draws from, with weights.
const Map<Difficulty, Map<Difficulty, int>> difficultyMix = {
  Difficulty.easy: {Difficulty.easy: 1},
  Difficulty.medium: {Difficulty.easy: 1, Difficulty.medium: 2},
  Difficulty.hard: {Difficulty.medium: 1, Difficulty.hard: 2},
};

WordBankRow pickWord(
  List<WordBankRow> bank,
  ActionType action,
  Difficulty placeDifficulty,
  Rng rng, [
  List<String> recent = const [],
]) {
  final mix = difficultyMix[placeDifficulty]!;
  var pool = bank.where((w) => w.actionType == action && mix.containsKey(w.difficulty)).toList();
  if (pool.isEmpty) pool = bank.where((w) => w.actionType == action).toList();
  if (pool.isEmpty) throw StateError("WORD_BANK has no '${action.name}' words");
  final fresh = pool.where((w) => !recent.contains(w.word)).toList();
  return pickWeighted(fresh.isNotEmpty ? fresh : pool, (w) => mix[w.difficulty] ?? 1, rng)!;
}

/// Milliseconds allowed for a word, derived from WORD_BANK.time_limit.
/// [chase] is the "active chase modifier"; deeper rooms give slightly less time.
int timeLimitMs(WordBankRow word, {required bool chase, required int depth}) {
  final chaseMult = chase ? 0.8 : 1.0;
  final depthMult = max(0.75, 1 - depth * 0.03);
  return (word.timeLimit * 1000 * chaseMult * depthMult).round();
}
