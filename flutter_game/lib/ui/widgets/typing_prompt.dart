import 'dart:math';

import 'package:flutter/material.dart';

import '../../engine/typing.dart';
import '../../state/game_engine.dart';
import '../theme.dart';

const _kindLabel = {
  PromptKind.move: 'MOVE',
  PromptKind.escape: 'ESCAPE!',
  PromptKind.pickup: 'PICK IT UP',
  PromptKind.exorcise: 'CHANT',
  PromptKind.choice: 'DECIDE',
};

/// Renders the current command with per-letter feedback; shakes and flashes red on typos.
class TypingPromptView extends StatefulWidget {
  const TypingPromptView({super.key, required this.prompt, required this.buffer, required this.typoAt, required this.onChoose});
  final Prompt prompt;
  final String buffer;
  final int typoAt;
  final void Function(ChoiceAction) onChoose;

  @override
  State<TypingPromptView> createState() => _TypingPromptViewState();
}

class _TypingPromptViewState extends State<TypingPromptView> with SingleTickerProviderStateMixin {
  late final AnimationController _shake = AnimationController(vsync: this, duration: const Duration(milliseconds: 380));

  @override
  void didUpdateWidget(covariant TypingPromptView old) {
    super.didUpdateWidget(old);
    if (widget.typoAt != old.typoAt && widget.typoAt != 0) _shake.forward(from: 0);
  }

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _shake,
      builder: (context, child) {
        final t = _shake.value;
        final dx = t == 0 || t == 1 ? 0.0 : sin(t * pi * 6) * 7 * (1 - t);
        final flash = widget.prompt.timed ? (1 - t) * (t == 0 ? 0 : 0.35) : 0.0;
        return Transform.translate(
          offset: Offset(dx, 0),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Palette.blood.withValues(alpha: flash),
              borderRadius: BorderRadius.circular(8),
            ),
            child: child,
          ),
        );
      },
      child: widget.prompt.kind == PromptKind.choice ? _choices() : _single(),
    );
  }

  Widget _single() {
    final p = widget.prompt;
    final danger = p.kind == PromptKind.escape || p.kind == PromptKind.exorcise;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(_kindLabel[p.kind]!, style: mono(size: 12, weight: FontWeight.bold, spacing: 4, color: danger ? Palette.blood : Palette.dim)),
        const SizedBox(height: 12),
        _Word(word: p.options.first, typed: widget.buffer.length, active: true, size: 44),
      ]),
    );
  }

  Widget _choices() {
    final target = activeOption(widget.buffer, widget.prompt.options);
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 12,
      runSpacing: 12,
      children: [
        for (final c in widget.prompt.choices)
          InkWell(
            onTap: () => widget.onChoose(c.action),
            borderRadius: BorderRadius.circular(6),
            child: Container(
              constraints: const BoxConstraints(minWidth: 200),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: target == c.word ? Palette.ecto.withValues(alpha: 0.05) : Palette.ash.withValues(alpha: 0.8),
                border: Border.all(color: target == c.word ? Palette.ecto.withValues(alpha: 0.7) : Palette.bone.withValues(alpha: 0.15)),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.label.toUpperCase(), style: label()),
                const SizedBox(height: 4),
                _Word(word: c.word, typed: target == c.word ? widget.buffer.length : 0, active: target == c.word, size: 20),
              ]),
            ),
          ),
      ],
    );
  }
}

class _Word extends StatelessWidget {
  const _Word({required this.word, required this.typed, required this.active, required this.size});
  final String word;
  final int typed;
  final bool active;
  final double size;

  @override
  Widget build(BuildContext context) {
    final chars = word.split('');
    return RichText(
      textAlign: TextAlign.center,
      text: TextSpan(children: [
        for (var i = 0; i < chars.length; i++)
          TextSpan(
            text: chars[i],
            style: mono(
              size: size,
              spacing: 1.5,
              color: active && i < typed
                  ? Palette.ecto
                  : active && i == typed
                      ? Palette.bone
                      : Palette.bone.withValues(alpha: 0.35),
            ).copyWith(
              decoration: active && i == typed ? TextDecoration.underline : null,
              decorationColor: Palette.bone.withValues(alpha: 0.7),
              decorationThickness: 2,
              shadows: active && i < typed ? [Shadow(color: Palette.ecto.withValues(alpha: 0.6), blurRadius: 8)] : null,
            ),
          ),
      ]),
    );
  }
}
