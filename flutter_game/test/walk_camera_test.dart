// Mirrors react_native_game/src/__tests__/walkCamera.test.ts.
import 'package:flutter_test/flutter_test.dart';
import 'package:type_to_run/ui/widgets/walk_camera.dart';

WalkState runFor(WalkState s, double seconds, {bool running = false}) {
  for (var t = 0.0; t < seconds; t += 1 / 60) {
    s = s.advance(1 / 60, running: running);
  }
  return s;
}

void main() {
  test('typing builds footstep energy that bobs the camera; idling settles it', () {
    var s = const WalkState();
    for (var i = 0; i < 5; i++) {
      s = s.keystroke();
    }
    expect(s.energy, greaterThan(0.9));
    var maxBob = 0.0;
    for (var i = 0; i < 30; i++) {
      s = s.advance(1 / 60, running: false);
      final y = s.pose(running: false).y.abs();
      if (y > maxBob) maxBob = y;
    }
    expect(maxBob, greaterThan(3));
    s = runFor(s, 4);
    expect(s.energy, lessThan(0.01));
    expect(s.pose(running: false).y.abs(), lessThan(1.5));
  });

  test('each completed word moves the camera down the corridor', () {
    final s = runFor(const WalkState().step().step(), 3);
    expect(s.depth, closeTo(1.2, 0.05));
  });

  test('running (chase) bobs harder than walking', () {
    final typed = const WalkState().keystroke().keystroke().keystroke().keystroke();
    double peak(bool running) {
      var s = typed;
      var m = 0.0;
      for (var i = 0; i < 40; i++) {
        s = s.advance(1 / 60, running: running);
        final y = s.pose(running: running).y.abs();
        if (y > m) m = y;
      }
      return m;
    }

    expect(peak(true), greaterThan(peak(false)));
  });

  test('a typo stumbles the camera sideways, then recovers', () {
    var s = const WalkState().stumbled();
    var jolt = 0.0;
    for (var i = 0; i < 10; i++) {
      s = s.advance(1 / 60, running: false);
      final x = s.pose(running: false).x.abs();
      if (x > jolt) jolt = x;
    }
    expect(jolt, greaterThan(3));
    s = runFor(s, 1.5);
    expect(s.stumble, lessThan(0.001));
  });

  test('only movement words count as footsteps', () {
    expect(isWalkingPrompt('move'), isTrue);
    expect(isWalkingPrompt('escape'), isTrue);
    expect(isWalkingPrompt('pickup'), isFalse);
    expect(isWalkingPrompt('exorcise'), isFalse);
  });
}
