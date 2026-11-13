import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../repositories/game_repository.dart';
import '../../state/game_engine.dart';
import '../theme.dart';
import '../widgets/typing_prompt.dart';

class ResultsScreen extends ConsumerWidget {
  const ResultsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(gameEngineProvider);
    final engine = ref.read(gameEngineProvider.notifier);
    final r = s.result!;
    final caught = r.outcome == SessionOutcome.caught;
    final newWpm = !caught && (r.previousBestWpm ?? 0) < r.wpm;
    final newAcc = !caught && (r.previousBestAccuracy ?? 0) < r.accuracy;
    final found = r.itemsFound.entries
        .map((e) => '${s.items.where((i) => i.itemId == e.key).firstOrNull?.itemName} ×${e.value}')
        .join(', ');
    final headline = caught ? 'SIGNAL LOST' : (r.outcome == SessionOutcome.exorcised ? 'Haunting ended' : 'Stream saved');
    final sub = caught
        ? '${r.caughtBy} caught you in ${r.placeName}. Everything you found this run is gone.'
        : r.outcome == SessionOutcome.exorcised
            ? 'You exorcised ${r.placeName}. Ritual items consumed.'
            : 'You made it out of ${r.placeName} with the footage.';
    final mins = r.durationSec ~/ 60;
    final secs = (r.durationSec % 60).toString().padLeft(2, '0');

    return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(headline, style: display(size: 60, color: caught ? Palette.blood : Palette.bone)),
              const SizedBox(height: 12),
              Text(sub, style: mono(size: 13, color: Palette.dim)),
              if (r.saveError != null) ...[
                const SizedBox(height: 16),
                Text('Could not save: ${r.saveError}', style: mono(size: 13, color: Palette.blood)),
              ],
              const SizedBox(height: 32),
              Wrap(spacing: 12, runSpacing: 12, children: [
                _Stat('WPM', r.wpm.toStringAsFixed(1), best: newWpm),
                _Stat('Accuracy', '${r.accuracy.toStringAsFixed(1)}%', best: newAcc),
                _Stat('Rooms', '${r.roomsExplored}'),
                _Stat('Chases survived', '${r.chasesSurvived}'),
              ]),
              const SizedBox(height: 16),
              Text('${mins}m ${secs}s live · ${r.stepsTaken} steps · items: ${found.isEmpty ? 'none' : found}',
                  style: mono(size: 12, color: Palette.dim)),
              const SizedBox(height: 40),
              if (s.prompt != null)
                Center(child: TypingPromptView(prompt: s.prompt!, buffer: s.buffer, typoAt: s.typoAt, onChoose: engine.choose)),
            ]),
          ),
        ),
      );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.title, this.value, {this.best = false});
  final String title;
  final String value;
  final bool best;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 170,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Palette.ash.withValues(alpha: 0.7),
        border: Border.all(color: Palette.bone.withValues(alpha: 0.1)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title.toUpperCase(), style: label()),
        const SizedBox(height: 4),
        Text(value, style: mono(size: 24)),
        if (best) Text('new best', style: mono(size: 11, color: Palette.ecto)),
      ]),
    );
  }
}
