import 'dart:math';

import 'package:flutter/material.dart';

import '../theme.dart';

class JumpscareOverlay extends StatefulWidget {
  const JumpscareOverlay({
    super.key,
    this.imageAsset = 'assets/images/jumpscare_default.png',
    this.duration = const Duration(seconds: 3),
    this.onFinished,
  });

  final String imageAsset;
  final Duration duration;
  final VoidCallback? onFinished;

  @override
  State<JumpscareOverlay> createState() => _JumpscareOverlayState();
}

class _JumpscareOverlayState extends State<JumpscareOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  bool _completed = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed && !_completed) {
          _completed = true;
          widget.onFinished?.call();
        }
      })
      ..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return Positioned.fill(
      child: Material(
        color: Palette.void_,
        child: AnimatedBuilder(
          animation: _ctrl,
          builder: (context, _) {
            final t = _ctrl.value;
            final phase = t * widget.duration.inMilliseconds * 0.085;
            final amp = reduceMotion ? 0.0 : (18.0 * (1.0 - t * 0.25));
            final dx = sin(phase * 1.7) * amp;
            final dy = cos(phase * 2.3) * amp * 0.85;
            final tilt = reduceMotion ? 0.0 : sin(phase * 1.3) * 0.045;
            final zoom = reduceMotion ? 1.0 : (1.12 + sin(phase * 0.9).abs() * 0.12);

            return Stack(
              fit: StackFit.expand,
              children: [
                Transform.translate(
                  offset: Offset(dx, dy),
                  child: Transform.rotate(
                    angle: tilt,
                    child: Transform.scale(
                      scale: zoom,
                      child: Image.asset(
                        widget.imageAsset,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
                IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        radius: 0.9,
                        colors: [
                          Colors.transparent,
                          Palette.blood.withValues(alpha: 0.25 + (sin(phase).abs() * 0.25)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}