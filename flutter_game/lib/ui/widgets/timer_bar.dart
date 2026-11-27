import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/game_engine.dart';
import '../theme.dart';

/// Drives GameEngine.tick() every frame and draws the remaining time for the command.
class TimerBar extends ConsumerStatefulWidget {
  const TimerBar({super.key});
  @override
  ConsumerState<TimerBar> createState() => _TimerBarState();
}

class _TimerBarState extends ConsumerState<TimerBar> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  double _frac = 1;
  double _left = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((_) {
      final engine = ref.read(gameEngineProvider.notifier);
      engine.tick();
      final p = ref.read(gameEngineProvider).prompt;
      if (p?.deadline != null && p?.timeLimitMs != null) {
        final now = ref.read(clockProvider)();
        final left = (p!.deadline! - now).clamp(0, p.timeLimitMs!).toDouble();
        setState(() {
          _left = left / 1000;
          _frac = left / p.timeLimitMs!;
        });
      }
    })
      ..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final timed = ref.watch(gameEngineProvider.select((s) => s.prompt?.deadline != null));
    if (!timed) return const SizedBox(height: 20);
    final color = _frac < 0.3 ? Palette.blood : (_frac < 0.6 ? Palette.candle : Palette.bone);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: Row(children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _frac.clamp(0.0, 1.0).toDouble(),
              minHeight: 6,
              backgroundColor: Palette.bone.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ),
        const SizedBox(width: 12),
        SizedBox(width: 48, child: Text('${_left.toStringAsFixed(1)}s', textAlign: TextAlign.right, style: mono(size: 12, color: Palette.dim))),
      ]),
    );
  }
}
