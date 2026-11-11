import type { PlaceGhost } from '../types/db.ts';

export function GhostMeter({ proximity, ghost, chasing }: { proximity: number; ghost: PlaceGhost | null; chasing: boolean }) {
  const segments = 20;
  const lit = Math.round((proximity / 100) * segments);
  const status = chasing ? 'HUNTING YOU' : proximity > 70 ? 'RIGHT BEHIND YOU' : proximity > 40 ? 'CLOSE' : proximity > 15 ? 'NEARBY' : 'QUIET';
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-[0.2em] text-dim">
        <span>EMF · Ghost proximity</span>
        <span className="tabular-nums">{Math.round(proximity)}%</span>
      </header>
      <div className="flex gap-[3px]" role="meter" aria-valuenow={Math.round(proximity)} aria-valuemin={0} aria-valuemax={100} aria-label="Ghost proximity">
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            className="h-4 flex-1 rounded-[2px] transition-colors duration-200"
            style={{
              background: i < lit ? (i < 8 ? 'var(--color-ecto)' : i < 14 ? 'var(--color-candle)' : 'var(--color-blood)') : 'rgb(232 228 216 / 0.07)',
              boxShadow: i < lit && i >= 14 ? '0 0 8px rgb(224 49 63 / 0.7)' : undefined,
            }}
          />
        ))}
      </div>
      <p className={`mt-2 text-xs ${chasing || proximity > 70 ? 'text-blood' : 'text-dim'}`}>
        {status}{ghost && (chasing || proximity > 40) ? ` — ${ghost.ghost_name}` : ''}
      </p>
    </section>
  );
}
