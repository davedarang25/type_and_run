// Keyboard input for the whole app — mounted once in App.tsx, above every screen.
//
// A hidden TextInput receives both on-screen (phone) and physical keyboards. It stays mounted
// and is re-focused on every new prompt/phase, when the app returns to the foreground, and
// whenever it loses focus — so the next game accepts letters without tapping the screen
// (the bug that was fixed in the Flutter game).
import { useEffect, useRef } from 'react';
import { AppState, Platform, StyleSheet, TextInput, type TextInputInstance } from 'react-native';
import { gameStore, TYPING_PHASES, useGame } from '../store';

export function TypingCapture() {
  const input = useRef<TextInputInstance>(null);
  const phase = useGame((s) => s.phase);
  const promptShownAt = useGame((s) => s.prompt?.shownAt ?? 0);
  const holdFocus = phase !== 'auth'; // the sign-in form needs the keyboard
  const holdRef = useRef(holdFocus);
  holdRef.current = holdFocus;

  const focus = () => {
    if (holdRef.current && !input.current?.isFocused()) input.current?.focus();
  };

  useEffect(() => {
    if (!holdFocus) {
      input.current?.blur();
      return;
    }
    focus();
    const t = setTimeout(focus, 80); // after the new screen has rendered
    return () => clearTimeout(t);
  }, [holdFocus, phase, promptShownAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTimeout(focus, 100));
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TextInput
      ref={input}
      value=""
      onChangeText={(text) => {
        if (!text || !TYPING_PHASES.has(gameStore.getState().phase)) return;
        for (const ch of text) gameStore.getState().pressKey(ch);
      }}
      onBlur={() => setTimeout(focus, 50)}
      autoFocus
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      spellCheck={false}
      caretHidden
      contextMenuHidden
      submitBehavior="submit"
      // visible-password turns off Android autocorrect / predictive text
      keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
      importantForAutofill="no"
      accessibilityLabel="Type here"
      style={styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  // Kept on screen (not display:none) so it can hold focus; invisible and tiny.
  hidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0, color: 'transparent' },
});

