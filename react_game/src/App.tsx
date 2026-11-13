import { useEffect } from 'react';
import { gameStore, useGame } from './store/index.ts';
import { MenuScreen } from './screens/MenuScreen.tsx';
import { RunScreen } from './screens/RunScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { TypingCapture } from './components/TypingCapture.tsx';

function Screen() {
  const phase = useGame((s) => s.phase);
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

export default function App() {
  useEffect(() => { void gameStore.getState().init(); }, []);
  return (
    <>
      {/* Mounted once for the whole app, so keyboard input survives screen changes between runs. */}
      <TypingCapture />
      <Screen />
    </>
  );
}
