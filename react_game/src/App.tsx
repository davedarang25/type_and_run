import { useEffect } from 'react';
import { gameStore, useGame } from './store/index.ts';
import { MenuScreen } from './screens/MenuScreen.tsx';
import { RunScreen } from './screens/RunScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';

const TYPING_PHASES = new Set(['exploring', 'decision', 'ritualPrompt', 'insufficient', 'exorcism', 'results', 'gameover']);

export default function App() {
  const phase = useGame((s) => s.phase);

  useEffect(() => { void gameStore.getState().init(); }, []);

  // Global keyboard capture: the whole game is typed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (!TYPING_PHASES.has(gameStore.getState().phase)) return;
      e.preventDefault(); // stop space from scrolling, etc.
      gameStore.getState().pressKey(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  switch (phase) {
    case 'boot':
    case 'loading':
      return <div className="flex h-full items-center justify-center text-xs tracking-[0.3em] text-dim">CONNECTING TO STREAM…</div>;
    case 'auth':
      return <AuthScreen />;
    case 'menu':
      return <MenuScreen />;
    case 'results':
    case 'gameover':
      return <ResultsScreen />;
    default:
      return <RunScreen />;
  }
}
