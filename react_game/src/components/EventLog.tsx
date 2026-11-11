import type { LogEntry } from '../store/index.ts';

const TONE: Record<LogEntry['tone'], string> = {
  info: 'text-bone/70',
  good: 'text-ecto',
  bad: 'text-candle',
  ghost: 'text-blood font-bold',
};

export function EventLog({ log }: { log: LogEntry[] }) {
  return (
    <section>
      <header className="mb-2 text-[11px] uppercase tracking-[0.2em] text-dim">Stream log</header>
      <ul className="space-y-1.5 text-xs leading-relaxed" aria-live="polite">
        {log.map((e, i) => (
          <li key={e.id} className={`${TONE[e.tone]} transition-opacity`} style={{ opacity: 1 - i * 0.14 }}>
            {e.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
