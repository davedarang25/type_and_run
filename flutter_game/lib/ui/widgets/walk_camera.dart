// Walking camera — line-for-line port of react_native_game/src/engine/walkCamera.ts.
// Keep the numbers in sync.
//
//   correct key on a MOVE/ESCAPE word → footstep energy (bob grows, corridor creeps forward)
//   word completed (a step)           → forward lurch down the corridor
//   typo                              → stumble (sharp sideways jolt)
//   chase                             → running: faster, bigger, shakier bob
//   idle                              → energy fades to a slow breathing sway
import 'dart:math';

import 'package:flutter/material.dart';

class WalkState {
  const WalkState({
    this.t = 0,
    this.energy = 0,
    this.phase = 0,
    this.depth = 0,
    this.depthTarget = 0,
    this.stumble = 0,
  });

  final double t; // seconds since start
  final double energy; // 0..1
  final double phase; // footstep cycle (radians)
  final double depth; // eased distance down the corridor
  final double depthTarget;
  final double stumble; // 0..1

  WalkState _copy({double? t, double? energy, double? phase, double? depth, double? depthTarget, double? stumble}) =>
      WalkState(
        t: t ?? this.t,
        energy: energy ?? this.energy,
        phase: phase ?? this.phase,
        depth: depth ?? this.depth,
        depthTarget: depthTarget ?? this.depthTarget,
        stumble: stumble ?? this.stumble,
      );

  WalkState keystroke() => _copy(energy: min(1.0, energy + 0.22));
  WalkState step() => _copy(depthTarget: depthTarget + 0.6);
  WalkState stumbled() => _copy(stumble: 1, energy: energy * 0.5);

  /// Advance the simulation by [dt] seconds.
  WalkState advance(double dt, {required bool running}) {
    final d = min(dt, 0.05); // clamp after hitches
    final e = energy * exp(-d * (running ? 1.2 : 2.2));
    final speed = (running ? 13 : 8) * (0.3 + 0.7 * e);
    final creep = d * e * (running ? 0.9 : 0.45);
    final target = depthTarget + creep;
    return WalkState(
      t: t + d,
      energy: e,
      phase: phase + d * speed * (e > 0.02 ? 1 : 0),
      depthTarget: target,
      depth: depth + (target - depth) * min(1.0, d * 3),
      stumble: stumble * exp(-d * 6),
    );
  }

  /// Camera offset and tilt this frame. Amplitudes are px for a ~400px view; scale with [unit].
  ({double x, double y, double roll}) pose({required bool running, double unit = 1}) {
    final amp = (running ? 14 : 9) * unit;
    final stepBob = sin(phase).abs(); // one bob per footstep
    return (
      x: sin(phase * 0.5) * amp * 0.6 * energy + sin(t * 45) * 9 * unit * stumble,
      y: -stepBob * amp * energy + sin(t * 1.6) * 1.2 * unit + 4 * unit * stumble,
      roll: sin(phase * 0.5) * 0.012 * energy + (running ? sin(t * 23) * 0.004 * energy : 0.0),
    );
  }
}

/// Which prompts count as walking (footsteps); pickups and chants stand still.
bool isWalkingPrompt(String? kind) => kind == 'move' || kind == 'escape';

const corridorRings = 7;

Color _rgba(int r, int g, int b, double a) => Color.fromRGBO(r, g, b, a.clamp(0.0, 1.0));
double _lerp(double a, double b, double t) => a + (b - a) * t;

/// One-point-perspective corridor whose cross-section rings slide toward the viewer as
/// [depth] grows. Each level (atmosphere) gets its own details:
///   flickering → dorm doors · misty → hanging roots + fog · sterile → buzzing ceiling lights ·
///   flooded → water + ripples. Plain shapes only, so it renders the same on web and desktop.
class CorridorPainter extends CustomPainter {
  CorridorPainter({required this.depth, required this.time, required this.atmosphere});

  final double depth;
  final double time;
  final String atmosphere;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final vp = Offset(w / 2, h * 0.45);
    final far = Rect.fromLTRB(vp.dx - w * 0.09, vp.dy - h * 0.1, vp.dx + w * 0.09, vp.dy + h * 0.1);
    final near = Rect.fromLTRB(-w * 0.1, -h * 0.1, w * 1.1, h * 1.1);
    final fill = Paint();
    final stroke = Paint()..style = PaintingStyle.stroke;

    void poly(List<Offset> pts, Color c) => canvas.drawPath(Path()..addPolygon(pts, true), fill..color = c);
    void line(Offset a, Offset b, Color c, double width) => canvas.drawLine(a, b, stroke..color = c..strokeWidth = width);
    void outline(Rect r, Color c, double width) => canvas.drawRect(r, stroke..color = c..strokeWidth = width);
    void box(Rect r, Color c) => canvas.drawRect(r, fill..color = c);

    // floor + ceiling planes and the dark end of the corridor
    poly([near.bottomLeft, near.bottomRight, far.bottomRight, far.bottomLeft],
        atmosphere == 'flooded' ? _rgba(20, 40, 60, 0.45) : _rgba(0, 0, 0, 0.35));
    poly([near.topLeft, near.topRight, far.topRight, far.topLeft], _rgba(0, 0, 0, 0.25));
    box(far, _rgba(0, 0, 0, 0.55));

    // edges converging on the vanishing point
    final edge = _rgba(232, 228, 216, 0.07);
    line(near.topLeft, far.topLeft, edge, 1);
    line(near.topRight, far.topRight, edge, 1);
    line(near.bottomLeft, far.bottomLeft, edge, 1);
    line(near.bottomRight, far.bottomRight, edge, 1);

    // rings: u = 0 at the far end → 1 at the camera; they move toward you as depth grows
    for (var i = 0; i < corridorRings; i++) {
      final u = (((i + depth) % corridorRings) + corridorRings) % corridorRings / corridorRings;
      final s = pow(u, 2.2).toDouble();
      final r = Rect.fromLTRB(
        _lerp(far.left, near.left, s),
        _lerp(far.top, near.top, s),
        _lerp(far.right, near.right, s),
        _lerp(far.bottom, near.bottom, s),
      );
      final a = sin(u * pi);
      final rw = r.width, rh = r.height;
      outline(r, _rgba(232, 228, 216, 0.11 * a), 1 + 2 * s);

      if (atmosphere == 'flickering' && i % 2 == 0) {
        final dw = rw * 0.07, dh = rh * 0.62;
        outline(Rect.fromLTWH(r.left + rw * 0.01, r.bottom - dh, dw, dh), _rgba(244, 184, 96, 0.16 * a), 1 + s);
        outline(Rect.fromLTWH(r.right - rw * 0.01 - dw, r.bottom - dh, dw, dh), _rgba(244, 184, 96, 0.16 * a), 1 + s);
      } else if (atmosphere == 'sterile') {
        final on = 0.5 + 0.5 * sin(time * 9 + i * 2.3) > 0.15 ? 1.0 : 0.25;
        box(Rect.fromLTWH(vp.dx - rw * 0.12, r.top + rh * 0.015, rw * 0.24, max(1.0, rh * 0.018)), _rgba(210, 255, 235, 0.22 * a * on));
      } else if (atmosphere == 'flooded') {
        final y = r.bottom - rh * 0.01;
        final shift = sin(time * 2 + i) * rw * 0.04;
        line(Offset(vp.dx - rw * 0.3 + shift, y), Offset(vp.dx - rw * 0.05 + shift, y), _rgba(150, 200, 255, 0.18 * a), 1 + s);
        line(Offset(vp.dx + rw * 0.08 - shift, y), Offset(vp.dx + rw * 0.32 - shift, y), _rgba(150, 200, 255, 0.14 * a), 1 + s);
      } else if (atmosphere == 'misty' && i % 2 == 1) {
        for (final fx in const [0.15, 0.35, 0.7, 0.88]) {
          final x = r.left + rw * fx;
          line(Offset(x, r.top), Offset(x + sin(time + fx * 9) * rw * 0.01, r.top + rh * (0.12 + fx * 0.1)),
              _rgba(120, 150, 120, 0.2 * a), 1 + s);
        }
      }
    }

    // drifting fog for the mansion (stacked bands → soft edges without blur filters)
    if (atmosphere == 'misty') {
      for (var k = 0; k < 3; k++) {
        final y = h * (0.55 + k * 0.12);
        final x = ((time * (12 + k * 7) + k * w * 0.4) % (w * 1.6)) - w * 0.6;
        for (final f in const [1.0, 0.6, 0.3]) {
          box(Rect.fromLTWH(x + w * 0.45 * (1 - f), y + h * 0.035 * (1 - f), w * 0.9 * f, h * 0.07 * f), _rgba(200, 210, 220, 0.03));
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CorridorPainter old) =>
      old.depth != depth || old.time != time || old.atmosphere != atmosphere;
}
