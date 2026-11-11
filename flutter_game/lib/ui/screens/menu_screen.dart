import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../repositories/game_repository.dart';
import '../../repositories/local_repository.dart';
import '../../state/game_engine.dart';
import '../theme.dart';

class MenuScreen extends ConsumerWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(gameEngineProvider);
    final repo = ref.watch(repositoryProvider);
    final cleared = s.places.where((p) => p.progress?.explorationCompleted ?? false).length;
    final exorcised = s.places.where((p) => p.progress?.ritualCompleted ?? false).length;
    final stash = s.userInventory.entries
        .map((e) => '${s.items.where((i) => i.itemId == e.key).firstOrNull?.itemName ?? e.key} ×${e.value}')
        .join(', ');

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1000),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('● REC', style: mono(size: 12, color: Palette.blood, spacing: 3)),
            const SizedBox(height: 8),
            Text('Type-to-Run', style: display(size: 64)),
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 580),
              child: Text(
                "You're a paranormal streamer. Every step, every hiding spot, every word of the rite is typed. "
                'Typos and hesitation draw them closer. Explore and leave alive, or gather what the ritual needs and end the haunting.',
                style: mono(size: 13, color: Palette.dim).copyWith(height: 1.6),
              ),
            ),
            const SizedBox(height: 20),
            Wrap(spacing: 24, runSpacing: 8, children: [
              _stat('Streamer', s.player?.username ?? '—'),
              _stat('Locations cleared', '$cleared/${s.places.length}'),
              _stat('Exorcisms', '$exorcised'),
              _stat('Stash', stash.isEmpty ? 'empty' : stash),
            ]),
            const SizedBox(height: 32),
            if (s.error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 20),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Palette.blood.withValues(alpha: 0.1),
                  border: Border.all(color: Palette.blood.withValues(alpha: 0.4)),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(s.error!, style: mono(size: 13, color: Palette.blood)),
              ),
            LayoutBuilder(builder: (context, c) {
              final cols = c.maxWidth > 640 ? 2 : 1;
              final w = (c.maxWidth - (cols - 1) * 16) / cols;
              return Wrap(spacing: 16, runSpacing: 16, children: [
                for (final card in s.places) SizedBox(width: w, child: _PlaceCardView(card: card)),
              ]);
            }),
            const SizedBox(height: 32),
            Row(children: [
              Expanded(
                child: Text(
                  repo.mode == 'local' ? 'Offline mode — progress saved on this device.' : 'Connected to Supabase.',
                  style: mono(size: 11, color: Palette.dim),
                ),
              ),
              if (repo is LocalRepository)
                TextButton(
                  onPressed: () async {
                    await repo.reset();
                    await ref.read(gameEngineProvider.notifier).init();
                  },
                  child: Text('reset offline save', style: mono(size: 11, color: Palette.dim)),
                ),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _stat(String k, String v) => Text.rich(TextSpan(children: [
        TextSpan(text: '$k ', style: mono(size: 12, color: Palette.dim)),
        TextSpan(text: v, style: mono(size: 12, weight: FontWeight.bold)),
      ]));
}

class _PlaceCardView extends ConsumerWidget {
  const _PlaceCardView({required this.card});
  final PlaceCard card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final place = card.place;
    final progress = card.progress;
    final diffColor = difficultyColor[place.difficulty.name]!;
    Widget badge(String text, Color color) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(border: Border.all(color: color.withValues(alpha: 0.35)), borderRadius: BorderRadius.circular(4)),
          child: Text(text.toUpperCase(), style: mono(size: 10, color: color, spacing: 2)),
        );

    return Opacity(
      opacity: card.unlocked ? 1 : 0.5,
      child: Material(
        color: card.unlocked ? Palette.ash : Palette.ash.withValues(alpha: 0.4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: Palette.bone.withValues(alpha: card.unlocked ? 0.15 : 0.05)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: card.unlocked ? () => ref.read(gameEngineProvider.notifier).selectPlace(place.placeId) : null,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                badge(place.difficulty.name, diffColor),
                if (progress?.ritualCompleted ?? false) badge('exorcised', Palette.ecto),
                if ((progress?.explorationCompleted ?? false) && !(progress?.ritualCompleted ?? false)) badge('explored', Palette.dim),
                if (!card.unlocked) Text('🔒 CLEAR THE PREVIOUS LOCATION', style: label()),
              ]),
              const SizedBox(height: 12),
              Text(place.placeName, style: display(size: 26)),
              const SizedBox(height: 8),
              Text(place.description, style: mono(size: 12, color: Palette.dim).copyWith(height: 1.6)),
              const SizedBox(height: 16),
              Wrap(spacing: 20, children: [
                Text('Best WPM ${progress?.bestWpm?.toStringAsFixed(1) ?? '—'}', style: mono(size: 12, color: Palette.dim)),
                Text(
                  'Best accuracy ${progress?.bestAccuracy != null ? '${progress!.bestAccuracy!.toStringAsFixed(1)}%' : '—'}',
                  style: mono(size: 12, color: Palette.dim),
                ),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
