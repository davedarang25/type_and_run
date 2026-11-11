import 'dart:async';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../theme.dart';

const _tints = {
  'flickering': Color(0xFF1A1810),
  'misty': Color(0xFF121820),
  'sterile': Color(0xFF0F1A18),
  'flooded': Color(0xFF0B1420),
};

/// The "camera" viewport: scanlines, vignette, flicker and an apparition that
/// sharpens as proximity rises. Pulses red during a chase or rite.
class CameraFeed extends StatefulWidget {
  const CameraFeed({super.key, required this.proximity, required this.chasing, required this.atmosphere, required this.child});
  final double proximity;
  final bool chasing;
  final String atmosphere;
  final Widget child;

  @override
  State<CameraFeed> createState() => _CameraFeedState();
}

class _CameraFeedState extends State<CameraFeed> with TickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat(reverse: true);
  late final AnimationController _drift = AnimationController(vsync: this, duration: const Duration(seconds: 5))
    ..repeat(reverse: true);
  final _rand = Random();
  double _flicker = 1;
  Timer? _flickerTimer;

  @override
  void initState() {
    super.initState();
    _scheduleFlicker();
  }

  void _scheduleFlicker() {
    final p = widget.proximity / 100;
    final wait = Duration(milliseconds: (400 + _rand.nextInt(2600) * (1 - p)).round());
    _flickerTimer = Timer(wait, () {
      if (!mounted) return;
      setState(() => _flicker = 0.4 + _rand.nextDouble() * 0.3);
      Timer(const Duration(milliseconds: 60), () {
        if (mounted) setState(() => _flicker = 1);
      });
      _scheduleFlicker();
    });
  }

  @override
  void dispose() {
    _flickerTimer?.cancel();
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
            // apparition
            Positioned.fill(
              child: IgnorePointer(
                child: Align(
                  alignment: Alignment(reduceMotion ? 0.0 : (_drift.value - 0.5) * 0.08, -0.3),
                  child: Opacity(
                    opacity: max(0, p * 0.9 - 0.05),
                    child: ImageFiltered(
                      imageFilter: ui.ImageFilter.blur(sigmaX: (1 - p) * 14 + 2, sigmaY: (1 - p) * 14 + 2),
                      child: const _Apparition(),
                    ),
                  ),
                ),
              ),
            ),
            Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _ScanlinePainter()))),
            // vignette
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

class _Apparition extends StatelessWidget {
  const _Apparition();
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 140,
      height: 300,
      child: Column(children: [
        Container(
          width: 56,
          height: 70,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(colors: [const Color(0xFFDCE1E6).withValues(alpha: 0.55), Colors.transparent]),
          ),
        ),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(60), bottom: Radius.circular(20)),
              gradient: RadialGradient(colors: [const Color(0xFFC8CDD7).withValues(alpha: 0.32), Colors.transparent]),
            ),
          ),
        ),
      ]),
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
