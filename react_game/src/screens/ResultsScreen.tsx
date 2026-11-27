import { useGame } from '../store/index.ts';
import { TypingPrompt } from '../components/TypingPrompt.tsx';

const fmt = (sec: number) => `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;

export function ResultsScreen() {
  const r = useGame((s) => s.result)!;
  const prompt = useGame((s) => s.prompt);
  const buffer = useGame((s) => s.buffer);
  const typoAt = useGame((s) => s.typoAt);
  const items = useGame((s) => s.items);
  const caught = r.outcome === 'caught';
  const newWpm = !caught && (r.previousBest.wpm ?? 0) < r.wpm;
  const newAcc = !caught && (r.previousBest.accuracy ?? 0) < r.accuracy;
  const found = Object.entries(r.itemsFound).map(([id, q]) => `${items.find((i) => i.item_id === Number(id))?.item_name} ×${q}`);

  const headline = caught ? 'SIGNAL LOST' : r.outcome === 'exorcised' ? 'Haunting ended' : 'Stream saved';
  const sub = caught
    ? `${r.caughtBy} caught you in ${r.placeName}. Everything you found this run is gone.`
    : r.outcome === 'exorcised'
      ? `You exorcised ${r.placeName}. Ritual items consumed.`
      : `You made it out of ${r.placeName} with the footage.`;

  const Stat = ({ label, value, best }: { label: string; value: string; best?: boolean }) => (
    <div className="rounded-lg border border-bone/10 bg-ash/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-dim">{label}</div>
      <div className="mt-1 text-2xl tabular-nums">{value}</div>
      {best && <div className="mt-1 text-[11px] text-ecto">new best</div>}
    </div>
  );

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-12">
      <h1 className={`font-display text-6xl italic ${caught ? 'text-blood' : 'text-bone'}`}>{headline}</h1>
      <p className="mt-3 text-sm text-dim">{sub}</p>
      {r.saveError && <p className="mt-4 rounded border border-blood/40 bg-blood/10 p-3 text-sm text-blood">Could not save: {r.saveError}</p>}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="WPM" value={r.wpm.toFixed(1)} best={newWpm} />
        <Stat label="Accuracy" value={`${r.accuracy.toFixed(1)}%`} best={newAcc} />
        <Stat label="Rooms" value={String(r.roomsExplored)} />
        <Stat label="Chases survived" value={String(r.chasesSurvived)} />
      </div>
      <p className="mt-4 text-xs text-dim">
        {fmt(r.durationSec)} live · {r.stepsTaken} steps · items: {found.length ? found.join(', ') : 'none'}
      </p>

      <div className="mt-10">{prompt && <TypingPrompt prompt={prompt} buffer={buffer} typoAt={typoAt} />}</div>
    </div>
  );
}
