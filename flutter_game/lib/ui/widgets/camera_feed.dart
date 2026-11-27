import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../theme.dart';
import 'walk_camera.dart';

const _tints = {
  'flickering': Color(0xFF1A1810),
  'misty': Color(0xFF121820),
  'sterile': Color(0xFF0F1A18),
  'flooded': Color(0xFF0B1420),
};

/// Photographic backrooms plates drawn behind the corridor geometry.
const _plates = {
  'flickering': 'assets/images/backroom_level0.jpg',
  'misty': 'assets/images/backroom_level1.jpg',
  'sterile': 'assets/images/backroom_level1.jpg',
  'flooded': 'assets/images/backroom_poolrooms.jpg',
};
const _chasePlate = 'assets/images/backroom_chase.jpg';

class CameraFeed extends StatefulWidget {
  const CameraFeed({
    super.key,
    required this.proximity,
    required this.chasing,
    required this.atmosphere,
    required this.child,
    this.keystrokes = 0,
    this.steps = 0,
    this.typoAt = 0,
    this.walking = false,
    this.timed = false,
    this.running = false,
  });
  final double proximity;
  final bool chasing;
  final String atmosphere;
  final Widget child;

  final int keystrokes;
  final int steps;
  final int typoAt;
  final bool walking;
  final bool timed;
  final bool running;

  @override
  State<CameraFeed> createState() => _CameraFeedState();
}

class _CameraFeedState extends State<CameraFeed> with TickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat(reverse: true);
  late final AnimationController _drift = AnimationController(vsync: this, duration: const Duration(seconds: 5))
    ..repeat(reverse: true);
  final _rand = Random();

  WalkState _walk = const WalkState();
  late final Ticker _walkTicker;
  Duration _lastTick = Duration.zero;
  double _flicker = 1;
  Timer? _flickerTimer;
  Timer? _restoreTimer;

  @override
  void initState() {
    super.initState();
    _walkTicker = createTicker((elapsed) {
      final dt = (elapsed - _lastTick).inMicroseconds / 1e6;
      _lastTick = elapsed;
      setState(() => _walk = _walk.advance(dt, running: widget.running));
    })
      ..start();
    _scheduleFlicker();
  }

  void _scheduleFlicker() {
    final p = widget.proximity / 100;
    final wait = Duration(milliseconds: (400 + _rand.nextInt(2600) * (1 - p)).round());
    _flickerTimer = Timer(wait, () {
      if (!mounted) return;
      setState(() => _flicker = 0.4 + _rand.nextDouble() * 0.3);
      _restoreTimer = Timer(const Duration(milliseconds: 60), () {
        if (mounted) setState(() => _flicker = 1);
      });
      _scheduleFlicker();
    });
  }

  @override
  void didUpdateWidget(covariant CameraFeed old) {
    super.didUpdateWidget(old);
    if (old.walking && widget.keystrokes > old.keystrokes) _walk = _walk.keystroke();
    if (widget.steps > old.steps) _walk = _walk.step();
    if (old.timed && widget.typoAt != old.typoAt && widget.typoAt != 0) _walk = _walk.stumbled();
  }

  @override
  void dispose() {
    _flickerTimer?.cancel();
    _restoreTimer?.cancel();
    _walkTicker.dispose();
    _pulse.dispose();
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final p = widget.proximity / 100;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AnimatedBuilder(
        animation: Listenable.merge([_pulse, _drift]),
        builder: (context, child) => Container(
          decoration: BoxDecoration(
            border: Border.all(color: Palette.bone.withValues(alpha: 0.1)),
            borderRadius: BorderRadius.circular(12),
            gradient: RadialGradient(
              center: const Alignment(0, -0.4),
              radius: 1.1,
              colors: [_tints[widget.atmosphere] ?? const Color(0xFF15161B), const Color(0xFF050506)],
            ),
          ),
          child: Stack(children: [
            // Realistic backrooms plate: the corridor the streamer is standing in.
            Positioned.fill(
              child: Image.asset(
                _plates[widget.atmosphere] ?? 'assets/images/backroom_level0.jpg',
                fit: BoxFit.cover,
                color: Colors.black.withValues(alpha: 0.22),
                colorBlendMode: BlendMode.darken,
              ),
            ),
            // The same corridor once something starts running.
            Positioned.fill(
              child: AnimatedOpacity(
                opacity: widget.chasing ? 0.92 : 0.0,
                duration: const Duration(milliseconds: 900),
                child: Image.asset(_chasePlate, fit: BoxFit.cover),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: LayoutBuilder(builder: (context, box) {
                  final pose = reduceMotion
                      ? (x: 0.0, y: 0.0, roll: 0.0)
                      : _walk.pose(running: widget.running, unit: box.maxHeight / 400);
                  return Transform.translate(
                    offset: Offset(pose.x, pose.y),
                    child: Transform.rotate(
                      angle: pose.roll,
                      child: Transform.scale(
                        scale: 1.12,
                        child: Stack(children: [
                          Positioned.fill(
                            child: CustomPaint(
                              painter: CorridorPainter(depth: _walk.depth, time: _walk.t, atmosphere: widget.atmosphere),
                            ),
                          ),
                          Positioned.fill(
                            child: CustomPaint(
                              painter: _GhostPainter(
                                proximity: p,
                                drift: reduceMotion ? 0.0 : (_drift.value - 0.5) * 2,
                                pulse: reduceMotion ? 0.0 : _pulse.value,
                                chasing: widget.chasing,
                                glitch: !reduceMotion,
                              ),
                            ),
                          ),
                        ]),
                      ),
                    ),
                  );
                }),
              ),
            ),
            Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _ScanlinePainter()))),
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      radius: 0.95,
                      colors: [Colors.transparent, Colors.black.withValues(alpha: 0.85)],
                      stops: const [0.4, 1],
                    ),
                  ),
                ),
              ),
            ),
            if (widget.chasing && !reduceMotion)
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: Palette.blood.withValues(alpha: 0.15 + _pulse.value * 0.35), width: 3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            Opacity(opacity: reduceMotion ? 1 : _flicker, child: child),
          ]),
        ),
        child: widget.child,
      ),
    );
  }
}

class _ScanlinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.03);
    for (double y = 0; y < size.height; y += 3) {
      canvas.drawRect(Rect.fromLTWH(0, y, size.width, 1), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GhostPainter extends CustomPainter {
  _GhostPainter({
    required this.proximity,
    required this.drift,
    required this.pulse,
    required this.chasing,
    required this.glitch,
  });

  final double proximity;
  final double drift;
  final double pulse;
  final bool chasing;
  final bool glitch;

  static const _ghost = Color(0xFFDCE2EC);
  static const _blood = Color(0xFFE0313F);

  @override
  void paint(Canvas canvas, Size size) {
    final p = proximity.clamp(0.0, 1.0);
    if (p > 0.35) _redEdges(canvas, size, (p - 0.35) / 0.65);
    if (p < 0.06) return;

    final v = ((p - 0.06) / 0.94).clamp(0.0, 1.0);
    final h = size.height * (0.40 + 0.34 * v);
    final jitter = glitch && p > 0.75 ? (Random(DateTime.now().millisecondsSinceEpoch ~/ 70).nextDouble() - 0.5) * 12 : 0.0;
    final cx = size.width / 2 + drift * size.width * 0.05 + jitter;
    final top = size.height * 0.52 - h * 0.55;
    final figure = _figure(cx, top, h);
    final mid = Offset(cx, top + h / 2);

    for (var i = 6; i >= 1; i--) {
      final s = 1 + i * 0.035;
      canvas.save();
      canvas.translate(mid.dx, mid.dy);
      canvas.scale(s, s);
      canvas.translate(-mid.dx, -mid.dy);
      canvas.drawPath(figure, Paint()..color = _ghost.withValues(alpha: 0.035 * v));
      canvas.restore();
    }
    canvas.drawPath(figure, Paint()..color = _ghost.withValues(alpha: 0.07 + 0.20 * v));

    final headR = h * 0.09;
    final headC = Offset(cx, top + headR);
    if (v > 0.25) {
      canvas.drawOval(
        Rect.fromCenter(center: headC.translate(0, headR * 0.15), width: headR * 1.3, height: headR * 1.5),
        Paint()..color = const Color(0xFF050508).withValues(alpha: 0.55 * v),
      );
      final eye = Paint()
        ..color = chasing ? _blood.withValues(alpha: (0.6 + 0.4 * pulse) * v) : _ghost.withValues(alpha: 0.75 * v);
      for (final dx in [-0.32, 0.32]) {
        canvas.drawOval(
          Rect.fromCenter(center: headC.translate(headR * dx, headR * 0.05), width: headR * 0.26, height: headR * 0.16),
          eye,
        );
      }
    }

    if (glitch && p > 0.6) _static(canvas, size, (p - 0.6) / 0.4);
  }

  Path _figure(double cx, double top, double h) {
    final headR = h * 0.09;
    final w = h * 0.2;
    final bottom = top + h;
    final shoulderY = top + headR * 2.4;
    return Path()
      ..addOval(Rect.fromCircle(center: Offset(cx, top + headR), radius: headR * 1.05))
      ..addPath(
        Path()
          ..moveTo(cx - headR * 0.75, top + headR * 1.75)
          ..quadraticBezierTo(cx - w * 1.05, shoulderY, cx - w * 1.25, bottom)
          ..lineTo(cx - w * 0.75, bottom - h * 0.06)
          ..lineTo(cx - w * 0.3, bottom - h * 0.01)
          ..lineTo(cx + w * 0.15, bottom - h * 0.07)
          ..lineTo(cx + w * 0.65, bottom - h * 0.02)
          ..lineTo(cx + w * 1.25, bottom)
          ..quadraticBezierTo(cx + w * 1.05, shoulderY, cx + headR * 0.75, top + headR * 1.75)
          ..close(),
        Offset.zero,
      );
  }

  void _redEdges(Canvas canvas, Size size, double k) {
    final band = size.shortestSide * 0.014;
    final beat = chasing ? 0.65 + 0.35 * pulse : 1.0;
    for (var i = 0; i < 10; i++) {
      final rect = (Offset.zero & size).deflate(band * i + band / 2);
      canvas.drawRect(
        rect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = band
          ..color = _blood.withValues(alpha: 0.13 * k * beat * (1 - i / 10)),
      );
    }
  }

  void _static(Canvas canvas, Size size, double k) {
    final rnd = Random(DateTime.now().millisecondsSinceEpoch ~/ 90);
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.10 * k);
    for (var i = 0; i < 7; i++) {
      final y = rnd.nextDouble() * size.height;
      canvas.drawRect(Rect.fromLTWH(0, y, size.width, 1 + rnd.nextDouble() * 2.5), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GhostPainter old) => true;
}