import { useEffect, useRef } from 'react';
import { gameStore, type Prompt } from '../store/index.ts';

/** Drives store.tick() and draws the remaining time for the current command. */
export function TimerBar({ prompt }: { prompt: Prompt }) {
  const bar = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const { prompt: p } = gameStore.getState();
      if (p?.deadline && p.timeLimitMs) {
        const left = Math.max(0, p.deadline - Date.now());
        const frac = left / p.timeLimitMs;
        if (bar.current) {
          bar.current.style.width = `${Math.min(100, frac * 100)}%`;
          bar.current.style.background = frac < 0.3 ? 'var(--color-blood)' : frac < 0.6 ? 'var(--color-candle)' : 'var(--color-bone)';
        }
        if (label.current) label.current.textContent = `${(left / 1000).toFixed(1)}s`;
      }
      gameStore.getState().tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!prompt.deadline) return <div className="h-5" />;
  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bone/10">
        <div ref={bar} className="h-full rounded-full" />
      </div>
      <span ref={label} className="w-12 text-right text-xs tabular-nums text-dim" />
    </div>
  );
}
