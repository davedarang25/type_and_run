import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../engine/ghost_ai.dart';
import '../../engine/ritual.dart';
import '../../state/game_engine.dart';
import '../theme.dart';
import '../widgets/camera_feed.dart';
import '../widgets/panels.dart';
import '../widgets/stream_header.dart';
import '../widgets/timer_bar.dart';
import '../widgets/typing_prompt.dart';

const _phaseText = {
  Phase.decision: 'The room is clear. Push deeper for more items — or wrap up the stream?',
  Phase.ritualPrompt: 'Attempt the exorcism, or save the footage and go home?',
  Phase.insufficient: 'The ritual is incomplete. You need more items.',
  Phase.saving: 'Uploading footage…',
};

class RunScreen extends ConsumerWidget {
  const RunScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(gameEngineProvider);
    final engine = ref.read(gameEngineProvider.notifier);
    final repo = ref.watch(repositoryProvider);
    final content = s.content!;
    final needed = requiredItems(content);
    final boss = ritualTargets(content).firstOrNull;
    final chaseGhost = s.chase == null ? null : content.ghosts.where((g) => g.ghostId == s.chase!.ghostId).firstOrNull;
    final hunting = s.chase != null || s.phase == Phase.exorcism;
    final itemsFound = s.sessionInventory.values.fold<int>(0, (a, b) => a + b);
    final viewers = 24 + s.playerDistance * 9 + s.chasesSurvived * 70 + itemsFound * 18 + (s.ghostProximity * 2.2).round();

    final feed = CameraFeed(
      proximity: s.ghostProximity,
      chasing: hunting,
      atmosphere: content.place.atmosphere,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 460),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Row(children: [
              Expanded(
                child: Text(
                  'ROOM ${s.room + 1} · STEP ${(s.stepInRoom + 1).clamp(1, stepsPerRoom)}/$stepsPerRoom',
                  style: label(),
                ),
              ),
              Text('${s.playerDistance} STEPS IN', style: label()),
            ]),
            const SizedBox(height: 40),
            Column(children: [
              if (chaseGhost != null)
                Text(
                  '${chaseGhost.ghostName.toUpperCase()} — ${s.chase!.escapesDone}/${s.chase!.escapesNeeded} TO LOSE IT',
                  style: mono(size: 13, color: Palette.blood, weight: FontWeight.bold, spacing: 3),
                  textAlign: TextAlign.center,
                ),
              if (s.exorcism != null)
                Text(
                  'RITE OF BANISHMENT — ${s.exorcism!.done}/${s.exorcism!.needed}',
                  style: mono(size: 13, color: Palette.candle, weight: FontWeight.bold, spacing: 3),
                ),
              if (_phaseText[s.phase] != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_phaseText[s.phase]!, textAlign: TextAlign.center, style: mono(size: 13, color: Palette.bone.withValues(alpha: 0.8))),
                ),
              if (s.phase == Phase.insufficient)
                for (final m in s.missing)
                  Text('${content.itemById(m.itemId)?.itemName}: ${m.have}/${m.needed}', style: mono(size: 13, color: Palette.candle)),
              const SizedBox(height: 16),
              if (s.prompt != null) TypingPromptView(prompt: s.prompt!, buffer: s.buffer, typoAt: s.typoAt, onChoose: engine.choose),
              const SizedBox(height: 16),
              if (s.prompt != null) const TimerBar(),
            ]),
            const SizedBox(height: 40),
            Text(
              s.prompt?.kind == PromptKind.choice
                  ? 'Type an option (or tap it).'
                  : 'Just type. Mistakes cost time and bring them closer.',
              style: mono(size: 11, color: Palette.dim),
            ),
          ]),
        ),
      ),
    );

    final sidebar = Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Palette.ash.withValues(alpha: 0.6),
        border: Border.all(color: Palette.bone.withValues(alpha: 0.1)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GhostMeter(
          proximity: s.ghostProximity,
          ghost: chaseGhost ?? (s.phase == Phase.exorcism ? boss : lurkingGhost(content.ghosts)),
          chasing: hunting,
        ),
        const SizedBox(height: 24),
        Text('TARGET', style: label()),
        const SizedBox(height: 6),
        Text(boss?.ghostName ?? '', style: mono(size: 14)),
        const SizedBox(height: 4),
        Text(boss?.description ?? '', style: mono(size: 12, color: Palette.dim).copyWith(height: 1.5)),
        const SizedBox(height: 4),
        Text.rich(TextSpan(children: [
          TextSpan(text: 'Weakness: ', style: mono(size: 12, color: Palette.dim)),
          TextSpan(text: boss?.weakness ?? '', style: mono(size: 12, color: Palette.candle)),
        ])),
        const SizedBox(height: 24),
        InventoryPanel(items: content.items, session: s.sessionInventory, stash: s.userInventory, needed: needed),
        const SizedBox(height: 24),
        EventLog(log: s.log),
      ]),
    );

    return LayoutBuilder(builder: (context, c) {
        final wide = c.maxWidth >= 900;
        final header = StreamHeader(title: content.place.placeName, viewers: viewers, startedAt: s.sessionStartedAt, mode: repo.mode);
        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1180),
              child: wide
                  ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(child: Column(children: [header, const SizedBox(height: 16), feed])),
                      const SizedBox(width: 20),
                      SizedBox(width: 300, child: sidebar),
                    ])
                  : Column(children: [header, const SizedBox(height: 16), feed, const SizedBox(height: 16), sidebar]),
            ),
          ),
        );
      });
  }
}
