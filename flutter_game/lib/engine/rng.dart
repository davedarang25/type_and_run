import 'dart:math';

/// Random source in [0, 1). Injected everywhere so tests can be deterministic.
typedef Rng = double Function();

Rng seededRng(int seed) => Random(seed).nextDouble;

T? pickWeighted<T>(List<T> items, num Function(T) weight, Rng rng) {
  final total = items.fold<num>(0, (s, t) => s + max(0, weight(t)));
  if (total <= 0) return null;
  var r = rng() * total;
  for (final t in items) {
    r -= max(0, weight(t));
    if (r < 0) return t;
  }
  return items.last;
}
