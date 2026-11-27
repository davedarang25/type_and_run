// Keeps the game listening to the keyboard across runs, screens and devices.
//
// * Hardware keyboards: a window-level keydown listener — works no matter what is focused.
// * On-screen keyboards (phones/tablets): a hidden <input> that is re-focused automatically
//   whenever a new prompt appears, the phase changes, or the tab/window comes back, so the
//   player never has to tap the screen to "wake up" typing for the next game.
import { useEffect, useRef } from 'react';
import { gameStore, useGame, type Phase } from '../store/index.ts';

export const TYPING_PHASES = new Set<Phase>(['exploring', 'decision', 'ritualPrompt', 'insufficient', 'exorcism', 'results', 'gameover']);

/** True when the user is typing in a real form field (e.g. the sign-in form). */
const editingElsewhere = (el: Element | null, own: HTMLInputElement | null) =>
  !!el && el !== own && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);

export function TypingCapture() {
  const input = useRef<HTMLInputElement>(null);
  const phase = useGame((s) => s.phase);
  const promptShownAt = useGame((s) => s.prompt?.shownAt ?? 0);
  const active = TYPING_PHASES.has(phase);

  const refocus = () => {
    const el = input.current;
    if (!el || !TYPING_PHASES.has(gameStore.getState().phase)) return;
    if (editingElsewhere(document.activeElement, el)) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
  };

  // Hardware keys (desktop, laptops, tablets with keyboards).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (!TYPING_PHASES.has(gameStore.getState().phase)) return;
      if (editingElsewhere(e.target as Element, input.current)) return;
      e.preventDefault(); // no page scroll on space, no stray characters in the hidden input
      gameStore.getState().pressKey(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Re-arm on every new phase and every new prompt (this is what fixes "second game won't type").
  useEffect(() => {
    if (!active) {
      if (document.activeElement === input.current) input.current?.blur();
      return;
    }
    refocus();
    const t = setTimeout(refocus, 50); // after React commits the new screen
    return () => clearTimeout(t);
  }, [active, phase, promptShownAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back to the tab/window, or tapping anywhere in the game, re-arms typing too.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && refocus();
    const onPointer = (e: PointerEvent) => {
      if (!editingElsewhere(e.target as Element, input.current)) setTimeout(refocus, 0);
    };
    window.addEventListener('focus', refocus);
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('pointerup', onPointer);
    return () => {
      window.removeEventListener('focus', refocus);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('pointerup', onPointer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={input}
      aria-label="Type here"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      inputMode="text"
      className="fixed left-0 top-0 h-px w-px opacity-0"
      style={{ fontSize: 16 /* stops iOS from zooming in on focus */ }}
      tabIndex={active ? 0 : -1}
      // On-screen keyboards often send no usable keydown (key "Unidentified"), only input events.
      // Hardware keys never get here: their keydown is handled above and preventDefault()ed.
      onInput={(e) => {
        const el = e.currentTarget;
        const text = el.value;
        el.value = '';
        if (!TYPING_PHASES.has(gameStore.getState().phase)) return;
        for (const ch of text) gameStore.getState().pressKey(ch);
      }}
      onBlur={() => setTimeout(refocus, 0)}
    />
  );
}
