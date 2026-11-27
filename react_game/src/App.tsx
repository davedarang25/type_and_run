import { useEffect, useState } from 'react';
import { gameStore, useGame } from './store/index.ts';
import { MenuScreen } from './screens/MenuScreen.tsx';
import { RunScreen } from './screens/RunScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { TypingCapture } from './components/TypingCapture.tsx';
import { JumpscareOverlay, jumpscareFor } from './components/JumpscareOverlay.tsx';

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

/**
 * Fires the jumpscare the instant the player is caught (ported from the Flutter
 * build), then reveals the results screen underneath it.
 */
function CaughtScare() {
  const phase = useGame((s) => s.phase);
  const result = useGame((s) => s.result);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(phase === 'gameover');
  }, [phase]);

  if (!visible) return null;
  return <JumpscareOverlay imageSrc={jumpscareFor(result?.caughtBy)} onFinished={() => setVisible(false)} />;
}

export default function App() {
  useEffect(() => { void gameStore.getState().init(); }, []);
  return (
    <>
      {/* Mounted once for the whole app, so keyboard input survives screen changes between runs. */}
      <TypingCapture />
      <Screen />
      <CaughtScare />
    </>
  );
}
