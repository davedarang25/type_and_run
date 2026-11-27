import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';

class StreamHeader extends StatefulWidget {
  const StreamHeader({super.key, required this.title, required this.viewers, required this.startedAt, required this.mode});
  final String title;
  final int viewers;
  final int startedAt;
  final String mode;

  @override
  State<StreamHeader> createState() => _StreamHeaderState();
}

class _StreamHeaderState extends State<StreamHeader> {
  late final Timer _timer;
  bool _blink = true;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 600), (_) => setState(() => _blink = !_blink));
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final elapsed = widget.startedAt == 0 ? 0 : (DateTime.now().millisecondsSinceEpoch - widget.startedAt) ~/ 1000;
    final secs = elapsed < 0 ? 0 : elapsed;
    final clock = '${(secs ~/ 60).toString().padLeft(2, '0')}:${(secs % 60).toString().padLeft(2, '0')}';
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 20,
      runSpacing: 6,
      children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          AnimatedOpacity(
            opacity: _blink ? 1 : 0.2,
            duration: Duration.zero,
            child: Container(width: 10, height: 10, decoration: const BoxDecoration(color: Palette.blood, shape: BoxShape.circle)),
          ),
          const SizedBox(width: 8),
          Text('LIVE', style: mono(size: 12, color: Palette.blood, weight: FontWeight.bold, spacing: 3)),
        ]),
        Text(widget.title, style: display(size: 18)),
        Text(clock, style: mono(size: 12, color: Palette.dim)),
        Text('👁 ${widget.viewers} watching', style: mono(size: 12, color: Palette.dim)),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(border: Border.all(color: Palette.bone.withValues(alpha: 0.15)), borderRadius: BorderRadius.circular(4)),
          child: Text(widget.mode.toUpperCase(), style: mono(size: 10, color: Palette.dim, spacing: 2)),
        ),
      ],
    );
  }
}
