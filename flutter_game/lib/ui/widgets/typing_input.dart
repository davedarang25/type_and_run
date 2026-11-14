import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

/// Captures typing for the whole app — the Flutter twin of react_game's TypingCapture.
///
/// * Physical keyboards (macOS, Windows, Linux, web, tablets with keyboards):
///   a global [HardwareKeyboard] handler reads every key press directly, no matter
///   which widget has focus. Nothing to "wake up" after a restart or a new game.
/// * On-screen keyboards (phones): a hidden TextField that stays mounted, enabled and
///   focused for the whole session (never switched off between games), re-focused on
///   every new prompt, when the app resumes, and whenever something steals focus.
///
/// Mounted ONCE above every screen in app.dart.
class TypingInput extends StatefulWidget {
  const TypingInput({
    super.key,
    required this.acceptKeys,
    required this.holdFocus,
    required this.focusTrigger,
    required this.onChar,
    required this.child,
  });

  /// A game prompt is on screen: forward keys to [onChar].
  final bool acceptKeys;

  /// Keep the hidden field focused (false only while a real form, e.g. sign-in, needs the keyboard).
  final bool holdFocus;

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

  /// Characters just handled from the physical keyboard. If a platform *also* delivers the
  /// same character to the hidden TextField, it's dropped here so nothing is typed twice.
  final _recentHardware = <(String, int)>[];
  final _clock = Stopwatch()..start();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    HardwareKeyboard.instance.addHandler(_onHardwareKey);
    _focus.addListener(_onFocusChange);
    _scheduleFocus();
  }

  @override
  void didUpdateWidget(covariant TypingInput old) {
    super.didUpdateWidget(old);
    if (widget.holdFocus && (!old.holdFocus || widget.focusTrigger != old.focusTrigger)) _scheduleFocus();
    if (!widget.holdFocus && old.holdFocus && _focus.hasFocus) _focus.unfocus();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _scheduleFocus();
  }

  // ---------------------------------------------------------- physical keyboard

  bool _onHardwareKey(KeyEvent event) {
    if (!widget.acceptKeys || event is KeyUpEvent) return false;
    final kb = HardwareKeyboard.instance;
    if (kb.isMetaPressed || kb.isControlPressed || kb.isAltPressed) return false;
    final ch = event.character;
    if (ch == null || ch.length != 1 || ch.codeUnitAt(0) < 32 || ch.codeUnitAt(0) == 127) return false;
    if (_otherTextFieldFocused()) return false; // e.g. someone typing in a real form
    _recentHardware.add((ch.toLowerCase(), _clock.elapsedMilliseconds));
    widget.onChar(ch);
    return true; // handled: the platform won't also insert it into a text field
  }

  bool _consumeHardwareEcho(String ch) {
    final now = _clock.elapsedMilliseconds;
    _recentHardware.removeWhere((e) => now - e.$2 > 300);
    final i = _recentHardware.indexWhere((e) => e.$1 == ch.toLowerCase());
    if (i < 0) return false;
    _recentHardware.removeAt(i);
    return true;
  }

  // ---------------------------------------------------- on-screen keyboard field

  void _onFocusChange() {
    if (!_focus.hasFocus && widget.holdFocus) _scheduleFocus();
  }

  bool _otherTextFieldFocused() {
    final primary = FocusManager.instance.primaryFocus;
    final ctx = primary?.context;
    if (ctx == null || primary == _focus) return false;
    return ctx.widget is EditableText || ctx.findAncestorWidgetOfExactType<EditableText>() != null;
  }

  void _scheduleFocus() {
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !widget.holdFocus || _focus.hasFocus || _otherTextFieldFocused()) return;
      _focus.requestFocus();
    });
  }

  void _onChanged(String text) {
    if (text.isEmpty) return;
    _controller.value = TextEditingValue.empty;
    if (!widget.acceptKeys) return;
    for (final rune in text.runes) {
      final ch = String.fromCharCode(rune);
      if (_consumeHardwareEcho(ch)) continue; // already handled as a physical key press
      widget.onChar(ch);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    HardwareKeyboard.instance.removeHandler(_onHardwareKey);
    _focus.removeListener(_onFocusChange);
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      // Any tap/click inside the game re-arms the field too (re-opens the phone keyboard).
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
                child: TextField(
                  key: TypingInput.fieldKey,
                  controller: _controller,
                  focusNode: _focus,
                  // Always enabled: switching it off between games is what used to lose the keyboard.
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
