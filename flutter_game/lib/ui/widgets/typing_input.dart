import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Captures typing from hardware *and* on-screen keyboards with an invisible,
/// always-focused TextField, and forwards each character to [onChar].
/// Tap anywhere inside [child] to bring the soft keyboard back on mobile.
class TypingInput extends StatefulWidget {
  const TypingInput({super.key, required this.onChar, required this.child});
  final void Function(String char) onChar;
  final Widget child;

  @override
  State<TypingInput> createState() => _TypingInputState();
}

class _TypingInputState extends State<TypingInput> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    if (text.isEmpty) return;
    _controller.value = TextEditingValue.empty;
    for (final rune in text.runes) {
      widget.onChar(String.fromCharCode(rune));
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => _focus.requestFocus(),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            child: Opacity(
              opacity: 0,
              child: TextField(
                controller: _controller,
                focusNode: _focus,
                autofocus: true,
                autocorrect: false,
                enableSuggestions: false,
                enableInteractiveSelection: false,
                keyboardType: TextInputType.visiblePassword, // no autocorrect / IME composing
                textCapitalization: TextCapitalization.none,
                inputFormatters: [FilteringTextInputFormatter.deny(RegExp(r'[\n\r\t]'))],
                onChanged: _onChanged,
                showCursor: false,
                decoration: const InputDecoration.collapsed(hintText: ''),
              ),
            ),
          ),
          widget.child,
        ],
      ),
    );
  }
}
