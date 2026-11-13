import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

/// Captures typing from hardware *and* on-screen keyboards for the whole app.
///
/// Mounted ONCE above every screen (see app.dart), so the same hidden TextField and
/// FocusNode survive menu → run → results → next run. Whenever [enabled] is true it
/// grabs focus automatically: on every new [focusTrigger] (each prompt/phase), when
/// the app comes back to the foreground, and whenever something else steals focus.
/// That's what lets the next game accept letters immediately, without tapping.
class TypingInput extends StatefulWidget {
  const TypingInput({
    super.key,
    required this.enabled,
    required this.focusTrigger,
    required this.onChar,
    required this.child,
  });

  final bool enabled;

  /// Any value that changes when a new prompt or phase appears.
  final Object focusTrigger;
  final void Function(String char) onChar;
  final Widget child;

  static const fieldKey = ValueKey('typing-input-field');

  @override
  State<TypingInput> createState() => _TypingInputState();
}

class _TypingInputState extends State<TypingInput> with WidgetsBindingObserver {
  final _controller = TextEditingController();
  final _focus = FocusNode(debugLabel: 'typing-input');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _focus.addListener(_onFocusChange);
    _scheduleFocus();
  }

  @override
  void didUpdateWidget(covariant TypingInput old) {
    super.didUpdateWidget(old);
    if (widget.enabled && (!old.enabled || widget.focusTrigger != old.focusTrigger)) _scheduleFocus();
    if (!widget.enabled && old.enabled && _focus.hasFocus) _focus.unfocus();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _scheduleFocus();
  }

  /// Lost focus while the game wants input → take it back, unless the user is
  /// typing in some other text field (e.g. the sign-in form).
  void _onFocusChange() {
    if (!_focus.hasFocus && widget.enabled) _scheduleFocus();
  }

  bool _otherTextFieldFocused() {
    final ctx = FocusManager.instance.primaryFocus?.context;
    if (ctx == null || FocusManager.instance.primaryFocus == _focus) return false;
    return ctx.widget is EditableText || ctx.findAncestorWidgetOfExactType<EditableText>() != null;
  }

  void _scheduleFocus() {
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !widget.enabled || _focus.hasFocus || _otherTextFieldFocused()) return;
      _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _focus.removeListener(_onFocusChange);
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    if (text.isEmpty) return;
    _controller.value = TextEditingValue.empty;
    if (!widget.enabled) return;
    for (final rune in text.runes) {
      widget.onChar(String.fromCharCode(rune));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      // Any tap/click inside the game re-arms typing too (and re-opens the phone keyboard).
      behavior: HitTestBehavior.translucent,
      onPointerUp: (_) => _scheduleFocus(),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            child: Opacity(
              opacity: 0,
              child: ExcludeSemantics(
                excluding: !widget.enabled,
                child: TextField(
                  key: TypingInput.fieldKey,
                  controller: _controller,
                  focusNode: _focus,
                  enabled: widget.enabled,
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
          ),
          Positioned.fill(child: widget.child),
        ],
      ),
    );
  }
}
