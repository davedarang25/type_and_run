import { useEffect, useState } from 'react';

export function StreamHeader({ title, viewers, startedAt, mode }: { title: string; viewers: number; startedAt: number; mode: string }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const secs = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
      <span className="flex items-center gap-2 font-bold tracking-[0.2em] text-blood">
        <span className="rec inline-block h-2.5 w-2.5 rounded-full bg-blood" /> LIVE
      </span>
      <span className="font-display text-base italic text-bone">{title}</span>
      <span className="text-dim tabular-nums">{clock}</span>
      <span className="ml-auto text-dim tabular-nums">👁 {viewers.toLocaleString()} watching</span>
      <span className="rounded border border-bone/15 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-dim">{mode}</span>
    </header>
  );
}
