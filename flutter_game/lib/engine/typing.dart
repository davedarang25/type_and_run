// Typing engine: keystroke matching + WPM / accuracy. Pure. Mirrors react/src/engine/typing.ts.

enum KeyResultKind { progress, typo, complete }

class KeyOutcome {
  const KeyOutcome(this.buffer, this.kind, [this.option]);
  final String buffer;
  final KeyResultKind kind;
  final String? option; // set when kind == complete
}

/// Applies one keystroke against one or more acceptable targets.
/// Stop-on-error: a wrong key is rejected and the buffer is unchanged.
KeyOutcome applyKey(String buffer, List<String> options, String key) {
  if (key.length != 1) return KeyOutcome(buffer, KeyResultKind.progress);
  final next = buffer + key.toLowerCase();
  final candidates = options.where((o) => o.toLowerCase().startsWith(next)).toList();
  if (candidates.isEmpty) return KeyOutcome(buffer, KeyResultKind.typo);
  for (final o in candidates) {
    if (o.toLowerCase() == next) return KeyOutcome('', KeyResultKind.complete, o);
  }
  return KeyOutcome(next, KeyResultKind.progress);
}

/// Which option the current buffer is heading toward (for highlighting).
String? activeOption(String buffer, List<String> options) {
  if (buffer.isEmpty) return null;
  for (final o in options) {
    if (o.toLowerCase().startsWith(buffer)) return o;
  }
  return null;
}

class TypingStats {
  const TypingStats({
    this.correctKeystrokes = 0,
    this.totalKeystrokes = 0,
    this.wordsCompleted = 0,
    this.wordsFailed = 0,
    this.activeMs = 0,
  });
  final int correctKeystrokes;
  final int totalKeystrokes;
  final int wordsCompleted;
  final int wordsFailed; // timeouts
  final int activeMs; // time spent on timed prompts

  TypingStats copyWith({int? correctKeystrokes, int? totalKeystrokes, int? wordsCompleted, int? wordsFailed, int? activeMs}) =>
      TypingStats(
        correctKeystrokes: correctKeystrokes ?? this.correctKeystrokes,
        totalKeystrokes: totalKeystrokes ?? this.totalKeystrokes,
        wordsCompleted: wordsCompleted ?? this.wordsCompleted,
        wordsFailed: wordsFailed ?? this.wordsFailed,
        activeMs: activeMs ?? this.activeMs,
      );
}

double round2(double n) => (n * 100).round() / 100;

/// Standard WPM: (correct characters / 5) per minute of active typing.
double wpm(TypingStats s) {
  if (s.activeMs < 1000) return 0;
  return round2(s.correctKeystrokes / 5 / (s.activeMs / 60000));
}

double accuracy(TypingStats s) {
  if (s.totalKeystrokes == 0) return 100;
  return round2(s.correctKeystrokes / s.totalKeystrokes * 100);
}
